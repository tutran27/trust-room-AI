# Speech-to-Speech Realtime Translation Pipeline Plan

## 1. Mục tiêu

Thiết kế pipeline speech-to-speech realtime cho TrustRoom/Agora meeting khi Agora hiện chỉ có STT, chưa có translate native.

Pipeline mục tiêu:

```txt
Agora audio
  -> Agora STT transcript
  -> stable transcript chunking
  -> VietAI/envit5-translation on CUDA
  -> Google Cloud Text-to-Speech
  -> audio normalize/compress
  -> playback / publish translated speech
```

Mục tiêu thực tế là **near-realtime speech-to-speech**, không phải simultaneous translation từng chữ. Vì model `VietAI/envit5-translation` là seq2seq text translation, nên cần nhận chunk đủ ổn định để dịch đúng nghĩa.

## 2. Quyết định kiến trúc

### 2.1. Thành phần chính

| Layer | Nhiệm vụ | Công nghệ |
|---|---|---|
| STT input | Nhận transcript realtime từ Agora | Existing Agora STT pipeline |
| Chunker | Gom partial/final transcript thành đoạn dịch ổn định | Backend service |
| Translator | Dịch VI <-> EN bằng GPU | `VietAI/envit5-translation`, PyTorch, CUDA |
| TTS | Convert translated text thành audio | Google Cloud Text-to-Speech |
| Audio post-process | Normalize loudness, peak limit, compressor | Python audio utils / ffmpeg / numpy |
| Realtime output | Gửi translated text + audio event về client | Socket.IO / REST pull / static audio URL |
| Playback | Phát audio dịch ở client hoặc publish lại vào Agora | Web Audio API / Agora custom audio track |

### 2.2. Vì sao tách service dịch/TTS riêng

Nên tách thành một service Python riêng thay vì nhét vào NestJS:

1. Model translation chạy PyTorch/CUDA tự nhiên hơn trong Python.
2. Dễ batch, warmup, quản lý VRAM.
3. Không làm API NestJS bị block khi model generate.
4. Có thể deploy riêng trên GPU machine.

NestJS vẫn giữ vai trò:

1. Auth/user/deal/meeting.
2. Nhận transcript event.
3. Forward job sang translation service.
4. Emit realtime event về frontend.

## 3. Flow chi tiết

### 3.1. Flow một câu nói

```txt
User A speaks Vietnamese
  -> Agora STT emits partial transcript
  -> backend stores partial but does not translate yet
  -> Agora STT emits final or stable segment
  -> chunker creates translation job
  -> translator outputs English text
  -> Google TTS generates English audio
  -> audio normalized
  -> backend emits:
       translated_transcript
       translated_audio_ready
  -> User B client plays English speech
```

### 3.2. Event model đề xuất

Socket events:

| Event | Direction | Payload |
|---|---|---|
| `meeting_transcript` | server -> client | raw transcript from Agora STT |
| `translation_job_created` | server -> client | job id, source text, target language |
| `translated_transcript` | server -> client | translated text, latency metadata |
| `translated_audio_ready` | server -> client | audio URL/base64/chunk id |
| `translation_error` | server -> client | reason, fallback state |

Payload mẫu:

```json
{
  "meetingId": "mtg_123",
  "speakerWallet": "wallet...",
  "sourceLang": "vi",
  "targetLang": "en",
  "sourceText": "Tôi đã gửi file rồi, bạn kiểm tra giúp tôi.",
  "translatedText": "I have sent the file, please check it for me.",
  "audioUrl": "/api/meetings/mtg_123/tts/job_456.mp3",
  "provider": "google",
  "latencyMs": {
    "chunking": 120,
    "translation": 180,
    "tts": 650,
    "total": 950
  }
}
```

## 4. Chunking strategy

Không dịch từng partial nhỏ vì sẽ:

1. Dịch sai ngữ cảnh.
2. Tốn TTS request.
3. Audio phát giật, lặp, khó nghe.

### 4.1. Khi nào tạo chunk

Tạo translation job khi một trong các điều kiện sau xảy ra:

| Điều kiện | Giá trị đề xuất |
|---|---:|
| STT final segment | tạo ngay |
| User im lặng | 500-800 ms |
| Chunk đủ dài | 8-18 từ |
| Có dấu kết câu | `.`, `?`, `!`, `ạ`, `nhé`, `rồi`, `xong` |
| Max chunk duration | 4-6 giây |

