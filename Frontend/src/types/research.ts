export interface Paper {
  id: number;
  title: string;
  abstract: string;
  authors: string | string[];
  published_date: string;
  url?: string;
  source: string;
  language: string;
  citation_count?: number;
  citations?: number;
  paper_url?: string;
  research_domain?: string;
  quality_score?: number;
  key_findings?: string[];
  related_papers?: { id: string; title: string }[];
  methodology?: string;
  innovations?: string[];
  contributions?: string[];
  limitations?: string[];
  embedding?: string | number[];
}

export interface BackendGraphNodeMetadata {
  abstract?: string;
  authors?: string | string[];
  source?: string;
  paper_url?: string;
  language?: string;
  citation_count?: number;
  quality_score?: number;
  research_domain?: string;
  key_findings?: string[];
  related_papers?: { id: string; title: string }[];
  methodology?: string;
  innovations?: string[];
  contributions?: string[];
  limitations?: string[];
}

export interface BackendGraphNode {
  id: string;
  label: string;
  title?: string;
  domain?: string;
  quality_score?: number;
  size: number;
  color?: string;
  metadata?: BackendGraphNodeMetadata;
}

export interface BackendGraphEdge {
  source: string;
  target: string;
  type: string;
  strength?: number;
  weight?: number;
  label?: string;
  context?: string;
}

export interface BackendGraphData {
  nodes: BackendGraphNode[];
  edges: BackendGraphEdge[];
  metrics?: Record<string, unknown>;
  clusters?: Array<Record<string, unknown>>;
  insights?: string[];
  metadata?: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  val: number;
  group?: number;
  data?: Paper;
}

export interface GraphLink {
  source: string;
  target: string;
  value: number;
  type?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ResearchQuery {
  query: string;
  sources?: string[];
  max_papers?: number;
  mode?: 'preview' | 'full';
}

export interface ResearchQueryResponse {
  success: boolean;
  query: string;
  papers: Paper[];
  graph: GraphData;
  papers_found?: number;
  processing_time?: number;
  papers_analyzed?: number;
  insights?: string[];
}

export interface ResearchApiPayload {
  success: boolean;
  query: string;
  papers: Paper[];
  graph: BackendGraphData;
  papers_found?: number;
  processing_time?: number;
  papers_analyzed?: number;
  insights?: string[];
}

export interface ChatContextPaper {
  title: string;
  source?: string;
  research_domain?: string;
  citations?: number;
  abstract?: string;
  methodology?: string;
  key_findings?: string[];
  limitations?: string[];
  contributions?: string[];
}

export interface ChatMessagePayload {
  role: 'assistant' | 'user' | string;
  content: string;
}
