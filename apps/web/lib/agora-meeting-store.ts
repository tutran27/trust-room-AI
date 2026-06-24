/**
 * Global Agora meeting store that persists across route navigations.
 *
 * The Agora RTC client, local tracks, and connection state live here so that
 * navigating away from /meetings/[id] does not drop the call.
 * Only an explicit leaveMeeting() call tears down the connection.
 */

type MeetingStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'unsupported';

export interface AgoraMeetingState {
  meetingId: string | null;
  status: MeetingStatus;
  error: string | null;
  micEnabled: boolean;
  camEnabled: boolean;
}

type Listener = () => void;

let state: AgoraMeetingState = {
  meetingId: null,
  status: 'idle',
  error: null,
  micEnabled: true,
  camEnabled: true,
};

let client: any = null;
let localAudioTrack: any = null;
let localVideoTrack: any = null;
let remoteUsers = new Map<string, any>();
let joinedChannel = false;
let activeJoinAttempt = 0;
/** Holds the denoiser handle so we can disable it on leave */
let denoiserHandle: { leave(): void } | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

function setState(partial: Partial<AgoraMeetingState>) {
  state = { ...state, ...partial };
  emit();
}

async function hasMediaDevice(kind: MediaDeviceKind) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return false;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((device) => device.kind === kind);
  } catch {
    return false;
  }
}

async function cleanupAgoraResources() {
  const currentClient = client;
  const currentAudioTrack = localAudioTrack;
  const currentVideoTrack = localVideoTrack;
  const currentDenoiser = denoiserHandle;

  client = null;
  localAudioTrack = null;
  localVideoTrack = null;
  denoiserHandle = null;
  remoteUsers.clear();
  joinedChannel = false;

  // Cleanup denoiser first (disconnect from track pipeline)
  try {
    currentDenoiser?.leave();
  } catch {}

  try {
    currentAudioTrack?.stop();
    currentAudioTrack?.close();
  } catch {}

  try {
    currentVideoTrack?.stop();
    currentVideoTrack?.close();
  } catch {}

  if (currentClient) {
    try {
      await currentClient.leave();
    } catch {
      // ignore cleanup failures
    }
  }
}

export function getAgoraMeetingState(): AgoraMeetingState {
  return state;
}