### 4.2. Debounce partial transcript

Partial transcript chỉ dùng để hiển thị realtime text, không gửi TTS.

Pseudo:

```ts
if (event.isFinal) {
  flushChunk();
} else {
  updatePartialBuffer(event.text);
  if (silenceMs > 700 || wordCount(buffer) >= 14) {
    flushChunk();
  }
}
```

### 4.3. De-dup transcript

STT realtime hay gửi lặp partial. Cần chống dịch lại cùng text:

1. Normalize text: lowercase, trim, collapse spaces.
2. Hash normalized text.
3. Nếu hash đã xử lý trong 30 giây gần nhất thì bỏ.
4. Nếu text mới chỉ là prefix của text cũ thì chờ final.

## 5. Translation service

### 5.1. Model

Model:

```txt
VietAI/envit5-translation
```

Input format:

```txt
vi: <Vietnamese text>
en: <English text>
```

Output cũng có prefix:

```txt
en: translated text
vi: translated text
```

Cần strip prefix trước khi gửi TTS.

### 5.2. Python dependencies

```bash
pip install torch transformers sentencepiece accelerate fastapi uvicorn pydantic
```

Nếu dùng CUDA:

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

Tùy GPU/driver có thể chọn CUDA wheel phù hợp.

### 5.3. Load model

```python
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

MODEL_NAME = "VietAI/envit5-translation"

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(
    MODEL_NAME,
    torch_dtype=torch.float16,
)
model.to("cuda")
model.eval()
```

### 5.4. Generate config ưu tiên latency

```python
GENERATION_CONFIG = {
    "max_new_tokens": 128,
    "num_beams": 1,
    "do_sample": False,
    "early_stopping": True,
}
```

Không dùng beam cao trong realtime vì latency tăng. Nếu cần chất lượng hơn, cho config:

```env
TRANSLATION_NUM_BEAMS=2
```

### 5.5. API service

Endpoint:

```txt
POST /translate
```

Request:

```json
{
  "text": "Tôi đã gửi file rồi.",
  "sourceLang": "vi",
  "targetLang": "en",
  "meetingId": "mtg_123",
  "speakerId": "wallet"
}
```

Response:

```json
{
  "translatedText": "I have sent the file.",
  "sourceLang": "vi",
  "targetLang": "en",
  "latencyMs": 184,
  "model": "VietAI/envit5-translation"
}
```

### 5.6. Batch strategy

Realtime mặc định xử lý từng job. Có thể micro-batch nếu nhiều người nói:

| Config | Giá trị |
|---|---:|
| Batch window | 20-50 ms |
| Max batch size | 4-8 |
| Timeout | 80 ms |

Nếu chỉ 1-2 speaker, không cần batch phức tạp.

## 6. Google TTS service

### 6.1. Auth

Không đưa Google key xuống frontend.

Khuyến nghị server-side:

```env
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/google-service-account.json
```

Hoặc nếu deploy container:

```env
GOOGLE_TTS_CREDENTIALS_JSON={"type":"service_account",...}
```

Nếu bạn chỉ có API key:

```env
GOOGLE_TTS_API_KEY=
```

Chỉ dùng API key ở backend và nên restrict key theo API/domain/IP. Production sạch hơn vẫn là service account.

### 6.2. Env cần giữ

```env
# Translation
TRANSLATION_MODEL=VietAI/envit5-translation
TRANSLATION_DEVICE=cuda
TRANSLATION_DTYPE=float16
TRANSLATION_MAX_NEW_TOKENS=128
TRANSLATION_NUM_BEAMS=1
TRANSLATION_BATCH_WINDOW_MS=40
TRANSLATION_MAX_BATCH_SIZE=4

# Google TTS auth
GOOGLE_APPLICATION_CREDENTIALS=
GOOGLE_TTS_CREDENTIALS_JSON=
GOOGLE_TTS_API_KEY=

# Google TTS voice
GOOGLE_TTS_VOICE_VI=vi-VN-Neural2-A
GOOGLE_TTS_VOICE_EN=en-US-Neural2-F
GOOGLE_TTS_SPEED_VI=0.96
GOOGLE_TTS_SPEED_EN=0.89
GOOGLE_TTS_AUDIO_ENCODING=MP3

# Edge TTS fallback
EDGE_TTS_ENABLED=true
EDGE_TTS_VOICE_VI=vi-VN-HoaiMyNeural
EDGE_TTS_VOICE_EN=en-US-JennyNeural
EDGE_TTS_RATE_VI=+0%
EDGE_TTS_RATE_EN=+0%

# Audio loudness
TTS_TARGET_RMS=9500
TTS_MAX_PEAK=30000
TTS_MAX_BOOST_DB=18
TTS_COMPRESSOR_THRESHOLD=0.70
TTS_COMPRESSOR_RATIO=3.0
TTS_SOFTCLIP_DRIVE=1.6
```

