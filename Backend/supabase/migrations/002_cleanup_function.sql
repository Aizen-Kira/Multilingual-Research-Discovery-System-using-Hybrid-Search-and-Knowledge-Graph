-- Cleanup function callable via RPC
CREATE OR REPLACE FUNCTION cleanup_old_papers(days_threshold INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INT;
BEGIN
    WITH deleted AS (
        DELETE FROM research_papers
        WHERE last_accessed < NOW() - (days_threshold || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    RETURN deleted_count;
END;
$$;

-- Paper count guard function
CREATE OR REPLACE FUNCTION get_paper_count()
RETURNS INT
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM research_papers);
END;
$$;
