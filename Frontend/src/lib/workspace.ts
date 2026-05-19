import { hasSupabaseConfig, requireSupabase } from './supabase';

export interface SavedPaperRecord {
  id: string;
  title: string;
  authors: string;
  source: string;
  abstract: string;
  paper_url?: string;
  year?: string;
  language?: string;
}

export interface CollaboratorRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'online' | 'offline' | 'reviewing';
  focus: string;
}

export interface CollaborationMessageRecord {
  id: string;
  author_name: string;
  text: string;
  message_type: 'message' | 'question' | 'paper-share';
  created_at: string;
}

export interface SharedPaperRecord {
  id: string;
  title: string;
  source: string;
  authors: string;
  language?: string;
  shared_by: string;
  created_at: string;
}

const GUEST_USER_ID = 'guest-researcher';

const requireUserId = (userId?: string | null) => userId || GUEST_USER_ID;

const isLocalWorkspace = (userId?: string | null) =>
  !hasSupabaseConfig || requireUserId(userId) === GUEST_USER_ID;

const storageKey = (collection: string, userId?: string | null) =>
  `polyresearch:${collection}:${requireUserId(userId)}`;

const readLocal = <T,>(collection: string, userId?: string | null): T[] => {
  const raw = window.localStorage.getItem(storageKey(collection, userId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
};

const writeLocal = <T,>(collection: string, userId: string | null | undefined, records: T[]) => {
  window.localStorage.setItem(storageKey(collection, userId), JSON.stringify(records));
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const workspaceApi = {
  async listSavedPapers(userId?: string | null): Promise<SavedPaperRecord[]> {
    if (isLocalWorkspace(userId)) {
      return readLocal<SavedPaperRecord>('saved_papers', userId);
    }

    const client = requireSupabase();
    const { data, error } = await client
      .from('saved_papers')
      .select('*')
      .eq('user_id', requireUserId(userId))
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async savePaper(userId: string | null | undefined, paper: Omit<SavedPaperRecord, 'id'>) {
    if (isLocalWorkspace(userId)) {
      const existing = readLocal<SavedPaperRecord>('saved_papers', userId);
      const nextRecord: SavedPaperRecord = {
        id: existing.find((item) => item.title === paper.title)?.id || createId(),
        ...paper,
      };
      const next = [nextRecord, ...existing.filter((item) => item.title !== paper.title)];
      writeLocal('saved_papers', userId, next);
      return;
    }

    const client = requireSupabase();
    const { error } = await client.from('saved_papers').upsert(
      {
        user_id: requireUserId(userId),
        title: paper.title,
        authors: paper.authors,
        source: paper.source,
        abstract: paper.abstract,
        paper_url: paper.paper_url,
        year: paper.year,
        language: paper.language,
      },
      { onConflict: 'user_id,title' }
    );

    if (error) throw error;
  },

  async removeSavedPaper(userId: string | null | undefined, title: string) {
    if (isLocalWorkspace(userId)) {
      const existing = readLocal<SavedPaperRecord>('saved_papers', userId);
      writeLocal('saved_papers', userId, existing.filter((item) => item.title !== title));
      return;
    }

    const client = requireSupabase();
    const { error } = await client.from('saved_papers').delete().eq('user_id', requireUserId(userId)).eq('title', title);
    if (error) throw error;
  },

  async listCollaborators(userId?: string | null): Promise<CollaboratorRecord[]> {
    if (isLocalWorkspace(userId)) {
      return readLocal<CollaboratorRecord>('collaborators', userId);
    }

    const client = requireSupabase();
    const { data, error } = await client
      .from('collaborators')
      .select('*')
      .eq('user_id', requireUserId(userId))
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async addCollaborator(userId: string | null | undefined, collaborator: Omit<CollaboratorRecord, 'id'>) {
    if (isLocalWorkspace(userId)) {
      const record: CollaboratorRecord = { id: createId(), ...collaborator };
      const existing = readLocal<CollaboratorRecord>('collaborators', userId);
      writeLocal('collaborators', userId, [record, ...existing]);
      return record;
    }

    const client = requireSupabase();
    const { data, error } = await client
      .from('collaborators')
      .insert({
        user_id: requireUserId(userId),
        ...collaborator,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async listMessages(userId?: string | null): Promise<CollaborationMessageRecord[]> {
    if (isLocalWorkspace(userId)) {
      return readLocal<CollaborationMessageRecord>('collaboration_messages', userId);
    }

    const client = requireSupabase();
    const { data, error } = await client
      .from('collaboration_messages')
      .select('*')
      .eq('user_id', requireUserId(userId))
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  async addMessage(userId: string | null | undefined, message: Omit<CollaborationMessageRecord, 'id' | 'created_at'>) {
    if (isLocalWorkspace(userId)) {
      const record: CollaborationMessageRecord = {
        id: createId(),
        created_at: new Date().toISOString(),
        ...message,
      };
      const existing = readLocal<CollaborationMessageRecord>('collaboration_messages', userId);
      writeLocal('collaboration_messages', userId, [...existing, record]);
      return record;
    }

    const client = requireSupabase();
    const { data, error } = await client
      .from('collaboration_messages')
      .insert({
        user_id: requireUserId(userId),
        ...message,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async listSharedPapers(userId?: string | null): Promise<SharedPaperRecord[]> {
    if (isLocalWorkspace(userId)) {
      return readLocal<SharedPaperRecord>('shared_papers', userId);
    }

    const client = requireSupabase();
    const { data, error } = await client
      .from('shared_papers')
      .select('*')
      .eq('user_id', requireUserId(userId))
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async addSharedPaper(userId: string | null | undefined, paper: Omit<SharedPaperRecord, 'id' | 'created_at'>) {
    if (isLocalWorkspace(userId)) {
      const record: SharedPaperRecord = {
        id: createId(),
        created_at: new Date().toISOString(),
        ...paper,
      };
      const existing = readLocal<SharedPaperRecord>('shared_papers', userId);
      writeLocal(
        'shared_papers',
        userId,
        [record, ...existing.filter((item) => item.title !== paper.title)]
      );
      return record;
    }

    const client = requireSupabase();
    const { data, error } = await client
      .from('shared_papers')
      .insert({
        user_id: requireUserId(userId),
        ...paper,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
