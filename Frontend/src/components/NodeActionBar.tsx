import { Bot, FileText, GitCompareArrows } from 'lucide-react';

interface NodeActionBarProps {
  visible: boolean;
  onAskAI: () => void;
  onSummarize: () => void;
  onCompare: () => void;
}

export default function NodeActionBar({
  visible,
  onAskAI,
  onSummarize,
  onCompare,
}: NodeActionBarProps) {
  if (!visible) return null;

  return (
    <div className="glass-panel absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[1.5rem] px-3 py-3 shadow-[var(--shadow-strong)]">
      <ActionButton icon={<Bot className="h-4 w-4" />} label="Ask AI" onClick={onAskAI} />
      <ActionButton icon={<FileText className="h-4 w-4" />} label="Summarize" onClick={onSummarize} />
      <ActionButton icon={<GitCompareArrows className="h-4 w-4" />} label="Compare" onClick={onCompare} />
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(37,99,235,0.28)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-accent)]"
    >
      {icon}
      {label}
    </button>
  );
}