### 6.3. Env có thể bỏ nếu không dùng

Nếu dùng Google only:

```env
EDGE_TTS_*
```

có thể bỏ.

Nếu dùng service account:

```env
GOOGLE_TTS_API_KEY
```

có thể bỏ.

Nếu không làm audio post-process ngay:

```env
TTS_TARGET_RMS
TTS_MAX_PEAK
TTS_MAX_BOOST_DB
TTS_COMPRESSOR_THRESHOLD
TTS_COMPRESSOR_RATIO
TTS_SOFTCLIP_DRIVE
```

có thể giữ mặc định nhưng chưa cần expose UI.

## 7. Audio output strategy

Có 2 cách phát audio dịch:

### Option A - Client playback bằng audio URL

Backend tạo file MP3/WAV rồi emit URL cho client.

Ưu điểm:

1. Dễ làm.
2. Không cần custom audio track.
3. Ít rủi ro với Agora publish.

Nhược điểm:

1. Người nghe phải mở web client.
2. Audio dịch không thật sự là một Agora participant.

Flow:

```txt
Google TTS -> save mp3 -> emit audioUrl -> client plays via HTMLAudioElement/WebAudio
```

### Option B - Publish translated audio back into Agora

Tạo bot/virtual participant phát audio dịch vào Agora room.

Ưu điểm:

1. Người dùng nghe như một participant trong room.
2. Hợp với meeting speech-to-speech.

Nhược điểm:

1. Phức tạp hơn.
2. Cần custom audio source/track.
3. Cần xử lý echo/loopback để không bị STT nghe lại audio dịch.

Khuyến nghị:

1. MVP dùng Option A.
2. Phase 2 mới làm Option B.

## 8. Anti-loopback

Khi phát audio dịch trong cùng room, STT có thể nghe lại bản dịch và dịch vòng lặp.

Cần rule:

1. Gắn `speakerType=human` cho transcript từ mic thật.
2. Gắn `speakerType=translation_bot` cho audio TTS.
3. STT/translation pipeline bỏ qua transcript từ bot.
4. Nếu playback ở client, không feed playback audio vào mic.

Nếu publish bot vào Agora:

```txt
translation_bot audio must not enter STT subscription list
```

## 9. Latency budget

Target hợp lý:

| Stage | Target |
|---|---:|
| STT stable chunk | 500-1500 ms |
| Translation CUDA | 80-400 ms |
| Google TTS | 300-1200 ms |
| Audio normalize | 10-80 ms |
| Emit/playback | 50-200 ms |
| Total | 1.0-3.0 s |

Nếu tổng trên 3 giây, cần:

1. Giảm chunk length.
2. Dùng `num_beams=1`.
3. Cache TTS.
4. Dùng shorter audio encoding.
5. Chuyển Google TTS sang streaming nếu có API phù hợp trong phase sau.

## 10. Caching

### 10.1. Translation cache

Cache theo:

```txt
sourceLang + targetLang + normalizedText
```

TTL:

```txt
5-30 minutes
```

### 10.2. TTS cache

Cache theo:

```txt
targetLang + voiceName + speakingRate + translatedText
```

Lưu file:

```txt
storage/tts-cache/<hash>.mp3
```

Hoặc object storage nếu deploy production.

## 11. Backend integration với NestJS

### 11.1. Module mới

Tạo:

```txt
apps/api/src/translation/
  translation.module.ts
  translation.service.ts
  translation.controller.ts
  dto/
    translate.dto.ts
    synthesize.dto.ts
```

Nếu tách Python service, NestJS service chỉ là client:

```ts
class TranslationService {
  createJobFromTranscript(...)
  callTranslateService(...)
  callTtsService(...)
  emitTranslatedAudio(...)
}
```

### 11.2. Prisma models đề xuất

