import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface WorkspaceActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export default function WorkspaceActionDialog({
  isOpen,
  onClose,
  eyebrow,
  title,
  description,
  children,
}: WorkspaceActionDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-2xl rounded-[2rem] border border-[var(--border-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] px-6 py-5">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              {eyebrow}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--text-secondary)]">{description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
