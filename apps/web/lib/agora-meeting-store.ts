/**
 * Global Agora meeting store — singleton that persists across route navigations.
 *
 * The Agora RTC client, local tracks, and connection state live here so that
 * navigating away from /meetings/[id] does NOT drop the call.
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

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

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
const listeners = new Set<Listener>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emit() {
  for (const fn of listeners) fn();
}

function setState(partial: Partial<AgoraMeetingState>) {
  state = { ...state, ...partial };
  emit();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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

/**
 * Join an Agora meeting. If already connected to the same meeting, this is a
 * no-op (the UI will just re-attach video elements).
 */
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

  // Already connected to this meeting — skip
  if (state.meetingId === meetingId && state.status === 'connected') {
    return;
  }

  // Already connected to a DIFFERENT meeting — leave first
  if (state.meetingId && state.meetingId !== meetingId) {
    await leaveAgoraMeeting();
  }

  setState({ meetingId, status: 'connecting', error: null });
  params.onTransportState?.({ status: 'waiting' });

  try {
    const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

    const c = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    client = c;

    // --- Event handlers ---

    c.on('user-published', async (user: any, mediaType: 'audio' | 'video') => {
      await c.subscribe(user, mediaType);
      remoteUsers.set(String(user.uid), user);

      if (mediaType === 'audio' && user.audioTrack) {
        user.audioTrack.play();
      }
      // Video playing is handled by the UI component reading remoteUsers
      emit();
    });

    c.on('user-unpublished', (user: any, mediaType: 'audio' | 'video') => {
      const key = String(user.uid);
      if (mediaType === 'video') {
        user.videoTrack?.stop();
      }
      const u = remoteUsers.get(key);
      if (u) {
        if (mediaType === 'audio') u.hasAudio = false;
        if (mediaType === 'video') u.hasVideo = false;
      }
      emit();
    });

    c.on('user-left', (user: any) => {
      const key = String(user.uid);
      remoteUsers.delete(key);
      emit();
    });

    c.on('stream-message', async (remoteUid: string | number, payload: Uint8Array) => {
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

    // --- Join channel ---
    await c.join(appId, meetingId, token, uid);
    joinedChannel = true;
    c.enableAudioVolumeIndicator();

    // --- Create local tracks ---
    let micTrack: any = null;
    let camTrack: any = null;

    try {
      micTrack = await AgoraRTC.createMicrophoneAudioTrack();
    } catch {
      // No mic — continue without
    }

    try {
      camTrack = await AgoraRTC.createCameraVideoTrack();
    } catch {
      // No camera — continue without
    }

    localAudioTrack = micTrack;
    localVideoTrack = camTrack;

    const tracks = [micTrack, camTrack].filter(Boolean);
    if (tracks.length > 0) {
      await c.publish(tracks);
    }

    setState({
      status: 'connected',
      micEnabled: Boolean(micTrack),
      camEnabled: Boolean(camTrack),
    });

    params.onTransportState?.({ status: 'receiving' });
  } catch (err) {
    setState({
      status: 'error',
      error: err instanceof Error ? err.message : 'Không thể tham gia Agora RTC.',
    });
  }
}

/**
 * Leave the current Agora meeting and clean up all resources.
 */
export async function leaveAgoraMeeting() {
  try {
    localAudioTrack?.stop();
    localAudioTrack?.close();
    localVideoTrack?.stop();
    localVideoTrack?.close();
    if (client && joinedChannel) {
      await client.leave();
    }
  } catch {
    // ignore cleanup failures
  } finally {
    client = null;
    localAudioTrack = null;
    localVideoTrack = null;
    remoteUsers.clear();
    joinedChannel = false;
    setState({
      meetingId: null,
      status: 'idle',
      error: null,
      micEnabled: true,
      camEnabled: true,
    });
  }
}

export async function toggleAgoraMic(): Promise<boolean> {
  if (!localAudioTrack) return false;
  const next = !(state.micEnabled);
  await localAudioTrack.setEnabled(next);
  setState({ micEnabled: next });
  return next;
}

export async function toggleAgoraCam(): Promise<boolean> {
  if (!localVideoTrack) return false;
  const next = !(state.camEnabled);
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
