import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';

export interface GraphNodeData {
  label: string;
  citationCount?: number;
  isSelected?: boolean;
  isRelated?: boolean;
  isHovered?: boolean;
  isHoverRelated?: boolean;
  isDimmed?: boolean;
  isFocusMode?: boolean;
  fullTitle?: string;
  original?: unknown;
  authors?: string;
  allAuthors?: string;
  source?: string;
  year?: string;
  relevanceScore?: number;
  nodeType?: 'query' | 'key' | 'related' | 'weak';
  radius?: number;
  qualityScore?: number | string;
  clusterColor?: string;
  language?: string;
  floatDuration?: number;
  floatDelay?: number;
  showCitations?: boolean;
}

function GraphNode({ data, isConnectable, selected }: NodeProps<GraphNodeData>) {
  const isSelected = selected || data.isSelected;
  const isRelated = data.isRelated || data.isHoverRelated;
  const isDimmed = data.isDimmed;
  const nodeType = data.nodeType || 'weak';
  const fullTitle = data.fullTitle || data.label || 'Unknown Paper';
  const quality = Number(data.qualityScore || 0.4);
  const relevance = Math.max(0, Math.min(100, data.relevanceScore || 0));
  const clusterAccent = data.clusterColor || 'var(--primary)';

  const glowStrength = isSelected ? 0.42 : nodeType === 'query' ? 0.24 : 0.12;
  const opacity = isDimmed ? 0.18 : nodeType === 'weak' ? 0.78 : 1;
  const ringInset = nodeType === 'query' ? '11%' : '13%';

  const background =
    nodeType === 'query'
      ? 'var(--node-query-bg)'
      : `radial-gradient(circle at 28% 22%, hsla(0, 0%, 100%, 0.15), transparent 16%), radial-gradient(circle at 70% 78%, hsla(221, 100%, 65%, ${0.05 + quality * 0.1}), transparent 22%), var(--node-bg-gradient)`;

  const borderColor =
    nodeType === 'query'
      ? 'var(--node-query-border)'
      : nodeType === 'key'
        ? 'hsla(215, 16%, 65%, 0.4)'
        : isRelated
          ? 'hsla(221, 100%, 65%, 0.5)'
          : 'var(--node-border-default)';

  return (
    <div
      className="graph-node relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full p-4 text-center"
      style={{
        opacity,
        background,
        border: `1.5px solid ${borderColor}`,
        boxShadow:
          nodeType === 'query'
            ? `0 0 0 1px hsla(0, 0%, 100%, 0.05), var(--shadow-strong), 0 0 34px var(--node-query-glow)`
            : `0 0 0 1px hsla(0, 0%, 100%, 0.03), var(--shadow-soft), 0 0 28px hsla(221, 100%, 65%, ${glowStrength * 0.5})`,
        backdropFilter: 'blur(18px)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            nodeType === 'query'
              ? 'radial-gradient(circle at center, var(--node-query-halo) 0%, transparent 62%)'
              : `radial-gradient(circle at center, hsla(221, 100%, 65%, ${glowStrength * 0.4}) 0%, transparent 62%)`,
          filter: 'blur(18px)',
          transform: 'scale(1.06)',
        }}
      />
      <div
        className="pointer-events-none absolute rounded-full border border-white/10"
        style={{ inset: ringInset }}
      />
      <div
        className="pointer-events-none absolute rounded-full border border-white/5"
        style={{ inset: '18%' }}
      />
      <div
        className="pointer-events-none absolute inset-[6%] rounded-full opacity-70"
        style={{
          background: `linear-gradient(145deg, hsla(0, 0%, 100%, 0.1), transparent 46%)`,
        }}
      />

      {data.clusterColor && (
        <div
          className="pointer-events-none absolute left-1/2 top-3 h-1.5 w-18 -translate-x-1/2 rounded-full opacity-80"
          style={{
            width: '42%',
            background: `linear-gradient(90deg, transparent, ${clusterAccent}, transparent)`,
          }}
        />
      )}

      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="opacity-0" />

      <div className="pointer-events-none relative z-10 flex h-full w-full flex-col items-center justify-center overflow-hidden">
        <div className="w-full px-5 text-center text-[18px] font-bold leading-[1.14] tracking-[-0.03em] text-[var(--text-primary)] line-clamp-3">
          {fullTitle}
        </div>

        <div className="mt-3 w-full px-4 text-center">
          <div className="mx-auto max-w-[82%] truncate text-[13px] leading-[1.25] text-[var(--text-secondary)]">
            {data.authors}
          </div>

          <div
            className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[11px] leading-tight text-[var(--text-tertiary)]"
            style={{
              border: '1px solid var(--node-meta-chip-border)',
              background: 'var(--node-meta-chip-bg)',
            }}
          >
            <span>{data.year || 'Unknown Year'}</span>
            {data.showCitations && (
              <>
                <span className="h-1 w-1 rounded-full bg-[var(--text-tertiary)]" />
                <span>{data.citationCount || 0} cites</span>
              </>
            )}
          </div>

          {isSelected && (
            <div
              className="mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-accent)]"
              style={{
                border: '1px solid color-mix(in srgb, var(--primary) 28%, transparent)',
                background: 'var(--node-query-chip-bg)',
              }}
            >
              {relevance}% relevant
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(GraphNode);
