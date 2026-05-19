from src.core.graph_builder import graph_builder

papers = [{
    "id": 166,
    "title": "Machine Learning Test",
    "abstract": "Test",
    "research_domain": "Machine Learning",
    "quality_score": 0.8
}]

try:
    g = graph_builder.build_graph(papers, [])
    print("SUCCESS")
    print("nodes:", len(g["nodes"]))
    print("edges:", len(g["edges"]))
except Exception as e:
    print("FAILED:", e)
