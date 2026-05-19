import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { requireSupabase } from './supabase';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

const mapUser = (user: User | null): AuthUser | null => {
  if (!user) return null;

  const metadataName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === 'string'
        ? user.user_metadata.name
        : null;

  return {
    id: user.id,
    name: metadataName || user.email?.split('@')[0] || 'Researcher',
    email: user.email || '',
  };
};

export const authApi = {
  async getCurrentUser(): Promise<AuthUser | null> {
    const client = requireSupabase();
    const {
      data: { session },
    } = await client.auth.getSession();
    return mapUser(session?.user ?? null);
  },

  async signUp(name: string, email: string, password: string): Promise<AuthUser> {
    const client = requireSupabase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) throw error;

    const user = mapUser(data.user);
    if (!user) {
      throw new Error('Registration completed, but no user session is available yet. Check your email if confirmation is enabled.');
    }

    return user;
  },

  async signIn(email: string, password: string): Promise<AuthUser> {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const user = mapUser(data.user);
    if (!user) throw new Error('Unable to create user session.');
    return user;
  },

  async signOut() {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },

  async sendPasswordReset(email: string) {
    const client = requireSupabase();
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },

  async updatePassword(password: string) {
    const client = requireSupabase();
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
  },

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null, user: AuthUser | null) => void) {
    const client = requireSupabase();
    return client.auth.onAuthStateChange((event, session) => {
      callback(event, session, mapUser(session?.user ?? null));
    });
  },
};
