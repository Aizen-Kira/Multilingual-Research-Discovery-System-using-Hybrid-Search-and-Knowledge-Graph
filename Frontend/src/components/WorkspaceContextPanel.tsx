import { Bot, Expand, FileText, GitCompareArrows, Sparkles } from 'lucide-react';
import GraphControlsPanel from './GraphControlsPanel';
import GraphInsightsPanel from './GraphInsightsPanel';

interface PaperData {
  title: string;
  authors: string;
  source: string;
  abstract: string;
  keywords: string[];
  quality_score?: number;
  research_domain?: string;
  key_findings?: string[];
  citations?: number;
  language?: string;
}

interface WorkspaceContextPanelProps {
  paper: PaperData | null;
  status: 'idle' | 'searching' | 'enriching' | 'complete' | 'error';
  totalNodes: number;
  focusMode: boolean;
  onOpenLLM: () => void;
  onCompare: () => void;
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
}

export default function WorkspaceContextPanel({
  paper,
  status,
  totalNodes,
  focusMode,
  onOpenLLM,
  onCompare,
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
}: WorkspaceContextPanelProps) {
  return (
    <aside className="workspace-context-panel custom-scrollbar h-full w-[380px] shrink-0 overflow-y-auto border-l border-[var(--border-color)] bg-[var(--bg-panel)] px-5 py-5">
      <div className="mb-5 rounded-[1.7rem] border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              Context
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              {paper ? 'Selected Paper' : 'Graph Context'}
            </h2>
          </div>
          <div className="soft-chip rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]">
            {status === 'complete' ? 'Ready' : status}
          </div>
        </div>

        {paper ? (
          <div className="rounded-[1.3rem] border border-[var(--border-color)] bg-[var(--bg-elevated)] p-4">
            <div className="mb-2 line-clamp-2 text-base font-semibold leading-6 text-[var(--text-primary)]">
              {paper.title}
            </div>
            <div className="mb-3 text-sm leading-6 text-[var(--text-secondary)]">{paper.authors}</div>
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="soft-chip rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]">
                {paper.source}
              </span>
              <span className="rounded-full border border-[var(--border-color)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                {paper.citations || 0} cites
              </span>
            </div>
            <p className="line-clamp-6 text-sm leading-7 text-[var(--text-secondary)]">
              {paper.abstract}
            </p>
          </div>
        ) : (
          <div className="rounded-[1.3rem] border border-[var(--border-color)] bg-[var(--bg-elevated)] p-4 text-sm leading-7 text-[var(--text-secondary)]">
            Select a node to bring paper details, AI actions, and cluster guidance into this panel.
          </div>
        )}
      </div>

      <div className="mb-5 rounded-[1.7rem] border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
          <Sparkles className="h-4 w-4 text-[var(--text-accent)]" />
          Context Actions
        </div>
        <div className="grid gap-3">
          <ActionButton icon={<Bot className="h-4 w-4" />} label="Ask AI" description="Open the research copilot for the active paper." onClick={onOpenLLM} />
          <ActionButton icon={<FileText className="h-4 w-4" />} label="Summarize Paper" description="Generate a concise summary of the selected paper." onClick={onOpenLLM} />
          <ActionButton icon={<GitCompareArrows className="h-4 w-4" />} label="Compare Papers" description="Open saved papers and line up relevant comparisons." onClick={onCompare} />
          <ActionButton icon={<Expand className="h-4 w-4" />} label="Focus Cluster" description="Double click a node in the graph to isolate its direct neighborhood." />
        </div>
      </div>

      <div className="mb-5 rounded-[1.7rem] border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft)]">
        <GraphInsightsPanel
          paperTitle={paper?.title || null}
          citations={paper?.citations}
          totalNodes={totalNodes}
          focusMode={focusMode}
          hasSelection={Boolean(paper)}
        />
      </div>

      <div className="rounded-[1.7rem] border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-soft)]">
        <GraphControlsPanel
          embedded
          threshold={threshold}
          setThreshold={setThreshold}
          maxNodes={maxNodes}
          setMaxNodes={setMaxNodes}
          showKeyPapers={showKeyPapers}
          setShowKeyPapers={setShowKeyPapers}
          showClusters={showClusters}
          setShowClusters={setShowClusters}
          showCitations={showCitations}
          setShowCitations={setShowCitations}
          onResetLayout={onResetLayout}
        />
      </div>
    </aside>
  );
}

function ActionButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 rounded-[1.2rem] border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(37,99,235,0.28)] hover:bg-[var(--bg-hover)]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--text-accent)]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
        <div className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">{description}</div>
      </div>
    </button>
  );
}
