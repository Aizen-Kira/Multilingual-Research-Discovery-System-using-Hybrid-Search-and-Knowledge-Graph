import { ChevronRight } from 'lucide-react';

interface CollapsedSidebarProps {
  onExpand: () => void;
}

export default function CollapsedSidebar({ onExpand }: CollapsedSidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col items-center border-r border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-5">
      <button
        onClick={onExpand}
        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--bg-hover)]"
        title="Expand details panel"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </aside>
  );
}