export function subscribeAgoraMeeting(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getAgoraClient() {
  return client;
}

export function getLocalAudioTrack() {
  return localAudioTrack;
}

export function getLocalVideoTrack() {
  return localVideoTrack;
}

export function getRemoteUsers() {
  return remoteUsers;
}

export async function joinAgoraMeeting(params: {
  meetingId: string;
  appId: string;
  token: string;
  uid: number;
  sttPusherUid?: number | null;
  onTranscript?: (chunk: any) => void;
  onTransportState?: (s: { status: string; detail?: string }) => void;
}) {
  const { meetingId, appId, token, uid } = params;

  if (state.meetingId === meetingId && state.status === 'connecting') {
    return;
  }

  const joinAttempt = ++activeJoinAttempt;

  if (state.meetingId === meetingId && state.status === 'connected') {
    return;
  }

  if (state.meetingId && state.meetingId !== meetingId) {
    await leaveAgoraMeeting();
  }

  if (client && state.meetingId === meetingId) {
    await cleanupAgoraResources();
  }

  setState({ meetingId, status: 'connecting', error: null });
  params.onTransportState?.({ status: 'waiting' });

  try {
    const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

    const nextClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    client = nextClient;

    nextClient.on('user-published', async (user: any, mediaType: 'audio' | 'video') => {
      await nextClient.subscribe(user, mediaType);
      remoteUsers.set(String(user.uid), user);

      if (mediaType === 'audio' && user.audioTrack) {
        user.audioTrack.play();
      }

      emit();
    });

    nextClient.on('user-unpublished', (user: any, mediaType: 'audio' | 'video') => {
      const key = String(user.uid);
      if (mediaType === 'video') {
        user.videoTrack?.stop();
      }
      const existingUser = remoteUsers.get(key);
      if (existingUser) {
        if (mediaType === 'audio') existingUser.hasAudio = false;
        if (mediaType === 'video') existingUser.hasVideo = false;
      }
      emit();
    });

    nextClient.on('user-left', (user: any) => {
      remoteUsers.delete(String(user.uid));
      emit();
    });

    nextClient.on('stream-message', async (_remoteUid: string | number, payload: Uint8Array) => {
      if (!params.onTranscript) return;
      try {
        const { decodeAgoraSttPayload } = await import('./agora-stt');
        const chunks = await decodeAgoraSttPayload(payload);
        for (const chunk of chunks) {
          params.onTranscript?.(chunk);
        }
      } catch (err) {
        params.onTransportState?.({
          status: 'warning',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    });

    await nextClient.join(appId, meetingId, token, uid);

    if (joinAttempt !== activeJoinAttempt) {
      await nextClient.leave();
      return;
    }

    joinedChannel = true;
    nextClient.enableAudioVolumeIndicator();

    let micTrack: any = null;
    let camTrack: any = null;

    // Use the noise-suppression helper for microphone track with AEC/ANS/AGC + AI Denoiser
    try {
      const { createMicrophoneAudioTrack } = await import('./agora/audio-track');
      const result = await createMicrophoneAudioTrack();
      micTrack = result.track;
      denoiserHandle = { leave: result.leave };
    } catch {
      // Fallback: create with bare built-in constraints
      try {
        micTrack = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
          AGC: true,
        });
      } catch {}
    }

    if (await hasMediaDevice('videoinput')) {
      try {
        camTrack = await AgoraRTC.createCameraVideoTrack();
      } catch {}
    }

    localAudioTrack = micTrack;
    localVideoTrack = camTrack;

    const tracks = [micTrack, camTrack].filter(Boolean);
    if (tracks.length > 0) {
      await nextClient.publish(tracks);
    }

    setState({
      meetingId,
      status: 'connected',
      error: null,
      micEnabled: Boolean(micTrack),
      camEnabled: Boolean(camTrack),
    });

    params.onTransportState?.({ status: 'receiving' });
  } catch (err) {
    await cleanupAgoraResources();
    setState({
      meetingId,
      status: 'error',
      error:
        err instanceof Error && err.message.includes('UID_CONFLICT')
          ? 'UID Agora bị trùng với một phiên khác trong cùng room. Hãy đóng tab meeting cũ hoặc tải lại để nhận UID mới.'
          : err instanceof Error
            ? err.message
            : 'Khong the tham gia Agora RTC.',
    });
  }
}

export async function leaveAgoraMeeting() {
  activeJoinAttempt += 1;
  await cleanupAgoraResources();
  setState({
    meetingId: null,
    status: 'idle',
    error: null,
    micEnabled: true,
    camEnabled: true,
  });
}

export async function toggleAgoraMic(): Promise<boolean> {
  if (!localAudioTrack) return false;
  const next = !state.micEnabled;
  await localAudioTrack.setEnabled(next);
  setState({ micEnabled: next });
  return next;
}

export async function toggleAgoraCam(): Promise<boolean> {
  if (!localVideoTrack) return false;
  const next = !state.camEnabled;
  await localVideoTrack.setEnabled(next);
  setState({ camEnabled: next });
  return next;
}

export function playRemoteVideo(uid: string, container: HTMLDivElement) {
  const user = remoteUsers.get(uid);
  if (user?.videoTrack) {
    user.videoTrack.play(container);
  }
}

export function getRemoteParticipantList(): Array<{ uid: string; hasAudio: boolean; hasVideo: boolean }> {
  const list: Array<{ uid: string; hasAudio: boolean; hasVideo: boolean }> = [];
  for (const [uid, user] of remoteUsers) {
    list.push({
      uid,
      hasAudio: Boolean(user.hasAudio),
      hasVideo: Boolean(user.hasVideo),
    });
  }
  return list;
}
