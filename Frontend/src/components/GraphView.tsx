import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeMouseHandler,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force';
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import { Check, Search as SearchIcon, SlidersHorizontal, Sparkles } from 'lucide-react';

import type { GraphData, GraphNode as APIGraphNode } from '../api/client';
import GraphNode from './GraphNode';
import CustomEdge from './CustomEdge';
import GraphControlsPanel from './GraphControlsPanel';

export interface PaperData {
  title: string;
  authors: string;
  source: string;
  abstract: string;
  keywords: string[];
  quality_score?: number;
  research_domain?: string;
  key_findings?: string[];
  related_papers?: { id: string; title: string }[];
  methodology?: string;
  innovations?: string[];
  contributions?: string[];
  limitations?: string[];
  citations?: number;
  language?: string;
}

interface GraphViewProps {
  onNodeClick: (data: PaperData) => void;
  theme?: 'light' | 'dark';
  data?: GraphData | null;
  threshold: number;
  maxNodes: number;
  showKeyPapers: boolean;
  showClusters: boolean;
  showCitations: boolean;
  resetViewportKey: number;
  setThreshold: (val: number) => void;
  setMaxNodes: (val: number) => void;
  setShowKeyPapers: (val: boolean) => void;
  setShowClusters: (val: boolean) => void;
  setShowCitations: (val: boolean) => void;
  onResetLayout: () => void;
}

const proOptions = { hideAttribution: true };

const arraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const extractResearchDomain = (nodeLike: any): string | null => {
  const domain =
    nodeLike?.data?.research_domain ??
    nodeLike?.research_domain ??
    nodeLike?.originalData?.data?.research_domain ??
    nodeLike?.original?.data?.research_domain ??
    nodeLike?.metadata?.research_domain ??
    nodeLike?.domain;

  return typeof domain === 'string' && domain.trim() ? domain.trim() : null;
};

const mapPaperToData = (node: APIGraphNode): PaperData => {
  if (!node.data) {
    return {
      title: node.label,
      authors: 'Unknown',
      source: 'Unknown',
      abstract: 'No details available.',
      keywords: [],
    };
  }

  let authorsStr = 'Unknown';
  if (Array.isArray(node.data.authors)) {
    authorsStr = node.data.authors.join(' • ');
  } else if (typeof node.data.authors === 'string') {
    authorsStr = node.data.authors;
  }

  return {
    title: node.data.title,
    authors: authorsStr,
    source: node.data.source || 'Unknown',
    abstract: node.data.abstract || 'No abstract available',
    keywords: [node.data.language || 'en', `Cites: ${node.data.citation_count || 0}`],
    quality_score: node.data.quality_score,
    research_domain: node.data.research_domain,
    key_findings: node.data.key_findings,
    related_papers: node.data.related_papers,
    methodology: node.data.methodology,
    contributions: node.data.contributions,
    limitations: node.data.limitations,
    citations: node.data.citation_count,
    language: node.data.language || 'en',
  };
};

const getThemeStyles = (theme: 'light' | 'dark') => ({
  background: 'var(--bg-primary)',
  bgDot: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'var(--graph-dot)',
});

export default function GraphView(props: GraphViewProps) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}

