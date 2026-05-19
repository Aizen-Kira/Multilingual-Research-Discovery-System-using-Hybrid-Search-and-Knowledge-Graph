"""Knowledge Graph Builder."""
import logging
from collections import defaultdict
from typing import Any, Dict, List
import networkx as nx

logger = logging.getLogger(__name__)

DOMAIN_COLORS = {
    "Machine Learning": "#45B7D1",
    "Computer Vision": "#FF6B6B",
    "Natural Language Processing": "#4ECDC4",
    "Deep Learning": "#96CEB4",
    "Artificial Intelligence": "#A8E6CF",
    "Healthcare": "#FFEAA7",
    "Robotics": "#DDA0DD",
    "Data Science": "#98D8C8",
    "General Research": "#F7DC6F",
}


class GraphBuilder:
    def build_graph(self, papers: List[Dict], relationships: List[Dict]) -> Dict:
        try:
            nodes = [self._node(p) for p in papers if p.get("id")]
            edges = [self._edge(r) for r in relationships if r.get("paper1_id") and r.get("paper2_id")]
            edges = [e for e in edges if e]
            metrics = self._metrics(papers, relationships)
            clusters = self._clusters(papers)
            insights = self._insights(papers, relationships, metrics)
            return {
                "nodes": nodes, "edges": edges,
                "clusters": clusters, "metrics": metrics, "insights": insights,
                "metadata": {
                    "total_papers": len(papers),
                    "total_relationships": len(relationships),
                    "unique_domains": len(set(p.get("research_domain", "") for p in papers)),
                },
            }
        except Exception as e:
            logger.error(f"Graph build failed: {e}")
            return {"nodes": [], "edges": [], "clusters": [], "metrics": {}, "insights": [], "metadata": {}}

    def _node(self, paper: Dict) -> Dict:
        domain = paper.get("research_domain", "General Research")
        quality = float(paper.get("quality_score") or 0.5)
        return {
            "id": str(paper["id"]),
            "label": (paper.get("title") or "")[:60],
            "title": paper.get("title"),
            "domain": domain,
            "quality_score": quality,
            "size": int(40 + quality * 60),
            "color": DOMAIN_COLORS.get(domain, DOMAIN_COLORS["General Research"]),
            "metadata": {
                "abstract": (paper.get("abstract") or "")[:300],
                "authors": paper.get("authors"),
                "source": paper.get("source"),
                "paper_url": paper.get("paper_url"),
            },
        }

    def _edge(self, rel: Dict) -> Dict | None:
        try:
            return {
                "source": str(rel["paper1_id"]),
                "target": str(rel["paper2_id"]),
                "type": rel.get("relationship_type", "related"),
                "strength": float(rel.get("relationship_strength") or 0.5),
                "label": (rel.get("relationship_type") or "related").replace("_", " ").title(),
                "dashed": rel.get("analysis_method") != "citation_network",
            }
        except Exception:
            return None

    def _metrics(self, papers, relationships) -> Dict:
        G = nx.Graph()
        for p in papers:
            if p.get("id"):
                G.add_node(str(p["id"]))
        for r in relationships:
            G.add_edge(str(r.get("paper1_id")), str(r.get("paper2_id")),
                       weight=r.get("relationship_strength", 0.5))
        return {
            "node_count": G.number_of_nodes(),
            "edge_count": G.number_of_edges(),
            "density": round(nx.density(G), 4) if G.number_of_nodes() > 1 else 0,
            "connected_components": nx.number_connected_components(G),
            "avg_degree": round(sum(d for _, d in G.degree()) / max(G.number_of_nodes(), 1), 2),
            "most_connected_id": max(nx.degree_centrality(G).items(), key=lambda x: x[1])[0] if G.nodes else None,
        }

    def _clusters(self, papers) -> List[Dict]:
        domain_map = defaultdict(list)
        for p in papers:
            if p.get("id"):
                domain_map[p.get("research_domain", "General Research")].append(str(p["id"]))
        return [
            {
                "id": d.lower().replace(" ", "_"),
                "label": d,
                "papers": ids,
                "size": len(ids),
                "color": DOMAIN_COLORS.get(d, DOMAIN_COLORS["General Research"]),
            }
            for d, ids in domain_map.items()
        ]

    def _insights(self, papers, relationships, metrics) -> List[str]:
        insights = []
        domain_counts = defaultdict(int)
        for p in papers:
            domain_counts[p.get("research_domain", "General Research")] += 1
        if domain_counts:
            top = max(domain_counts.items(), key=lambda x: x[1])
            insights.append(f"Top domain: {top[0]} ({top[1]} papers)")
        density = metrics.get("density", 0)
        if density > 0.5:
            insights.append("High inter-paper connectivity — well-consolidated research area")
        elif density < 0.2:
            insights.append("Low connectivity — diverse or emerging topic landscape")
        qualities = [p.get("quality_score") or 0.5 for p in papers]
        avg_q = sum(qualities) / max(len(qualities), 1)
        insights.append(f"Average paper quality: {avg_q:.2f}")
        cross = sum(1 for r in relationships if r.get("is_cross_linguistic"))
        if cross:
            insights.append(f"{cross} cross-linguistic connections found")
        return insights


graph_builder = GraphBuilder()
