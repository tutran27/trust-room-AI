'use client';

import { useEffect, useSyncExternalStore, useCallback } from 'react';
import {
  getAgoraMeetingState,
  subscribeAgoraMeeting,
  joinAgoraMeeting,
  leaveAgoraMeeting,
  toggleAgoraMic,
  toggleAgoraCam,
  getAgoraClient,
  getLocalAudioTrack,
  getLocalVideoTrack,
  getRemoteUsers,
  playRemoteVideo,
  getRemoteParticipantList,
  type AgoraMeetingState,
} from '../lib/agora-meeting-store';

/**
 * React hook that exposes the global Agora meeting singleton.
 *
 * `useSyncExternalStore` guarantees that components re-render when the
 * global meeting state changes, without requiring Context.
 */
export function useAgoraMeeting() {
  const state = useSyncExternalStore(
    subscribeAgoraMeeting,
    getAgoraMeetingState,
    getAgoraMeetingState, // SSR snapshot (same)
  );

  const join = useCallback(
    (params: {
      meetingId: string;
      appId: string;
      token: string;
      uid: number;
      sttPusherUid?: number | null;
      onTranscript?: (chunk: any) => void;
      onTransportState?: (s: { status: string; detail?: string }) => void;
    }) => joinAgoraMeeting(params),
    [],
  );

  const leave = useCallback(() => leaveAgoraMeeting(), []);
  const toggleMic = useCallback(() => toggleAgoraMic(), []);
  const toggleCam = useCallback(() => toggleAgoraCam(), []);

  return {
    ...state,
    join,
    leave,
    toggleMic,
    toggleCam,
    getClient: getAgoraClient,
    getLocalAudioTrack,
    getLocalVideoTrack,
    getRemoteUsers,
    playRemoteVideo,
    getRemoteParticipants: getRemoteParticipantList,
  };
}
