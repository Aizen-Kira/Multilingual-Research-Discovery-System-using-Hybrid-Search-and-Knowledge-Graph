import { ChevronDown, ChevronUp, RotateCcw, SlidersHorizontal } from 'lucide-react';

interface GraphControlsPanelProps {
  threshold: number;
  setThreshold: (val: number) => void;
  maxNodes: number;
  setMaxNodes: (val: number) => void;
  showKeyPapers: boolean;
  setShowKeyPapers: (val: boolean) => void;
  showClusters: boolean;
  setShowClusters: (val: boolean) => void;
  showCitations: boolean;
  setShowCitations: (val: boolean) => void;
  onResetLayout: () => void;
  embedded?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function GraphControlsPanel({
  threshold,
  setThreshold,
  maxNodes,
  setMaxNodes,
  showKeyPapers,
  setShowKeyPapers,
  showClusters,
  setShowClusters,
  showCitations,
  setShowCitations,
  onResetLayout,
  embedded = false,
  collapsed = false,
  onToggleCollapse,
}: GraphControlsPanelProps) {
  const wrapperClass = embedded
    ? 'space-y-4'
    : 'glass-panel absolute bottom-6 left-6 z-50 w-[300px] rounded-[1.5rem] p-4 text-xs text-[var(--text-secondary)]';

  if (collapsed) {
    return (
      <div className={wrapperClass}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 pl-1">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-[var(--text-accent)]" />
              <h3 className="truncate text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-primary)]">
                Graph Controls
              </h3>
            </div>
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand graph controls"
              className="flex h-10 min-w-[92px] shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              <ChevronUp className="h-4 w-4" />
              Show
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 pl-1">
          <SlidersHorizontal className="h-4 w-4 text-[var(--text-accent)]" />
          <h3 className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-primary)]">
            Graph Controls
          </h3>
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            <ChevronDown className="h-4 w-4" />
            Hide
          </button>
        )}
      </div>

      <>
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <label className="mb-2 flex items-center justify-between font-semibold text-[var(--text-primary)]">
          <span>Similarity Threshold</span>
          <span className="text-[var(--text-accent)]">{threshold}%</span>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
        />
        <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
          Keep only connections at or above this relationship score.
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <div className="mb-3 font-semibold text-[var(--text-primary)]">Display Logic</div>
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showClusters}
              onChange={(e) => setShowClusters(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            Color community clusters
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCitations}
              onChange={(e) => setShowCitations(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            Emphasize citation cues
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showKeyPapers}
              onChange={(e) => setShowKeyPapers(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            Show only key papers
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <label className="mb-2 flex items-center justify-between font-semibold text-[var(--text-primary)]">
          <span>Node Density</span>
          <span className="text-[var(--text-accent)]">{maxNodes}</span>
        </label>
        <input
          type="range"
          min="10"
          max="150"
          value={maxNodes}
          onChange={(e) => setMaxNodes(Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
        />
        <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
          Control how much of the network remains visible at once.
        </div>
      </section>

      <button
        onClick={onResetLayout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] py-3 font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
      >
        <RotateCcw className="h-4 w-4" />
        Reset Layout
      </button>
      </>
    </div>
  );
}
