import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  History,
  Menu,
  Mic,
  Moon,
  Search,
  Settings2,
  SunMedium,
  TrendingUp,
  UserCircle2,
  X,
} from 'lucide-react';
import type { WorkspaceNotification } from './NotificationsWindow';

interface TopBarProps {
  onMenuClick: () => void;
  onSearch: (query: string) => void;
  initialQuery?: string;
  isSearchTransitioning?: boolean;
  onSearchFieldReady?: (node: HTMLDivElement | null) => void;
  currentUser?: { name: string; email: string } | null;
  onRequestAuth?: () => void;
  onSignOut?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  notifications?: WorkspaceNotification[];
  onOpenNotifications?: () => void;
}

const POPULAR_TOPICS = [
  'Large Language Models',
  'Retrieval-Augmented Generation',
  'Graph Neural Networks',
  'Quantum Computing',
  'CRISPR Cas9',
];

export default function TopBar({
  onMenuClick,
  onSearch,
  initialQuery = '',
  isSearchTransitioning = false,
  onSearchFieldReady,
  currentUser,
  onRequestAuth,
  onSignOut,
  theme,
  onToggleTheme,
  notifications = [],
  onOpenNotifications,
}: TopBarProps) {
  const [queryText, setQueryText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isAccountHovered, setIsAccountHovered] = useState(false);
  const [isNotificationHovered, setIsNotificationHovered] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchFieldRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (!saved) return;

    try {
      setRecentSearches(JSON.parse(saved));
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    setQueryText(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    onSearchFieldReady?.(searchFieldRef.current);
    return () => onSearchFieldReady?.(null);
  }, [onSearchFieldReady]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (searchRef.current && !searchRef.current.contains(target)) {
        setIsFocused(false);
      }

      if (accountRef.current && !accountRef.current.contains(target)) {
        setIsAccountHovered(false);
      }

      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setIsNotificationHovered(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const executeSearch = (term: string) => {
    if (!term.trim()) return;

    const normalizedTerm = term.trim();
    const newRecents = [normalizedTerm, ...recentSearches.filter((item) => item !== normalizedTerm)].slice(0, 5);
    setRecentSearches(newRecents);
    localStorage.setItem('recentSearches', JSON.stringify(newRecents));

    setQueryText(normalizedTerm);
    setIsFocused(false);
    onSearch(normalizedTerm);
  };

  const clearRecents = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  const initials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')
    : 'GU';

  const unreadCount = notifications.filter((notification) => notification.unread).length;
  const previewNotifications = useMemo(() => notifications.slice(0, 3), [notifications]);

  return (
    <header className="app-topbar workspace-topbar sticky top-0 z-20 border-b border-[var(--border-color)] bg-[var(--bg-shell)] px-4 py-3 backdrop-blur-xl md:px-6">
      <div className="workspace-topbar__inner mx-auto grid max-w-[1640px] grid-cols-[48px_1fr_auto] items-center gap-3 md:gap-4">
        <button
          onClick={onMenuClick}
          className="workspace-icon-button flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div
          ref={searchRef}
          className="workspace-search-shell relative min-w-0 max-w-4xl justify-self-center w-full md:w-[min(100%,720px)] lg:w-[min(100%,760px)]"
        >
          <div
            ref={searchFieldRef}
            className={`workspace-search-field relative transition-all duration-300 ${
              isSearchTransitioning ? 'translate-y-2 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
            }`}
          >
            <Search
              className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors ${
                isFocused ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]'
              }`}
            />
            <input
              type="text"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onKeyDown={(event) => event.key === 'Enter' && executeSearch(queryText)}
              placeholder="Search in any language..."
              className={`w-full rounded-[1.4rem] border bg-[var(--bg-input)] py-3.5 pl-12 pr-28 text-[var(--text-primary)] placeholder-[var(--text-secondary)] shadow-[var(--shadow-soft)] outline-none transition-all duration-300 ${
                isFocused
                  ? 'border-[var(--ring-color)] rounded-b-lg ring-4 ring-[var(--ring-color)]'
                  : 'border-[var(--border-color)]'
              }`}
            />

            <div className="absolute inset-y-0 right-3 flex items-center gap-2">
              {queryText && (
                <button
                  onClick={() => setQueryText('')}
                  className="workspace-inline-icon rounded-full p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <div className="h-5 w-px bg-[var(--border-color)]" />
              <button className="workspace-inline-icon rounded-full p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                <Mic className="h-4 w-4" />
              </button>
            </div>

            {isFocused && (
              <div className="glass-panel absolute left-0 top-full w-full overflow-hidden rounded-b-[1.4rem] rounded-t-none">
                {recentSearches.length > 0 && !queryText && (
                  <div className="border-b border-[var(--border-color)] py-2">
                    <div className="flex items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                      <span>Recent Searches</span>
                      <button onClick={clearRecents} className="transition-colors hover:text-[var(--text-primary)]">
                        Clear
                      </button>
                    </div>
                    <ul>
                      {recentSearches.map((term) => (
                        <li key={term}>
                          <button
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                            onClick={() => executeSearch(term)}
                          >
                            <History className="h-4 w-4 text-[var(--text-secondary)]" />
                            {term}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!queryText && (
                  <div className="py-2">
                    <div className="px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                      Popular Topics
                    </div>
                    <ul>
                      {POPULAR_TOPICS.map((topic) => (
                        <li key={topic}>
                          <button
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--text-accent)] transition-colors hover:bg-[var(--bg-hover)]"
                            onClick={() => executeSearch(topic)}
                          >
                            <TrendingUp className="h-4 w-4" />
                            {topic}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {queryText && (
                  <div className="py-2">
                    <button
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                      onClick={() => executeSearch(queryText)}
                    >
                      <span className="flex items-center gap-3">
                        <Search className="h-4 w-4 text-[var(--primary)]" />
                        Search all languages
                      </span>
                      <span className="soft-chip rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]">
                        Auto
                      </span>
                    </button>

                    <div className="px-4 pt-3 text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                      Suggestions
                    </div>
                    <button
                      onClick={() => executeSearch(`${queryText} Machine Learning`)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-accent)]"
                    >
                      <span className="text-base">EN</span>
                      <span className="flex-1">{queryText} (English)</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">234 papers</span>
                    </button>
                    <button
                      onClick={() => executeSearch(`Grandes Modelos ${queryText}`)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-accent)]"
                    >
                      <span className="text-base">ES</span>
                      <span className="flex-1">Translation for {queryText}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">89 papers</span>
                    </button>
                    <button
                      onClick={() => executeSearch(`Modelos ${queryText}`)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-accent)]"
                    >
                      <span className="text-base">PT</span>
                      <span className="flex-1">Translation for {queryText}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">45 papers</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => executeSearch(queryText)}
              className="workspace-icon-button flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] md:hidden"
            >
              <Search className="h-5 w-5" />
            </button>

            <button
              onClick={onToggleTheme}
              className="workspace-icon-button flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <SunMedium className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <div
            ref={notificationRef}
            className="relative"
            onMouseEnter={() => setIsNotificationHovered(true)}
            onMouseLeave={() => setIsNotificationHovered(false)}
          >
            <button
              onClick={onOpenNotifications}
              className="workspace-icon-button relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex min-h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white">
                  {Math.min(unreadCount, 9)}
                </span>
              )}
            </button>

            {isNotificationHovered && (
              <div className="glass-panel absolute right-0 top-[calc(100%+10px)] z-50 w-[320px] rounded-[1.4rem] p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    Notifications
                  </div>
                  <button
                    onClick={onOpenNotifications}
                    className="text-xs font-semibold text-[var(--text-accent)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    View all
                  </button>
                </div>

                {previewNotifications.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-dashed border-[var(--border-color)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                    No new notifications
                  </div>
                ) : (
                  <div className="space-y-2">
                    {previewNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`rounded-[1.2rem] border px-3 py-3 ${
                          notification.unread
                            ? 'border-[var(--ring-color)] bg-[var(--primary-soft)]'
                            : 'border-[var(--border-color)] bg-[var(--bg-surface)]'
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-[var(--text-primary)]">{notification.title}</div>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                            {notification.time}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs leading-6 text-[var(--text-secondary)]">
                          {notification.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            ref={accountRef}
            className="relative"
            onMouseEnter={() => setIsAccountHovered(true)}
            onMouseLeave={() => setIsAccountHovered(false)}
          >
            <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-gradient-to-br from-[var(--primary)] to-[hsl(221,100%,75%)] text-xs font-bold text-white shadow-[0_10px_24px_var(--primary-glow)] transition-transform duration-300 hover:-translate-y-0.5">
              {initials}
            </button>

            {isAccountHovered && (
              <div className="glass-panel absolute right-0 top-[calc(100%+10px)] z-50 w-[280px] rounded-[1.4rem] p-3">
                <div className="rounded-[1.2rem] border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[hsl(221,100%,75%)] text-sm font-bold text-white">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {currentUser?.name || 'Guest Researcher'}
                      </div>
                      <div className="truncate text-xs text-[var(--text-secondary)]">
                        {currentUser?.email || 'Sign in to save your workspace'}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                    {currentUser
                      ? 'Signed in workspace data is synced through Supabase.'
                      : 'Sign in to sync saved papers and collaboration across sessions.'}
                  </div>

                  <div className="space-y-2">
                    {currentUser ? (
                      <button
                        onClick={onSignOut}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        <UserCircle2 className="h-4 w-4 text-[var(--text-accent)]" />
                        Sign out
                      </button>
                    ) : (
                      <button
                        onClick={onRequestAuth}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        <UserCircle2 className="h-4 w-4 text-[var(--text-accent)]" />
                        Sign in to workspace
                      </button>
                    )}
                    <button
                      onClick={onMenuClick}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      <Settings2 className="h-4 w-4 text-[var(--text-accent)]" />
                      Open workspace menu
                    </button>

                    <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-[var(--text-secondary)]">
                      <UserCircle2 className="h-4 w-4" />
                      {currentUser ? 'Authenticated workspace access' : 'Guest workspace access'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