function GraphInner({
  onNodeClick,
  theme = 'dark',
  data,
  threshold,
  maxNodes,
  showKeyPapers,
  showClusters,
  showCitations,
  resetViewportKey,
  setThreshold,
  setMaxNodes,
  setShowKeyPapers,
  setShowClusters,
  setShowCitations,
  onResetLayout,
}: GraphViewProps) {
  const styles = getThemeStyles(theme);
  const { fitView, setCenter } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [relatedNodeIds, setRelatedNodeIds] = useState<Set<string>>(new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredRelatedNodeIds, setHoveredRelatedNodeIds] = useState<Set<string>>(new Set());
  const [focusModeNodeId, setFocusModeNodeId] = useState<string | null>(null);
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [isDomainOpen, setIsDomainOpen] = useState(false);
  const [domainQuery, setDomainQuery] = useState('');
  const [controlsCollapsed, setControlsCollapsed] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const domainFilterRef = useRef<HTMLDivElement>(null);
  const hoverLeaveTimeoutRef = useRef<number | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);

  const nodeTypes = useMemo(() => ({ custom: GraphNode }), []);
  const edgeTypes = useMemo(() => ({ custom: CustomEdge }), []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as globalThis.Node | null;
      if (domainFilterRef.current && target && !domainFilterRef.current.contains(target)) {
        setIsDomainOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    hoveredNodeIdRef.current = hoveredNodeId;
  }, [hoveredNodeId]);

  useEffect(() => {
    return () => {
      if (hoverLeaveTimeoutRef.current !== null) {
        window.clearTimeout(hoverLeaveTimeoutRef.current);
      }
    };
  }, []);

  const filteredDomains = useMemo(() => {
    const normalized = domainQuery.trim().toLowerCase();
    if (!normalized) return availableDomains;
    return availableDomains.filter((domain) => domain.toLowerCase().includes(normalized));
  }, [availableDomains, domainQuery]);

  const graphHintChips = useMemo(() => {
    const chips: string[] = [];
    if (showClusters) chips.push('Community clusters enabled');
    if (selectedNodeId) chips.push('Try expanding this branch');
    if (focusModeNodeId) chips.push('Focus mode active');
    if (nodes.length >= 12) chips.push('Highly connected cluster');
    return chips.slice(0, 3);
  }, [focusModeNodeId, nodes.length, selectedNodeId, showClusters]);

  useEffect(() => {
    if (resetViewportKey > 0) {
      fitView({ duration: 850, padding: 0.24, maxZoom: 0.82, minZoom: 0.12 });
    }
  }, [resetViewportKey, fitView]);

  useEffect(() => {
    if (!data) {
      setNodes([]);
      setEdges([]);
      setAllNodes([]);
      setAllEdges([]);
      return;
    }

    const edgeMap = new Map<string, number>();
    data.links.forEach((link) => {
      const sourceId = (link.source as any).id || link.source;
      const targetId = (link.target as any).id || link.target;
      edgeMap.set(`${sourceId}-${targetId}`, link.value || 1);
      edgeMap.set(`${targetId}-${sourceId}`, link.value || 1);
    });

    let centerNodeId = data.nodes.find((node) => node.id === 'center')?.id;
    if (!centerNodeId) centerNodeId = data.nodes.find((node) => node.group === 1)?.id;
    if (!centerNodeId && data.nodes.length > 0) centerNodeId = data.nodes[0].id;

    let centerX = 500;
    let centerY = 420;
    if (containerRef.current) {
      centerX = containerRef.current.clientWidth / 2;
      centerY = containerRef.current.clientHeight / 2;
    }

    const simNodes = data.nodes.map((node) => {
      const isCenter = node.id === centerNodeId;
      const citations = node.data?.citation_count || 0;

      let relevance = 0;
      if (isCenter) {
        relevance = 100;
      } else if (centerNodeId) {
        const edgeVal = edgeMap.get(`${centerNodeId}-${node.id}`) || 0;
        relevance = edgeVal <= 1 ? Math.round(edgeVal * 100) : edgeVal;
      }

      let nodeType: 'query' | 'key' | 'related' | 'weak' = 'weak';
      if (isCenter) {
        nodeType = 'query';
      } else if (node.data?.quality_score && node.data.quality_score > 0.85) {
        nodeType = 'key';
      } else if (relevance >= 70) {
        nodeType = 'related';
      }

      const nodeSize = isCenter
        ? 340
        : Math.floor(180 + (relevance / 100) * 84 + Math.min(citations, 80) * 0.28);

      return {
        id: node.id,
        x: isCenter ? centerX : (Math.random() - 0.5) * 920 + centerX,
        y: isCenter ? centerY : (Math.random() - 0.5) * 920 + centerY,
        fx: isCenter ? centerX : undefined,
        fy: isCenter ? centerY : undefined,
        width: nodeSize,
        height: nodeSize,
        radius: nodeSize / 2,
        isCenter,
        relevance,
        nodeType,
        originalData: node,
        citationCount: citations,
      };
    });

    const simLinks = data.links.map((link) => ({ ...link }));
    const simulation = forceSimulation(simNodes as any)
      .force('charge', forceManyBody().strength(() => -2050))
      .force('collide', forceCollide().radius((d: any) => d.radius + 28).iterations(3))
      .force('center', forceCenter(centerX, centerY).strength(0.1))
      .force(
        'link',
        forceLink(simLinks)
          .id((d: any) => d.id)
          .distance((link: any) => {
            const relevance = link.value || 50;
            return 460 + ((100 - relevance) * 5.2) + (Math.random() * 96 - 48);
          })
          .strength(0.22)
      )
      .stop();

    simulation.tick(300);

    let communities: Record<string, number> = {};
    try {
      const graph = new Graph({ multi: true, allowSelfLoops: true });
      simNodes.forEach((node: any) => {
        if (!graph.hasNode(node.id)) graph.addNode(node.id);
      });
      simLinks.forEach((link: any) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        if (graph.hasNode(sourceId) && graph.hasNode(targetId)) {
          graph.addEdge(sourceId, targetId);
        }
      });
      communities = louvain(graph);
    } catch (error) {
      console.warn('Failed to compute graph clusters', error);
    }

    const clusterColors = [
      'hsl(221, 100%, 65%)', // Blue
      'hsl(199, 100%, 65%)', // Cyan
      'hsl(25, 100%, 65%)',  // Orange
      'hsl(142, 70%, 55%)',  // Green
      'hsl(330, 85%, 65%)',  // Pink
      'hsl(262, 80%, 65%)',  // Violet
      'hsl(172, 65%, 50%)'   // Teal
    ];

    const layoutedNodes: Node[] = simNodes.map((simNode: any) => {
      const originalProps = simNode.originalData.data || {};
      const clusterId = communities[simNode.id];
      const clusterColor = clusterId !== undefined ? clusterColors[clusterId % clusterColors.length] : undefined;

      let allAuthors = 'Unknown';
      if (Array.isArray(originalProps.authors)) {
        allAuthors = originalProps.authors.join(', ');
      } else if (typeof originalProps.authors === 'string') {
        allAuthors = originalProps.authors;
      }

      const authorList = allAuthors.split(/,\s*/);
      const truncatedAuthors =
        authorList.length > 3 ? `${authorList[0]}, ${authorList[1]}, ${authorList[2]} et al.` : allAuthors;

      const year = originalProps.published_date?.match(/\d{4}/)?.[0] || 'Unknown Year';
      const floatDuration = 8 + (simNode.id.charCodeAt(0) % 5);
      const floatDelay = (simNode.id.charCodeAt(simNode.id.length - 1) % 7) * 0.3;

      return {
        id: simNode.id,
        position: {
          x: simNode.x - simNode.width / 2,
          y: simNode.y - simNode.height / 2,
        },
        type: 'custom',
        data: {
          label: simNode.originalData.label,
          fullTitle: originalProps.title || simNode.originalData.label,
          citationCount: simNode.citationCount,
          original: simNode.originalData,
          authors: truncatedAuthors,
          allAuthors,
          source: originalProps.source || 'Unknown',
          year,
          relevanceScore: simNode.relevance,
          nodeType: simNode.nodeType,
          radius: simNode.radius,
          qualityScore: originalProps.quality_score || simNode.relevance / 100,
          keyContribution: originalProps.key_findings?.[0],
          clusterColor,
          language: originalProps.language || 'en',
          floatDuration,
          floatDelay,
          showCitations,
        },
        style: {
          width: simNode.width,
          height: simNode.height,
        },
        zIndex: simNode.isCenter ? 12 : 1,
      };
    });

    const initialEdges: Edge[] = simLinks.map((link: any, index) => {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;
      const strength = typeof link.value === 'number' ? link.value : 1;
      const relevance = strength <= 1 ? Math.round(strength * 100) : strength;

      const sourceNode = simNodes.find((node: any) => node.id === sourceId);
      const targetNode = simNodes.find((node: any) => node.id === targetId);
      const sourceLang = sourceNode?.originalData?.data?.language || 'en';
      const targetLang = targetNode?.originalData?.data?.language || 'en';

      return {
        id: `e-${index}`,
        source: sourceId,
        target: targetId,
        type: 'custom',
        data: {
          relevance,
          isSelected: false,
          isHovered: false,
          isFaded: false,
          isFake: link.isFake || false,
          sourceLang,
          targetLang,
          shouldShowLabel: false,
        },
      };
    });

    setAllNodes(layoutedNodes);
    setAllEdges(initialEdges);
    setSelectedNodeId(null);
    setRelatedNodeIds(new Set());
    setHoveredNodeId(null);
    setHoveredRelatedNodeIds(new Set());
    setFocusModeNodeId(null);

    window.requestAnimationFrame(() => {
      fitView({ duration: 900, padding: 0.24, maxZoom: 0.82, minZoom: 0.12 });
    });
  }, [data, theme, fitView, showCitations, setEdges, setNodes]);

  useEffect(() => {
    let baseNodes = [...allNodes];
    let baseEdges = [...allEdges];

    if (threshold > 0) {
      baseNodes = baseNodes.filter(
        (node) =>
          node.data.relevanceScore >= threshold ||
          node.id === 'center' ||
          node.data.original?.group === 1
      );
      const visibleNodeIds = new Set(baseNodes.map((node) => node.id));
      baseEdges = baseEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
    }

    if (baseNodes.length > maxNodes) {
      const keepNodes = [...baseNodes]
        .sort((a, b) => {
          if (a.id === selectedNodeId || a.id === 'center') return -1;
          if (b.id === selectedNodeId || b.id === 'center') return 1;
          return (b.data.relevanceScore || 0) - (a.data.relevanceScore || 0);
        })
        .slice(0, maxNodes);
      baseNodes = keepNodes;
      const visibleNodeIds = new Set(keepNodes.map((node) => node.id));
      baseEdges = baseEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
    }

    if (showKeyPapers) {
      baseNodes = baseNodes.filter((node) => node.data.nodeType === 'key' || node.data.nodeType === 'query');
      const visibleNodeIds = new Set(baseNodes.map((node) => node.id));
      baseEdges = baseEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
    }

    const domains = new Set<string>();
    baseNodes.forEach((node) => {
      const domain = extractResearchDomain(node);
      if (domain) domains.add(domain);
    });
    const nextAvailableDomains = Array.from(domains).sort();
    setAvailableDomains((prev) =>
      arraysEqual(prev, nextAvailableDomains) ? prev : nextAvailableDomains
    );
    setSelectedDomains((prev) => {
      const filtered = prev.filter((domain) => nextAvailableDomains.includes(domain));
      return arraysEqual(prev, filtered) ? prev : filtered;
    });

    let activeNodes = [...baseNodes];
    let activeEdges = [...baseEdges];

    if (selectedDomains.length > 0) {
      activeNodes = activeNodes.filter((node) => {
        const domain = extractResearchDomain(node);
        return selectedDomains.includes(domain || '') || node.id === 'center' || node.data.original?.group === 1;
      });
      const visibleNodeIds = new Set(activeNodes.map((node) => node.id));
      activeEdges = activeEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
    }

    setNodes(
      activeNodes.map((node) => {
        const isSelected = node.id === selectedNodeId;
        const isRelated = relatedNodeIds.has(node.id);
        const isHovered = node.id === hoveredNodeId;
        const isHoverRelated = hoveredRelatedNodeIds.has(node.id);
        const isInFocusCluster = focusModeNodeId ? node.id === focusModeNodeId || relatedNodeIds.has(node.id) : false;
        const shouldDimForFocus = focusModeNodeId ? !isInFocusCluster : false;
        const shouldDimForHover = hoveredNodeId && !focusModeNodeId ? !(isHovered || isHoverRelated) : false;
        const isDimmed = shouldDimForFocus || shouldDimForHover;

        return {
          ...node,
          data: {
            ...node.data,
            isSelected,
            isRelated,
            isHovered,
            isHoverRelated,
            isDimmed,
            isFocusMode: Boolean(focusModeNodeId),
            clusterColor: showClusters ? node.data.clusterColor : undefined,
            showCitations,
          },
          zIndex: isSelected ? 60 : isHovered ? 50 : isRelated || isHoverRelated ? 28 : node.zIndex,
        };
      })
    );

    setEdges(
      activeEdges.map((edge) => {
        const isSelectedEdge = edge.source === selectedNodeId || edge.target === selectedNodeId;
        const isHoveredEdge = edge.source === hoveredNodeId || edge.target === hoveredNodeId;
        const isFocusEdge = focusModeNodeId ? edge.source === focusModeNodeId || edge.target === focusModeNodeId : false;

        if (focusModeNodeId) {
          return {
            ...edge,
            data: {
              ...edge.data,
              isSelected: isFocusEdge,
              isHovered: false,
              isFaded: !isFocusEdge,
              shouldShowLabel: isFocusEdge,
            },
            zIndex: isFocusEdge ? 60 : 0,
          };
        }

        if (selectedNodeId || hoveredNodeId) {
          return {
            ...edge,
            data: {
              ...edge.data,
              isSelected: isSelectedEdge,
              isHovered: isHoveredEdge,
              isFaded: selectedNodeId ? !isSelectedEdge : !isHoveredEdge,
              shouldShowLabel: Boolean(selectedNodeId ? isSelectedEdge : isHoveredEdge),
            },
            zIndex: isSelectedEdge ? 50 : isHoveredEdge ? 42 : 0,
          };
        }

        return {
          ...edge,
          data: {
            ...edge.data,
            isSelected: false,
            isHovered: false,
            isFaded: false,
            shouldShowLabel: false,
          },
        };
      })
    );
  }, [
    allNodes,
    allEdges,
    threshold,
    maxNodes,
    showKeyPapers,
    showClusters,
    showCitations,
    selectedNodeId,
    relatedNodeIds,
    hoveredNodeId,
    hoveredRelatedNodeIds,
    focusModeNodeId,
    selectedDomains,
    setNodes,
    setEdges,
  ]);

  const collectRelatedNodes = useCallback((nodeId: string) => {
    const related = new Set<string>();
    allEdges.forEach((edge) => {
      if (edge.source === nodeId) related.add(edge.target as string);
      if (edge.target === nodeId) related.add(edge.source as string);
    });
    return related;
  }, [allEdges]);

  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => {
    const related = collectRelatedNodes(node.id);
    setSelectedNodeId(node.id);
    setRelatedNodeIds(related);
    setFocusModeNodeId(null);

    if (node.data?.original) {
      onNodeClick(mapPaperToData(node.data.original));
    }
  }, [collectRelatedNodes, onNodeClick]);

  const handleNodeMouseEnter: NodeMouseHandler = useCallback((_, node) => {
    if (hoverLeaveTimeoutRef.current !== null) {
      window.clearTimeout(hoverLeaveTimeoutRef.current);
      hoverLeaveTimeoutRef.current = null;
    }

    if (hoveredNodeIdRef.current === node.id) return;

    hoveredNodeIdRef.current = node.id;
    setHoveredNodeId(node.id);
    setHoveredRelatedNodeIds(collectRelatedNodes(node.id));
  }, [collectRelatedNodes]);

  const handleNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    if (hoverLeaveTimeoutRef.current !== null) {
      window.clearTimeout(hoverLeaveTimeoutRef.current);
    }

    hoverLeaveTimeoutRef.current = window.setTimeout(() => {
      hoveredNodeIdRef.current = null;
      setHoveredNodeId(null);
      setHoveredRelatedNodeIds((prev) => (prev.size === 0 ? prev : new Set()));
      hoverLeaveTimeoutRef.current = null;
    }, 70);
  }, []);

  const handleNodeDoubleClick: NodeMouseHandler = useCallback((_, node) => {
    const related = collectRelatedNodes(node.id);
    setSelectedNodeId(node.id);
    setRelatedNodeIds(related);
    setFocusModeNodeId(node.id);
    if (node.data?.original) {
      onNodeClick(mapPaperToData(node.data.original));
    }

    const nodeWidth = typeof node.style?.width === 'number' ? node.style.width : 220;
    const nodeHeight = typeof node.style?.height === 'number' ? node.style.height : 220;
    setCenter(node.position.x + nodeWidth / 2, node.position.y + nodeHeight / 2, {
      zoom: 0.84,
      duration: 700,
    });
  }, [collectRelatedNodes, onNodeClick, setCenter]);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setRelatedNodeIds(new Set());
    setHoveredNodeId(null);
    setHoveredRelatedNodeIds(new Set());
    setFocusModeNodeId(null);
  }, []);

  return (
    <div
      ref={containerRef}
      className="graph-canvas absolute inset-0 h-full w-full transition-colors duration-300"
      style={{ backgroundColor: styles.background }}
    >
      {availableDomains.length > 0 && (
        <div ref={domainFilterRef} className="absolute right-6 top-6 z-50">
          <button
            type="button"
            onClick={() => setIsDomainOpen((prev) => !prev)}
            className="glass-panel flex min-w-[220px] max-w-[260px] items-center gap-3 rounded-2xl px-4 py-3 shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--bg-hover)]"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
            <span className="truncate text-sm text-[var(--text-primary)]">
              {selectedDomains.length === 0
                ? 'Filter by domain'
                : selectedDomains.length === 1
                  ? selectedDomains[0]
                  : `${selectedDomains.length} domains selected`}
            </span>
            <span className="ml-auto text-[var(--text-secondary)]">▾</span>
          </button>

          {isDomainOpen && (
            <div className="glass-panel absolute right-0 top-[calc(100%+10px)] w-[320px] rounded-[1.4rem] p-3">
              <div className="mb-3 relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={domainQuery}
                  onChange={(event) => setDomainQuery(event.target.value)}
                  placeholder="Search domains..."
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:ring-4 focus:ring-[var(--ring-color)]"
                />
              </div>

              <div className="mb-3 flex items-center justify-between px-1">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  {selectedDomains.length} selected
                </div>
                {selectedDomains.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedDomains([]);
                      setDomainQuery('');
                    }}
                    className="text-xs font-semibold text-[var(--text-accent)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="custom-scrollbar max-h-[280px] space-y-1 overflow-y-auto pr-1">
                {filteredDomains.map((domain) => {
                  const isSelected = selectedDomains.includes(domain);
                  return (
                    <button
                      key={domain}
                      onClick={() =>
                        setSelectedDomains((prev) =>
                          prev.includes(domain) ? prev.filter((item) => item !== domain) : [...prev, domain]
                        )
                      }
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-[var(--primary-soft)] text-[var(--text-primary)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                          isSelected
                            ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                            : 'border-[var(--border-color)] text-transparent'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate">{domain}</span>
                    </button>
                  );
                })}

                {filteredDomains.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[var(--border-color)] px-3 py-6 text-center text-sm text-[var(--text-secondary)]">
                    No matching domains
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="absolute right-6 top-20 z-40 flex max-w-[420px] flex-wrap justify-end gap-2">
        {graphHintChips.map((chip) => (
          <div
            key={chip}
            className="glass-panel inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-accent)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {chip}
          </div>
        ))}
      </div>

      {focusModeNodeId && (
        <div className="absolute left-1/2 top-6 z-40 -translate-x-1/2 rounded-full border border-[var(--ring-color)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-accent)] backdrop-blur-xl shadow-[var(--shadow-soft)]">
          Focus Mode Active
        </div>
      )}

      {data && data.nodes.length > 0 && (
        <div className="absolute bottom-6 right-6 z-50">
          <div
            className={`glass-panel rounded-[1.6rem] p-4 shadow-[var(--shadow-strong)] transition-all duration-300 ${
              controlsCollapsed ? 'w-[260px]' : 'w-[320px]'
            }`}
          >
            <GraphControlsPanel
              embedded
              collapsed={controlsCollapsed}
              onToggleCollapse={() => setControlsCollapsed((prev) => !prev)}
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
        </div>
      )}

      <ReactFlow
        className="graph-flow"
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.24, duration: 800 }}
        attributionPosition="bottom-right"
        proOptions={proOptions}
        minZoom={0.1}
        maxZoom={2}
        panOnDrag
        panOnScroll={false}
        selectionOnDrag={false}
        nodesDraggable={false}
      >
        <Background color={styles.bgDot} gap={32} size={1.2} />
      </ReactFlow>
    </div>
  );
}