```prisma
model MeetingTranslationJob {
  id String @id @default(cuid())
  meetingId String
  transcriptId String?
  speakerWallet String?
  sourceLang String
  targetLang String
  sourceText String
  translatedText String?
  ttsProvider String?
  audioUrl String?
  status String @default("Pending")
  error String?
  latency Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([meetingId, createdAt])
  @@index([status])
}
```

Repo hiện đã có `MeetingTranslation`, có thể tận dụng thay vì thêm model mới nếu đủ field. Nếu cần track TTS/audio/status, thêm model job riêng sẽ rõ hơn.

### 11.3. Socket emit

Trong `WebsocketGateway` thêm helper:

```ts
emitMeetingTranslationAudio(meetingId: string, payload: Record<string, unknown>) {
  this.server.to(`meeting:${meetingId}`).emit('translated_audio_ready', {
    meetingId,
    ...payload,
    timestamp: new Date().toISOString(),
  });
}
```

## 12. Python translation/TTS service

### 12.1. Folder đề xuất

```txt
services/
  speech_translate/
    app/
      main.py
      config.py
      translator.py
      tts_google.py
      tts_edge.py
      audio_postprocess.py
      schemas.py
    requirements.txt
    Dockerfile
```

### 12.2. Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health` | check service/model loaded |
| `POST /translate` | text translation only |
| `POST /tts` | text to speech only |
| `POST /speech-translate` | translate + TTS in one request |

MVP nên dùng:

```txt
POST /speech-translate
```

Request:

```json
{
  "text": "Tôi muốn kiểm tra hợp đồng.",
  "sourceLang": "vi",
  "targetLang": "en",
  "voice": "en-US-Neural2-F",
  "speakingRate": 0.89
}
```

Response:

```json
{
  "translatedText": "I want to check the contract.",
  "audioContentBase64": "...",
  "audioEncoding": "MP3",
  "latencyMs": {
    "translation": 140,
    "tts": 620,
    "postprocess": 20,
    "total": 780
  }
}
```

For production, prefer `audioUrl` instead of huge base64 over websocket.

## 13. Frontend integration

### 13.1. UI controls

Trong meeting panel thêm:

| Control | Default |
|---|---|
| Translation enabled | true |
| My spoken language | auto / vi / en |
| Target language | opposite language |
| TTS provider | google |
| Playback volume | 80% |
| Mute original speaker while translation plays | false |

### 13.2. Playback queue

Không phát audio ngay nếu nhiều chunk tới liên tiếp gây đè tiếng.

Client cần queue:

```txt
translated_audio_ready events
  -> enqueue
  -> play one by one
  -> small gap 50-120ms
```

Nếu queue dài quá:

1. Drop stale audio older than 10s.
2. Keep translated text visible.
3. Show "translation delayed".

### 13.3. Caption UI

Hiển thị song song:

```txt
Speaker A:
  Original: Tôi đã gửi file rồi.
  EN: I have sent the file.
```

Nên show translated text trước, audio tới sau thì play.

## 14. Error handling

| Error | Fallback |
|---|---|
| CUDA OOM | reduce batch, clear cache, restart model worker |
| Translation timeout | emit translated text unavailable, skip TTS |
| Google TTS quota/network fail | fallback Edge TTS |
| Edge TTS fail | show text only |
| Audio post-process fail | use raw Google audio |
| Socket disconnect | persist job, client can refetch |

Timeout đề xuất:

```env
TRANSLATION_TIMEOUT_MS=3000
TTS_TIMEOUT_MS=5000
SPEECH_TRANSLATE_TIMEOUT_MS=7000
```

## 15. Security

1. Không expose Google TTS key/service account ra frontend.
2. Không commit `.env`.
3. Service account chỉ cấp quyền Text-to-Speech cần thiết.
4. Nếu dùng `GOOGLE_TTS_API_KEY`, restrict key theo API và backend IP/domain.
5. Validate text length trước khi gửi TTS để tránh cost spike.
6. Rate limit theo meeting/user.

Text limit đề xuất:

```txt
max chunk chars: 300
max chunks per speaker per minute: 30
max TTS seconds per meeting per hour: configurable
```

## 16. Cost control

1. Chỉ TTS final/stable chunk, không TTS partial.
2. Cache translation + TTS.
3. Drop duplicate chunks.
4. Có toggle tắt TTS, chỉ caption translation.
5. Log usage:

