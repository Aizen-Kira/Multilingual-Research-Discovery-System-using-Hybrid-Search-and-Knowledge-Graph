-- PolyResearch v3.0 Schema
-- Run this in Supabase SQL Editor

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Research Papers ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_papers (
    id                  BIGSERIAL PRIMARY KEY,
    title               TEXT NOT NULL,
    abstract            TEXT,
    authors             TEXT,
    source              TEXT NOT NULL,           -- arxiv | pubmed | crossref | europepmc | doaj
    paper_url           TEXT,
    published_date      TEXT,
    doi                 TEXT,
    language            TEXT DEFAULT 'en',

    -- Embedding
    embedding           vector(384),
    embedding_model     TEXT DEFAULT 'paraphrase-multilingual-MiniLM-L12-v2',

    -- LLM Analysis
    research_domain     TEXT DEFAULT 'General Research',
    methodology         TEXT,
    key_findings        JSONB DEFAULT '[]',
    innovations         JSONB DEFAULT '[]',
    limitations         JSONB DEFAULT '[]',
    contributions       JSONB DEFAULT '[]',
    context_summary     TEXT,
    quality_score       FLOAT DEFAULT 0.5,
    ai_agent_used       TEXT,
    analysis_method     TEXT,                    -- gemini | groq | rule_based | openrouter

    -- Metadata
    last_accessed       TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    -- Dedup constraint
    UNIQUE(title, source)
);

-- ── Paper Relationships ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paper_relationships (
    id                      BIGSERIAL PRIMARY KEY,
    paper1_id               BIGINT NOT NULL REFERENCES research_papers(id) ON DELETE CASCADE,
    paper2_id               BIGINT NOT NULL REFERENCES research_papers(id) ON DELETE CASCADE,
    relationship_type       TEXT NOT NULL,        -- cites | builds_upon | extends | complements | related
    relationship_strength   FLOAT DEFAULT 0.5,
    relationship_context    TEXT,
    connection_reasoning    TEXT,
    analysis_method         TEXT,                 -- citation_network | cosine_similarity | llm_gemini | llm_groq
    confidence_score        FLOAT DEFAULT 0.5,
    semantic_similarity     FLOAT DEFAULT 0.0,
    is_cross_linguistic     BOOLEAN DEFAULT FALSE,
    language_pair           TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(paper1_id, paper2_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- HNSW vector index (cosine, fast approximate search)
CREATE INDEX IF NOT EXISTS papers_embedding_hnsw
    ON research_papers
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Standard indexes
CREATE INDEX IF NOT EXISTS papers_domain_idx        ON research_papers(research_domain);
CREATE INDEX IF NOT EXISTS papers_last_accessed_idx ON research_papers(last_accessed);
CREATE INDEX IF NOT EXISTS papers_source_idx        ON research_papers(source);
CREATE INDEX IF NOT EXISTS papers_quality_idx       ON research_papers(quality_score DESC);
CREATE INDEX IF NOT EXISTS rels_paper1_idx          ON paper_relationships(paper1_id);
CREATE INDEX IF NOT EXISTS rels_paper2_idx          ON paper_relationships(paper2_id);
CREATE INDEX IF NOT EXISTS rels_type_idx            ON paper_relationships(relationship_type);

-- ── pgvector match function ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_papers(
    query_embedding  vector(384),
    match_threshold  FLOAT,
    match_count      INT
)
RETURNS TABLE (
    id               BIGINT,
    title            TEXT,
    abstract         TEXT,
    authors          TEXT,
    source           TEXT,
    paper_url        TEXT,
    published_date   TEXT,
    research_domain  TEXT,
    context_summary  TEXT,
    quality_score    FLOAT,
    embedding        vector(384),
    similarity       FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.title,
        p.abstract,
        p.authors,
        p.source,
        p.paper_url,
        p.published_date,
        p.research_domain,
        p.context_summary,
        p.quality_score,
        p.embedding,
        1 - (p.embedding <=> query_embedding) AS similarity
    FROM research_papers p
    WHERE p.embedding IS NOT NULL
      AND 1 - (p.embedding <=> query_embedding) > match_threshold
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE research_papers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_relationships  ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_all_papers" ON research_papers
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_rels" ON paper_relationships
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Anon read-only
CREATE POLICY "anon_read_papers" ON research_papers
    FOR SELECT TO anon USING (TRUE);

CREATE POLICY "anon_read_rels" ON paper_relationships
    FOR SELECT TO anon USING (TRUE);
