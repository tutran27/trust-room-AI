'use client';

import Link from 'next/link';
import { Badge } from '@trustroom/ui';
import { useAgoraMeeting } from '../hooks/use-agora-meeting';

/**
 * Floating bar that appears at the bottom-right when the user is in an active
 * Agora meeting but has navigated away from the /meetings/[id] page.
 * Clicking it takes the user back to the meeting room.
 */
export function FloatingMeetingBar() {
  const { meetingId, status } = useAgoraMeeting();

  // Only show when connected to a meeting and NOT on the meeting page itself
  if (!meetingId || status !== 'connected') return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <Link href={`/meetings/${meetingId}`}>
        <div className="group flex items-center gap-3 rounded-2xl border border-brand-200 bg-white px-4 py-3 shadow-lg shadow-surface-200/50 backdrop-blur-xl transition-all duration-200 hover:border-brand-300 hover:shadow-lg">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-surface-800 group-hover:text-brand-600 transition-colors">
              Đang trong meeting
            </span>
            <span className="text-[11px] text-surface-500">
              Nhấn để quay lại phòng
            </span>
          </div>
          <Badge variant="success" className="ml-1">live</Badge>
        </div>
      </Link>
    </div>
  );
}
