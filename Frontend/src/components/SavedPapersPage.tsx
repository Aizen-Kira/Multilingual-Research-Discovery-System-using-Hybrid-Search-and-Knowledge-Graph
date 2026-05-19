import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, ExternalLink, Trash2, Bookmark, Search, LibraryBig } from 'lucide-react';
import type { AuthUser } from '../lib/auth';
import { getErrorMessage } from '../lib/errors';
import { workspaceApi, type SavedPaperRecord } from '../lib/workspace';

interface SavedPapersPageProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onRequestAuth: () => void;
}

export default function SavedPapersPage({ isOpen, onClose, currentUser, onRequestAuth }: SavedPapersPageProps) {
  const userId = currentUser?.id;
  const [papers, setPapers] = useState<SavedPaperRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadPapers = useCallback(async () => {
    if (!userId) {
      setPapers([]);
      setErrorMessage('');
      return;
    }

    try {
      setPapers(await workspaceApi.listSavedPapers(userId));
      setErrorMessage('');
    } catch (error: unknown) {
      setPapers([]);
      setErrorMessage(getErrorMessage(error, 'Unable to load saved papers.'));
    }
  }, [userId]);

  useEffect(() => {
    if (!isOpen) return;
    void loadPapers();
  }, [isOpen, loadPapers]);

  const removePaper = async (paperTitle: string) => {
    if (!userId) {
      onRequestAuth();
      return;
    }

    try {
      await workspaceApi.removeSavedPaper(userId, paperTitle);
      setPapers((prev) => prev.filter((paper) => paper.title !== paperTitle));
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, 'Unable to remove paper.'));
    }
  };

  const filteredPapers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return papers;

    return papers.filter((paper) =>
      [paper.title, paper.authors, paper.source, paper.abstract]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [papers, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-[var(--bg-overlay)] p-4 backdrop-blur-md md:p-6">
      <div className="mx-auto flex h-full max-w-[1520px] flex-col overflow-hidden rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-strong)]">
        <header className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-shell)] px-5 py-5 md:px-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="premium-shimmer flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--text-accent)]">
                <LibraryBig size={24} />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">Library</div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Saved Papers</h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Your bookmarked research papers, available immediately in guest mode.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative min-w-0 flex-1 md:w-[320px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search saved papers..."
                  className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)] py-3 pl-11 pr-4 text-sm text-[var(--text-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--ring-color)]"
                />
              </div>

              <button
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </header>

        <div className="shrink-0 border-b border-[var(--border-color)] px-5 py-4 md:px-7">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-primary)]">
              <span className="font-semibold">{papers.length}</span> saved
            </div>
            <div className="rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-secondary)]">
              Showing {filteredPapers.length}
            </div>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-6 md:px-7">
          {errorMessage ? (
            <div className="rounded-[1.4rem] border border-[var(--error)]/25 bg-[var(--error)]/10 px-6 py-4 text-sm text-[var(--error)]">
              {errorMessage}
            </div>
          ) : papers.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)]/50 px-6 py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--primary-soft)] text-[var(--text-accent)]">
                <Bookmark size={30} />
              </div>
              <h2 className="mb-2 text-xl font-bold text-[var(--text-primary)]">No saved papers yet</h2>
              <p className="max-w-md text-sm leading-6 text-[var(--text-secondary)]">
                Explore the graph, open a paper, and save the ones worth revisiting. Your guest library will appear here on this device.
              </p>
              <button
                onClick={onClose}
                className="mt-6 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)]"
              >
                Return to graph
              </button>
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)]/50 px-6 py-12 text-center">
              <h2 className="mb-2 text-xl font-bold text-[var(--text-primary)]">No matching saved papers</h2>
              <p className="max-w-md text-sm leading-6 text-[var(--text-secondary)]">
                Try a different title, author, source, or abstract keyword.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredPapers.map((paper) => (
                <article key={`${paper.id}-${paper.title}`} className="soft-card group flex min-h-[320px] flex-col rounded-[1.75rem] p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-accent)]">
                          {paper.source || 'Unknown Source'}
                        </span>
                        {paper.year && (
                          <span className="text-xs text-[var(--text-tertiary)]">{paper.year}</span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold leading-[1.3] text-[var(--text-primary)] line-clamp-3">
                        {paper.title}
                      </h3>
                    </div>

                    <button
                      onClick={() => removePaper(paper.title)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] opacity-100 transition-all hover:border-red-400 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
                      title="Remove paper"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="mb-4 text-sm leading-6 text-[var(--text-secondary)]">
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Authors</div>
                    <p className="line-clamp-3 text-[var(--text-primary)]">{paper.authors || 'Unknown authors'}</p>
                  </div>

                  <div className="flex-1 rounded-[1.4rem] border border-[var(--border-color)] bg-[var(--bg-surface)]/65 p-4">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Abstract</div>
                    <p className="line-clamp-5 text-sm leading-6 text-[var(--text-secondary)]">
                      {paper.abstract || 'No abstract available.'}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <button
                      onClick={() => window.open(paper.paper_url || `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title)}`, '_blank')}
                      className="flex-1 rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)]"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <ExternalLink size={16} />
                        Read paper
                      </span>
                    </button>

                    <button
                      onClick={() => removePaper(paper.title)}
                      className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