```txt
meetingId
speaker
source chars
translated chars
tts provider
audio duration
cost estimate
```

## 17. Development phases

### Phase 1 - Text translation caption

1. Nhận transcript từ Agora STT.
2. Chunk final/stable transcript.
3. Call Python translation service.
4. Emit `translated_transcript`.
5. UI hiển thị bilingual captions.

Pass khi:

```txt
VI speech -> VI transcript -> EN caption
EN speech -> EN transcript -> VI caption
```

### Phase 2 - Google TTS playback

1. Sau khi dịch, call Google TTS.
2. Save audio file/cache.
3. Emit `translated_audio_ready`.
4. Client playback queue phát audio.

Pass khi:

```txt
VI speech -> EN caption -> EN audio plays
EN speech -> VI caption -> VI audio plays
```

### Phase 3 - Fallback + audio post-process

1. Edge TTS fallback.
2. RMS normalize.
3. Peak limiter.
4. Compressor/softclip.

Pass khi:

```txt
Google fail -> Edge TTS works
audio loudness stable
no clipping
```

### Phase 4 - Publish translated speech into Agora

1. Create translation bot participant.
2. Publish custom audio track.
3. Avoid STT loopback.
4. Add per-user preference for hearing original vs translated.

Pass khi:

```txt
Remote users hear translated voice inside Agora room
STT does not re-translate bot audio
```

## 18. Test plan

### 18.1. Unit tests

Translator:

| Input | Expected |
|---|---|
| `vi: Xin chào, bạn khỏe không?` | output starts/means EN |
| `en: I sent the file.` | output starts/means VI |
| empty text | validation error |
| long text > max chars | validation error |

Chunker:

| Case | Expected |
|---|---|
| partial repeated | no duplicate job |
| final segment | flush |
| silence > 700ms | flush |
| 14 words | flush |

TTS:

| Case | Expected |
|---|---|
| targetLang `vi` | uses `GOOGLE_TTS_VOICE_VI` |
| targetLang `en` | uses `GOOGLE_TTS_VOICE_EN` |
| Google fail | Edge fallback |

### 18.2. Integration tests

1. Start Python service with CUDA.
2. Start NestJS API.
3. Send fake transcript event.
4. Assert `translated_transcript`.
5. Assert `translated_audio_ready`.
6. Assert cached second request is faster.

### 18.3. Manual QA

1. Join meeting with two users.
2. User A speaks Vietnamese.
3. User B sees English caption.
4. User B hears English TTS.
5. User B speaks English.
6. User A sees Vietnamese caption.
7. User A hears Vietnamese TTS.
8. Turn off Google key or force error.
9. Confirm Edge fallback or text-only fallback.
10. Speak fast for 30 seconds.
11. Confirm queue does not grow forever.

## 19. Run commands

Python service:

```bash
cd services/speech_translate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 4100
```

NestJS/web:

```bash
pnpm dev:api
pnpm dev:web
```

Validation:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Python tests:

```bash
pytest services/speech_translate/tests
```

## 20. Acceptance criteria

| Feature | Pass khi |
---|---|
| Translation service | Model load trên CUDA và `/health` trả ready. |
| VI -> EN | Vietnamese transcript tạo English translation. |
| EN -> VI | English transcript tạo Vietnamese translation. |
| Google TTS | Translation text tạo audio bằng đúng voice/rate. |
| Fallback | Google fail thì Edge TTS hoặc text-only không crash. |
| Realtime | Tổng latency trung bình dưới 3 giây cho chunk ngắn. |
| No duplicate | Partial transcript không tạo nhiều audio lặp. |
| Playback queue | Audio phát tuần tự, không chồng tiếng quá mức. |
| Security | Google key/service account chỉ nằm backend/server. |
| Cost control | Chỉ TTS stable/final chunks, có cache. |

## 21. Kết luận

Thiết kế hợp lý nhất hiện tại:

```txt
Agora STT
  -> backend chunker
  -> Python CUDA VietAI/envit5 translation service
  -> Google TTS server-side
  -> audio cache + normalize
  -> frontend playback queue
```

MVP nên làm theo thứ tự:

1. Text translation caption.
2. Google TTS playback.
3. Edge fallback + audio normalize.
4. Publish translated voice vào Agora như bot nếu thật sự cần speech output nằm trong room.

