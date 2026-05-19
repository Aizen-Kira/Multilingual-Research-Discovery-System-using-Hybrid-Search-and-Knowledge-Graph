CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name       TEXT,
    email           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_papers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    authors         TEXT,
    source          TEXT,
    abstract        TEXT,
    paper_url       TEXT,
    year            TEXT,
    language        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, title)
);

CREATE TABLE IF NOT EXISTS collaborators (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL,
    role            TEXT DEFAULT 'Research partner',
    status          TEXT DEFAULT 'online',
    focus           TEXT DEFAULT 'New collaborator',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collaboration_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name     TEXT NOT NULL,
    text            TEXT NOT NULL,
    message_type    TEXT DEFAULT 'message',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shared_papers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    source          TEXT,
    authors         TEXT,
    language        TEXT,
    shared_by       TEXT DEFAULT 'You',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_papers_user_idx              ON saved_papers(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS collaborators_user_idx             ON collaborators(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS collaboration_messages_user_idx    ON collaboration_messages(user_id, created_at ASC);
CREATE INDEX IF NOT EXISTS shared_papers_user_idx             ON shared_papers(user_id, created_at DESC);

ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_papers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborators           ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_papers           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_owner_read" ON profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "profiles_owner_insert" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_owner_update" ON profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "saved_papers_owner_all" ON saved_papers
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collaborators_owner_all" ON collaborators
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collaboration_messages_owner_all" ON collaboration_messages
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "shared_papers_owner_all" ON shared_papers
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
