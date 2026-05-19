import type { CSSProperties } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow';

interface CustomEdgeData {
  relevance?: number;
  isSelected?: boolean;
  isHovered?: boolean;
  isFaded?: boolean;
  shouldShowLabel?: boolean;
}

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  data,
}: EdgeProps<CustomEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    curvature: 0.26,
  });

  const relevance = Math.max(0, Math.min(100, data?.relevance || 0));
  const ratio = relevance / 100;
  const isSelected = Boolean(data?.isSelected);
  const isHovered = Boolean(data?.isHovered);
  const isFaded = Boolean(data?.isFaded);
  const shouldAnimate = (isSelected || isHovered || relevance >= 84) && !isFaded;

  const tone =
    relevance >= 85 ? 'high' :
    relevance >= 65 ? 'medium' :
    'low';

  const strokeColor =
    tone === 'high' ? 'var(--edge-high)' :
    tone === 'medium' ? 'var(--edge-medium)' :
    'var(--edge-low)';

  const opacity = isFaded ? 0.06 : isSelected ? 1 : isHovered ? 0.92 : 0.16 + ratio * 0.72;
  const strokeWidth = isSelected ? 4.8 + ratio * 1.2 : isHovered ? 3.9 + ratio : 1.1 + ratio * 3.4;
  const haloWidth = strokeWidth + (isSelected ? 6 : isHovered ? 4 : 2.5);
  const haloOpacity = isFaded ? 0.02 : isSelected ? 0.34 : isHovered ? 0.22 : 0.06 + ratio * 0.14;

  const glow = tone === 'high'
    ? `drop-shadow(0 0 14px rgba(96,165,250,0.42))`
    : tone === 'medium'
      ? `drop-shadow(0 0 8px rgba(96,165,250,0.22))`
      : 'none';

  return (
    <>
      <path
        id={`${id}-interaction`}
        className="react-flow__edge-interaction"
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
      />

      <path
        d={edgePath}
        fill="none"
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth: haloWidth,
          opacity: haloOpacity,
          filter: 'blur(2px)',
          strokeLinecap: 'round',
        }}
      />

      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          opacity,
          filter: glow,
          strokeLinecap: 'round',
          transition: 'stroke 180ms ease, stroke-width 180ms ease, opacity 220ms ease, filter 180ms ease',
        }}
      />

      {shouldAnimate && (
        <path
          d={edgePath}
          fill="none"
          className="graph-edge-flow"
          style={{
            stroke: '#ffffff',
            strokeWidth: Math.max(1.2, strokeWidth - 1.8),
            opacity: isSelected ? 0.46 : 0.28,
            strokeDasharray: '10 18',
          }}
        />
      )}

      {data?.shouldShowLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              zIndex: 100,
            }}
            className="nodrag nopan"
          >
            <div
              className={`edge-score-badge edge-score-badge--${tone} ${isSelected ? 'edge-score-badge--selected' : ''}`}
              style={{ '--edge-score-fill': `${relevance}%` } as CSSProperties}
            >
              <span className="edge-score-badge__label">Similarity</span>
              <span className="edge-score-badge__value">
                {relevance}
                <span className="edge-score-badge__unit">%</span>
              </span>
              <span className="edge-score-badge__meter" />
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
