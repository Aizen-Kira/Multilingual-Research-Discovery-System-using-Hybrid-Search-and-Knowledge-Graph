import { Lightbulb, Sparkles, TrendingUp } from 'lucide-react';

interface GraphInsightsPanelProps {
  paperTitle?: string | null;
  citations?: number;
  totalNodes: number;
  focusMode: boolean;
  hasSelection: boolean;
}

export default function GraphInsightsPanel({
  paperTitle,
  citations,
  totalNodes,
  focusMode,
  hasSelection,
}: GraphInsightsPanelProps) {
  const hints = [
    citations && citations > 25
      ? 'This paper is highly cited and likely anchors a strong cluster.'
      : 'Try expanding this cluster to inspect adjacent supporting papers.',
    focusMode
      ? 'Focus Mode is active. The graph is isolating direct neighbors to reduce noise.'
      : 'Double click a node to enter Focus Mode and isolate the local neighborhood.',
    hasSelection
      ? `Use Ask AI or Compare to explore "${paperTitle || 'this paper'}" in more detail.`
      : `This graph currently shows ${totalNodes} visible papers. Start with the central cluster.`,
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
        <Sparkles className="h-4 w-4 text-[var(--text-accent)]" />
        Graph Insights
      </div>

      {hints.map((hint, index) => (
        <div
          key={hint}
          className="rounded-[1.2rem] border border-[var(--border-color)] bg-[var(--bg-elevated)] p-4 text-sm leading-7 text-[var(--text-secondary)]"
        >
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
            {index === 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <Lightbulb className="h-3.5 w-3.5" />}
            Insight {index + 1}
          </div>
          {hint}
        </div>
      ))}
    </section>
  );
}
