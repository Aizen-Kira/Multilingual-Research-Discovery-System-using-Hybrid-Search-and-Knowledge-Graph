import { X, Settings, LayoutDashboard, FileText, Users, HelpCircle } from 'lucide-react';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDashboard: () => void;
  onOpenSavedPapers: () => void;
  onOpenCollaborationHub: () => void;
  onOpenWorkspaceSettings: () => void;
  onOpenHelpSupport: () => void;
}

export default function SettingsDrawer({
  isOpen,
  onClose,
  onOpenDashboard,
  onOpenSavedPapers,
  onOpenCollaborationHub,
  onOpenWorkspaceSettings,
  onOpenHelpSupport,
}: SettingsDrawerProps) {
  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-[320px] transform border-r border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-strong)] backdrop-blur-xl transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] p-6">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              Workspace
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Menu</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={24} />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-4 py-6">
          <NavItem
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            active
            onClick={onOpenDashboard}
          />
          <NavItem
            icon={<FileText size={20} />}
            label="My Papers"
            onClick={onOpenSavedPapers}
          />
          <NavItem
            icon={<Users size={20} />}
            label="Collaborators"
            onClick={onOpenCollaborationHub}
          />

          <div className="pb-2 pt-6">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              System
            </p>
            <NavItem icon={<Settings size={20} />} label="Settings" onClick={onOpenWorkspaceSettings} />
            <NavItem icon={<HelpCircle size={20} />} label="Help & Support" onClick={onOpenHelpSupport} />
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium transition-colors ${
        active
          ? 'border-[rgba(37,99,235,0.2)] bg-[var(--primary-soft)] text-[var(--text-primary)]'
          : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
