
import type {
    BackendGraphData,
    ChatContextPaper,
    ChatMessagePayload,
    GraphLink,
    GraphNode,
    Paper,
    ResearchApiPayload,
    ResearchQueryResponse,
} from '../types/research';

export type {
    BackendGraphData,
    ChatContextPaper,
    GraphData,
    GraphLink,
    GraphNode,
    Paper,
    ResearchQuery,
    ResearchQueryResponse,
} from '../types/research';

const API_BASE = '/api';
const PUBLIC_API_KEY = import.meta.env.VITE_PUBLIC_API_KEY;

const jsonHeaders = () => ({
    'Content-Type': 'application/json',
    ...(PUBLIC_API_KEY ? { 'X-API-Key': PUBLIC_API_KEY } : {}),
});

const stripHtml = (value: string) =>
    value
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const parseJsonResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    const trimmedText = rawText.trim();

    if (contentType.includes('text/html') || /^<!doctype html/i.test(trimmedText) || /^<html/i.test(trimmedText)) {
        throw new Error(`HTML_ERROR_${response.status || 200}`);
    }

    try {
        return JSON.parse(rawText) as T;
    } catch {
        const sanitizedText = stripHtml(trimmedText);
        throw new Error(sanitizedText || fallbackMessage);
    }
};

const parseErrorResponse = async (response: Response, fallbackMessage: string): Promise<never> => {
    const contentType = response.headers.get('content-type') || '';

    try {
        if (contentType.includes('application/json')) {
            const error = await response.json();
            throw new Error(
                error?.detail ||
                error?.error ||
                error?.message ||
                `${fallbackMessage} (${response.status})`
            );
        }

        const text = await response.text();
        const cleanedText = text?.trim() || '';
        const sanitizedText = stripHtml(cleanedText);

        if (contentType.includes('text/html') || /^<!doctype html/i.test(cleanedText) || /^<html/i.test(cleanedText)) {
            throw new Error(`HTML_ERROR_${response.status}`);
        }

        throw new Error(sanitizedText || `${fallbackMessage} (${response.status})`);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`${fallbackMessage} (${response.status})`);
    }
};

