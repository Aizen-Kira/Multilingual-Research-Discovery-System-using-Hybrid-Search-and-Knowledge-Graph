import { Bell, CheckCheck, Info, Sparkles, X } from 'lucide-react';

export interface WorkspaceNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  unread?: boolean;
  kind?: 'search' | 'system' | 'collaboration';
}

interface NotificationsWindowProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: WorkspaceNotification[];
  onMarkAllRead: () => void;
}

const iconByKind = {
  search: Sparkles,
  system: Info,
  collaboration: Bell,
} as const;

export default function NotificationsWindow({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
}: NotificationsWindowProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-panel max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-[2rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-5">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              Notifications
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              Workspace activity
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              <CheckCheck className="h-4 w-4 text-[var(--text-accent)]" />
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar max-h-[calc(80vh-88px)] overflow-y-auto p-5">
          {notifications.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.7rem] border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-8 text-center">
              <Bell className="mb-4 h-10 w-10 text-[var(--text-secondary)]" />
              <h3 className="mb-2 text-xl font-semibold text-[var(--text-primary)]">No notifications yet</h3>
              <p className="max-w-md text-sm leading-7 text-[var(--text-secondary)]">
                Search activity, collaboration updates, and workspace alerts will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const Icon = iconByKind[notification.kind || 'system'];

                return (
                  <article
                    key={notification.id}
                    className={`rounded-[1.6rem] border px-4 py-4 transition-colors ${
                      notification.unread
                        ? 'border-[rgba(37,99,235,0.24)] bg-[var(--primary-soft)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface)]'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-input)] text-[var(--text-accent)]">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-start justify-between gap-4">
                          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                            {notification.title}
                          </h3>
                          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                            {notification.time}
                          </span>
                        </div>
                        <p className="text-sm leading-7 text-[var(--text-secondary)]">
                          {notification.description}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
