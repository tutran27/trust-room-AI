'use client';

import * as React from 'react';
import { cn } from './cn.js';

export interface ModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Called when the user requests to close (overlay click or Escape). */
  onClose: () => void;
  /** Optional title rendered in the modal header. */
  title?: string;
  /** Modal body content. */
  children?: React.ReactNode;
  /** Extra classes for the content panel. */
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-slate-800/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl',
          className,
        )}
      >
        {title ? (
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ) : null}
        <div className="px-6 py-4 text-slate-700">{children}</div>
      </div>
    </div>
  );
}
Modal.displayName = 'Modal';
