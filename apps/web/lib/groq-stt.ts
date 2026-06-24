/**
 * Groq Whisper STT — Adaptive VAD + Multi-Trigger + Pipeline Gate
 *
 * Thuật toán:
 * 1. ScriptProcessorNode lấy PCM từ mic
 * 2. Frame timer 60ms chạy VAD adaptive (noise floor EMA)
 * 3. Multi-trigger song song: High-RMS spike, Low-RMS timeout,
 *    VAD silence, max utterance, idle timeout
 * 4. Pipeline gate chống overlap + cooldown 1.5s
 * 5. Buffer speech → encode WAV → gửi lên Groq
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const FRAME_MS = 60;
const FRAME_SAMPLES = 2880; // 48000 * 60 / 1000
const SAMPLE_RATE = 48000;

export interface GroqSttOptions {
  meetingId: string;
  speakerLabel: string;
  language?: string;
  onTranscript: (sessionId: string, text: string) => void;
  onError?: (error: Error) => void;
}

// ─── WAV encode ─────────────────────────────────────────────────────────

function encodeWav(samples: Int16Array): Blob {
  // Trim lẻ byte
  const aligned = samples.byteLength & 1 ? samples.subarray(0, samples.length - 1) : samples;
  const dataSize = aligned.byteLength;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);

  const w = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);        // PCM
  v.setUint16(22, 1, true);        // mono
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, dataSize, true);
  new Int8Array(buf, 44).set(new Int8Array(aligned.buffer, aligned.byteOffset, dataSize));
  return new Blob([buf], { type: 'audio/wav' });
}

// ─── AC RMS ─────────────────────────────────────────────────────────────

function acRms(samples: Int16Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]!;
  const mean = sum / samples.length;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]! - mean;
    sumSq += s * s;
  }
  return Math.sqrt(sumSq / samples.length);
}

// ─── GroqSttClient ──────────────────────────────────────────────────────

export class GroqSttClient {
  // Audio
  private audioCtx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;

  // State
  private isActive = false;
  private options: GroqSttOptions | null = null;

  // PCM ring buffer (producer = processor, consumer = frame timer)
  private pcmRing: Int16Array[] = [];
  private pcmRingLen = 0;

  // Frame timer
  private frameTimer: ReturnType<typeof setInterval> | null = null;

  // ─── VAD state ──────────────────────────────────────────────────────
  private noiseFloor = 0;
  private speechThreshold = 500;
  private silenceThreshold = 260;
  private hasSpeech = false;
  private speechFrames = 0;
  private silenceFramesAfterSpeech = 0;

  // ─── Speech audio buffer ────────────────────────────────────────────
  private speechBuffer: Int16Array[] = [];
  private speechBufferLen = 0;

  // ─── Multi-trigger state ────────────────────────────────────────────
  private baselineRMS = 0;
  private jitter = 0;
  private highRMSArmed = false;
  private highRMSFrames = 0;
  private postHighSilenceFrames = 0;
  private lowRMSFrames = 0;
  private totalFrames = 0;

  // ─── Pipeline gate ──────────────────────────────────────────────────
  private pipelineTriggered = false;

  // ─── Rate limiting ──────────────────────────────────────────────────
  private sendTimestamps: number[] = [];

  // ─── Public API ─────────────────────────────────────────────────────

  async start(opts: GroqSttOptions): Promise<void> {
    if (this.isActive) return;
    this.options = opts;
    this.resetVad();
    this.pcmRing = [];
    this.pcmRingLen = 0;
    this.speechBuffer = [];
    this.speechBufferLen = 0;
    this.sendTimestamps = [];

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });

      this.audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

      this.source = this.audioCtx.createMediaStreamSource(this.stream);

      // ScriptProcessorNode: producer — đẩy PCM vào ring buffer
      this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (evt) => {
        if (!this.isActive) return;
        const ch = evt.inputBuffer.getChannelData(0);
        const len = ch.length;
        const i16 = new Int16Array(len);
        for (let i = 0; i < len; i++) {
          const s = Math.max(-1, Math.min(1, ch[i]!));
          i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        this.pcmRing.push(i16);
        this.pcmRingLen += len;
      };

      this.source.connect(this.processor);
      // Không connect processor → destination (tránh feedback)

      this.isActive = true;

      // Frame timer: consumer — xử lý VAD mỗi 60ms
      this.frameTimer = setInterval(() => this.processFrame(), FRAME_MS);
    } catch (err) {
      this.isActive = false;
      this.cleanup();
      const e = err instanceof Error ? err : new Error(String(err));
      opts.onError?.(e);
      throw e;
    }
  }

  stop(): void {
    this.isActive = false;
    this.cleanup();
    // Auto-trigger nếu còn data
    if (this.speechBufferLen > 0 && !this.pipelineTriggered) {
      this.flushAndSend();
    }
  }

  get active(): boolean { return this.isActive; }

  // ─── VAD ────────────────────────────────────────────────────────────

  private resetVad(): void {
    this.noiseFloor = 200; // khởi tạo mức ồn nền phòng yên tĩnh
    this.speechThreshold = 500;
    this.silenceThreshold = 260;
    this.hasSpeech = false;
    this.speechFrames = 0;
    this.silenceFramesAfterSpeech = 0;
    this.baselineRMS = 0;
    this.jitter = 0;
    this.highRMSArmed = false;
    this.highRMSFrames = 0;
    this.postHighSilenceFrames = 0;
    this.lowRMSFrames = 0;
    this.totalFrames = 0;
    this.pipelineTriggered = false;
  }

  /**
   * Check VAD status for one PCM frame.
   * Returns: "speech" | "silence" | "silence_after_speech"
   */
  private checkVad(samples: Int16Array): 'speech' | 'silence' | 'silence_after_speech' {
    const rms = acRms(samples);

    // ── Noise floor tracking (EMA) ──────────────────────────────────
    // Freeze noise floor khi nghi ngờ có speech
    const isSpeechPossible = this.noiseFloor > 0 && rms > this.noiseFloor * 1.18 + 120;

    if (!isSpeechPossible && this.noiseFloor > 0) {
      // EMA: fall nhanh (alpha 0.06), rise chậm (alpha 0.015)
      const alpha = rms < this.noiseFloor ? 0.06 : 0.015;
      this.noiseFloor = this.noiseFloor + alpha * (rms - this.noiseFloor);
    } else if (this.noiseFloor === 0) {
      this.noiseFloor = rms;
    }

    // ── Dynamic thresholds ───────────────────────────────────────────
    this.speechThreshold = Math.max(500, this.noiseFloor * 1.18 + 120);
    this.silenceThreshold = Math.max(260, this.noiseFloor * 1.08 + 60);

    // ── Speech / Silence detection ───────────────────────────────────
    if (rms >= this.speechThreshold) {
      this.speechFrames = Math.min(this.speechFrames + 1, 50);
      this.silenceFramesAfterSpeech = 0;

      // Cần 8 frames (~480ms) để xác nhận speech
      if (this.speechFrames >= 8) {
        this.hasSpeech = true;
        return 'speech';
      }
      return 'silence';
    }

    if (rms < this.silenceThreshold) {
      if (this.hasSpeech) {
        this.silenceFramesAfterSpeech++;
        // 10+ frames silence sau speech → confirm end
        if (this.silenceFramesAfterSpeech >= 10) {
          return 'silence_after_speech';
        }
      }
      return 'silence';
    }

    // Ở giữa speech_threshold và silence_threshold: decrement
    if (!this.hasSpeech && this.speechFrames > 0) {
      this.speechFrames = Math.max(0, this.speechFrames - 1);
    }
    return 'silence';
  }

  // ─── Multi-trigger ─────────────────────────────────────────────────

  private processFrame(): void {
    if (!this.isActive || this.pipelineTriggered) return;

    // Lấy 1 frame từ ring buffer
    const frame = this.drainFrame();
    if (!frame) return;

    this.totalFrames++;

    // Lưu vào speech buffer (luôn, trigger sẽ quyết định có gửi hay ko)
    this.speechBuffer.push(frame);
    this.speechBufferLen += frame.length;

    // ── VAD ──────────────────────────────────────────────────────────
    const rms = acRms(frame);
    const vad = this.checkVad(frame);

    // ── Multi-trigger checks ─────────────────────────────────────────

    // 2a. High-RMS Spike
    this.baselineRMS += 0.02 * (rms - this.baselineRMS); // EMA baseline
    const curJitter = Math.abs(rms - this.baselineRMS);
    this.jitter += 0.05 * (curJitter - this.jitter);
    const adaptiveMargin = Math.max(500, Math.min(1500, this.jitter * 3.0));

    if (rms > this.baselineRMS + 3000) {
      this.highRMSFrames++;
      if (this.highRMSFrames >= 5) {
        this.highRMSArmed = true;
      }
    } else if (rms <= this.baselineRMS + adaptiveMargin) {
      if (this.highRMSArmed) {
        this.postHighSilenceFrames++;
        if (this.postHighSilenceFrames >= 8) {
          // Trigger: High-RMS spike → im trở lại
          this.fireTrigger('high_rms');
          return;
        }
      }
    } else {
      this.highRMSFrames = Math.max(0, this.highRMSFrames - 1);
    }

    // 2b. Low-RMS timeout
    if (this.hasSpeech && rms < Math.max(700, this.silenceThreshold + 80)) {
      this.lowRMSFrames++;
      if (this.lowRMSFrames >= 90) {
        this.fireTrigger('low_rms');
        return;
      }
    } else if (this.hasSpeech) {
      this.lowRMSFrames = 0;
    }

    // 2c. VAD silence_after_speech
    if (vad === 'silence_after_speech') {
      this.fireTrigger('vad_silence');
      return;
    }

    // 2d. Max utterance length
    if (this.hasSpeech && this.totalFrames >= 260) {
      this.fireTrigger('max_utterance');
      return;
    }

    // 2e. Idle timeout
    if (!this.hasSpeech && this.totalFrames >= 1000) {
      // Idle — reset buffer, giữ noise floor
      this.speechBuffer = [];
      this.speechBufferLen = 0;
      this.totalFrames = 0;
      return;
    }
  }

  // ─── Trigger ───────────────────────────────────────────────────────

  private fireTrigger(reason: string): void {
    if (this.pipelineTriggered) return;
    this.pipelineTriggered = true;

    console.log(`[GroqSTT] Trigger: ${reason} (speech=${this.speechBufferLen}b, frames=${this.totalFrames})`);

    this.flushAndSend();
  }

  private flushAndSend(): void {
    if (this.speechBufferLen < 3200) {
      // Quá ngắn (< 0.1s) — có thể là noise, reset mà ko gửi
      this.resetAfterPipeline();
      return;
    }

    // Trim max 30s
    let data = this.concatBuffer();
    const maxSamples = SAMPLE_RATE * 30;
    if (data.length > maxSamples) {
      data = data.subarray(data.length - maxSamples);
    }

    if (this.canSend()) {
      this.sendTimestamps.push(Date.now());
      const wav = encodeWav(data);
      this.send(wav);
    } else {
      this.resetAfterPipeline();
    }
  }

  private concatBuffer(): Int16Array {
    if (this.speechBuffer.length === 1) return this.speechBuffer[0]!;
    const total = this.speechBuffer.reduce((a, b) => a + b.length, 0);
    const merged = new Int16Array(total);
    let off = 0;
    for (const chunk of this.speechBuffer) {
      merged.set(chunk, off);
      off += chunk.length;
    }
    return merged;
  }

  // ─── Pipeline gate ─────────────────────────────────────────────────

  private resetAfterPipeline(): void {
    this.speechBuffer = [];
    this.speechBufferLen = 0;
    this.speechFrames = 0;
    this.silenceFramesAfterSpeech = 0;
    this.hasSpeech = false;
    this.highRMSArmed = false;
    this.highRMSFrames = 0;
    this.postHighSilenceFrames = 0;
    this.lowRMSFrames = 0;
    this.totalFrames = 0;

    // Cooldown 1.5s
    setTimeout(() => {
      this.pipelineTriggered = false;
    }, 1500);
  }

  // ─── Send ──────────────────────────────────────────────────────────

  private canSend(): boolean {
    const now = Date.now();
    this.sendTimestamps = this.sendTimestamps.filter(t => now - t < 60000);
    // Chỉ gửi tối đa 15 req/phút (dưới limit 20)
    return this.sendTimestamps.length < 15;
  }

  private async send(blob: Blob): Promise<void> {
    const { meetingId, speakerLabel, language, onTranscript, onError } = this.options!;
    const token = this.getToken();
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'audio.wav');
      fd.append('speakerLabel', speakerLabel);
      if (language) fd.append('language', language);

      const res = await fetch(
        `${API_BASE}/api/meetings/${meetingId}/stt/groq-transcribe`,
        {
          method: 'POST',
          headers: token ? { authorization: `Bearer ${token}` } : {},
          body: fd,
        },
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Groq (${res.status}): ${txt}`);
      }

      const json = (await res.json()) as { text?: string };
      const text = (json.text ?? '').trim();
      if (text) onTranscript(meetingId, text);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.resetAfterPipeline();
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private drainFrame(): Int16Array | null {
    if (this.pcmRingLen < FRAME_SAMPLES) return null;

    // Lấy đủ FRAME_SAMPLES từ ring buffer
    const result = new Int16Array(FRAME_SAMPLES);
    let offset = 0;
    while (offset < FRAME_SAMPLES && this.pcmRing.length > 0) {
      const chunk = this.pcmRing[0]!;
      const remaining = FRAME_SAMPLES - offset;
      if (chunk.length <= remaining) {
        result.set(chunk, offset);
        offset += chunk.length;
        this.pcmRing.shift();
        this.pcmRingLen -= chunk.length;
      } else {
        result.set(chunk.subarray(0, remaining), offset);
        this.pcmRing[0] = chunk.subarray(remaining);
        this.pcmRingLen -= remaining;
        offset = FRAME_SAMPLES;
      }
    }

    if (offset < FRAME_SAMPLES) return null; // không đủ data
    return result;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('trustroom_token');
  }

  private cleanup(): void {
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = null;
    }
    this.pcmRing = [];
    this.pcmRingLen = 0;
    this.speechBuffer = [];
    this.speechBufferLen = 0;
  }
}