export const api = {
    /**
     * Perform a research query
     */
    research: async (
        query: string,
        mode: 'preview' | 'full' = 'full',
        options: { sources?: string[]; max_papers?: number; signal?: AbortSignal } = {}
    ): Promise<ResearchQueryResponse> => {
        const response = await fetch(`${API_BASE}/research/query`, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({
                query,
                mode,
                sources: options.sources,
                max_papers: options.max_papers ?? 30
            }),
            signal: options.signal,
        });

        if (!response.ok) {
            await parseErrorResponse(response, 'Research query failed');
        }

        const data = await parseJsonResponse<ResearchApiPayload>(response, 'Research query returned an invalid response');

        // UTILITY: Detect language heuristically if backend fails
        const detectLanguage = (text: string) => {
            if (!text) return 'en';
            const lower = text.toLowerCase();
            if (/[А-Яа-яЁё]/.test(text)) return 'ru';
            if (/\b(não|do|da|dos|das|em|um|uma|para|com|como)\b/i.test(lower)) {
                if (/\b(não|dos|das)\b/i.test(lower)) return 'pt';
                if (/\b(el|la|los|las|y)\b/i.test(lower)) return 'es';
                return 'pt';
            }
            if (/\b(el|la|los|las|un|una|y|que|en|de)\b/i.test(lower)) return 'es';
            if (/\b(der|die|das|und|ist|für|mit)\b/i.test(lower)) return 'de';
            if (/\b(le|la|les|un|une|et|dans|pour|avec)\b/i.test(lower)) return 'fr';
            return 'en'; // default
        };

        // TRANSFORM BACKEND DATA TO UI FORMAT
        const backendGraph: BackendGraphData = data.graph;

        const paperMap = new Map<string, Paper>(data.papers.map((paper) => [String(paper.id), paper]));

        const uiNodes: GraphNode[] = backendGraph.nodes.map(node => {
            const extraData = paperMap.get(String(node.id));
            return {
                id: node.id,
                label: node.label,
                type: 'paper', // Default type
                val: node.size || 10,
                group: 1, // Default group
                data: {
                    id: parseInt(node.id) || 0,
                    title: node.title || node.label,
                    abstract: node.metadata?.abstract || '',
                    authors: node.metadata?.authors || 'Unknown',
                    published_date: extraData?.published_date || '',
                    url: node.metadata?.paper_url || extraData?.paper_url || '',
                    source: node.metadata?.source || extraData?.source || 'Unknown',
                    language: node.metadata?.language || extraData?.language || detectLanguage((node.title || node.label) + " " + (node.metadata?.abstract || '')),
                    citation_count: node.metadata?.citation_count || node.quality_score || extraData?.citations || 0,
                    quality_score: node.quality_score || node.metadata?.quality_score || extraData?.quality_score,
                    research_domain: node.domain || node.metadata?.research_domain || extraData?.research_domain,
                    key_findings: node.metadata?.key_findings || extraData?.key_findings || [],
                    related_papers: node.metadata?.related_papers || extraData?.related_papers || [],
                    methodology: node.metadata?.methodology || extraData?.methodology,
                    innovations: node.metadata?.innovations || extraData?.innovations || [],
                    contributions: node.metadata?.contributions || extraData?.contributions || [],
                    limitations: node.metadata?.limitations || extraData?.limitations || []
                }
            };
        });

        const uiLinks: GraphLink[] = backendGraph.edges.map(edge => ({
            source: edge.source,
            target: edge.target,
            value: edge.weight || 1,
            type: edge.type
        }));

        // FALLBACK: Generate similarity edges if backend produced too few edges (e.g. less than 1 edge per node)
        if (uiLinks.length < uiNodes.length && data.papers && data.papers.length > 1) {
            const getVector = (emb: Paper['embedding']): number[] | null => {
                if (!emb) return null;
                try {
                    const parsed = typeof emb === 'string' ? JSON.parse(emb) : emb;
                    return Array.isArray(parsed) && parsed.every((value) => typeof value === 'number') ? parsed : null;
                } catch {
                    return null;
                }
            };

            const cosineSim = (a: number[], b: number[]) => {
                let dot = 0, nA = 0, nB = 0;
                for (let i = 0; i < Math.min(a.length, b.length); i++) {
                    dot += a[i] * b[i];
                    nA += a[i] * a[i];
                    nB += b[i] * b[i];
                }
                return nA && nB ? dot / (Math.sqrt(nA) * Math.sqrt(nB)) : 0;
            };

            const nodeVectors = new Map<string, number[]>();
            data.papers.forEach((p) => {
                const vec = getVector(p.embedding);
                if (vec && Array.isArray(vec)) nodeVectors.set(String(p.id), vec);
            });

            const addedLinks = new Set<string>();

            for (let i = 0; i < uiNodes.length; i++) {
                const srcId = String(uiNodes[i].id);
                const srcVec = nodeVectors.get(srcId);
                if (!srcVec) continue;

                const sims: Array<{ id: string; score: number }> = [];
                for (let j = 0; j < uiNodes.length; j++) {
                    if (i === j) continue;
                    const tgtId = String(uiNodes[j].id);
                    const tgtVec = nodeVectors.get(tgtId);
                    if (tgtVec) {
                        sims.push({ id: tgtId, score: cosineSim(srcVec, tgtVec) });
                    }
                }

                // Keep top 2/3 connections
                sims.sort((a, b) => b.score - a.score);
                let added = 0;
                for (const sim of sims) {
                    if (added >= 3) break;

                    // Only add if relatively similar, and prevent duplicate pairs
                    if (sim.score > 0.1) { // Lowered threshold from 0.3 since some domains have weaker embeddings
                        const pairIds = [srcId, sim.id].sort().join('-');
                        if (!addedLinks.has(pairIds)) {
                            addedLinks.add(pairIds);
                            // Scale score to percentage-ish for UI force graph handling
                            uiLinks.push({ source: srcId, target: sim.id, value: Math.round(sim.score * 100), type: 'similarity' });
                        }
                    }
                    added++;
                }
            }
        }

        return {
            success: data.success,
            query: data.query,
            papers: data.papers, // Pass through list of papers
            graph: {
                nodes: uiNodes,
                links: uiLinks
            },
            papers_found: data.papers_found,
            processing_time: data.processing_time
        };
    },

    /**
     * RAG Chat with Copilot
     */
    chat: async (
        message: string,
        contextPaper: ChatContextPaper | null,
        history: ChatMessagePayload[],
        workspaceQuery?: string
    ): Promise<{ success: boolean; response?: string; error?: string; layer_used?: string }> => {
        const payload = {
            message,
            context_paper: contextPaper,
            history,
            workspace_query: workspaceQuery || null,
        };
        const doChatRequest = async (body: unknown) => {
            const response = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: jsonHeaders(),
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                await parseErrorResponse(response, 'Chat request failed');
            }

            return await parseJsonResponse<{ success: boolean; response?: string; error?: string; layer_used?: string }>(
                response,
                'Chat request returned an invalid response'
            );
        };

        try {
            return await doChatRequest(payload);
        } catch (error) {
            const fallbackPayload = {
                message,
                context_paper: contextPaper?.title || null,
                history,
            };

            const errorMessage = error instanceof Error ? error.message : '';
            const shouldRetryLegacy =
                /422|400|field required|validation|extra inputs are not permitted|input should be/i.test(errorMessage);

            if (!shouldRetryLegacy) {
                throw error;
            }

            return await doChatRequest(fallbackPayload);
        }
    },

    /**
     * Health check
     */
    checkHealth: async (): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE}/health`);
            // Backend returns { status: "healthy", ... }
            if (response.ok) {
                const data = await parseJsonResponse<{ status?: string }>(response, 'Health check returned an invalid response');
                return data.status === 'healthy';
            }
            return false;
        } catch (e) {
            console.error('Health check failed', e);
            return false;
        }
    }
};
