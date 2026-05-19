import { useEffect, useMemo, useState } from 'react';
import { X, Users, UserPlus, Search, Send, Share2, MessageSquareText, Sparkles, Mail, Clock3, FileText, Link2 } from 'lucide-react';
import type { AuthUser } from '../lib/auth';
import { getErrorMessage } from '../lib/errors';
import { workspaceApi, type CollaboratorRecord, type CollaborationMessageRecord, type SharedPaperRecord } from '../lib/workspace';

interface PaperData {
  title: string;
  authors: string;
  source: string;
  abstract: string;
  keywords: string[];
  language?: string;
}

interface CollaborationPageProps {
  isOpen: boolean;
  onClose: () => void;
  currentPaper: PaperData | null;
  currentUser: AuthUser | null;
  onRequestAuth: () => void;
}

const DEFAULT_COLLABORATORS: Omit<CollaboratorRecord, 'id'>[] = [
  { name: 'Nina Carter', email: 'nina@labmail.ai', role: 'Co-author', status: 'online', focus: 'Literature review' },
  { name: 'Arjun Mehta', email: 'arjun@labmail.ai', role: 'Method reviewer', status: 'reviewing', focus: 'Methodology checks' },
  { name: 'Lina Gomez', email: 'lina@labmail.ai', role: 'Domain expert', status: 'offline', focus: 'Paper triage' },
];

const DEFAULT_MESSAGES: Omit<CollaborationMessageRecord, 'id' | 'created_at'>[] = [
  {
    author_name: 'Nina Carter',
    text: "Let's use this space to review important papers, raise questions, and keep track of who is following up on what.",
    message_type: 'message',
  },
  {
    author_name: 'Arjun Mehta',
    text: 'Question: can we compare the methodology section across the top 5 relevant papers before the meeting?',
    message_type: 'question',
  },
];

const initialsFromName = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'FR';

export default function CollaborationPage({ isOpen, onClose, currentPaper, currentUser, onRequestAuth }: CollaborationPageProps) {
  const [collaborators, setCollaborators] = useState<CollaboratorRecord[]>([]);
  const [messages, setMessages] = useState<CollaborationMessageRecord[]>([]);
  const [sharedPapers, setSharedPapers] = useState<SharedPaperRecord[]>([]);
  const [collaboratorQuery, setCollaboratorQuery] = useState('');
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendEmail, setNewFriendEmail] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (!currentUser?.id) {
      setCollaborators([]);
      setMessages([]);
      setSharedPapers([]);
      setErrorMessage('');
      return;
    }

    Promise.all([
      workspaceApi.listCollaborators(currentUser.id),
      workspaceApi.listMessages(currentUser.id),
      workspaceApi.listSharedPapers(currentUser.id),
    ])
      .then(async ([collaboratorRows, messageRows, sharedRows]) => {
        let nextCollaborators = collaboratorRows;
        let nextMessages = messageRows;

        if (collaboratorRows.length === 0) {
          nextCollaborators = await Promise.all(DEFAULT_COLLABORATORS.map((collaborator) => workspaceApi.addCollaborator(currentUser.id!, collaborator)));
        }

        if (messageRows.length === 0) {
          nextMessages = await Promise.all(DEFAULT_MESSAGES.map((message) => workspaceApi.addMessage(currentUser.id!, message)));
        }

        setCollaborators(nextCollaborators);
        setMessages(nextMessages);
        setSharedPapers(sharedRows);
        setErrorMessage('');
      })
      .catch((error: unknown) => {
        setErrorMessage(getErrorMessage(error, 'Unable to load collaboration data.'));
      });
  }, [isOpen, currentUser?.id, onRequestAuth]);

  const filteredCollaborators = useMemo(() => {
    const query = collaboratorQuery.trim().toLowerCase();
    if (!query) return collaborators;

    return collaborators.filter((person) =>
      [person.name, person.email, person.role, person.focus]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [collaborators, collaboratorQuery]);

  const onlineCount = collaborators.filter((person) => person.status === 'online').length;

  const addCollaborator = async () => {
    const name = newFriendName.trim();
    const email = newFriendEmail.trim();
    if (!name || !email) return;
    if (!currentUser?.id) {
      onRequestAuth();
      return;
    }

    try {
      const collaborator = await workspaceApi.addCollaborator(currentUser.id, {
        name,
        email,
        role: 'Research partner',
        status: 'online',
        focus: 'New collaborator',
      });
      const message = await workspaceApi.addMessage(currentUser.id, {
        author_name: 'You',
        text: `Invited ${name} to collaborate on paper discussions and shared reading.`,
        message_type: 'message',
      });
      setCollaborators((prev) => [collaborator, ...prev]);
      setMessages((prev) => [...prev, message]);
      setNewFriendName('');
      setNewFriendEmail('');
      setErrorMessage('');
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, 'Unable to add collaborator.'));
    }
  };

  const sendMessage = async () => {
    const text = draftMessage.trim();
    if (!text) return;
    if (!currentUser?.id) {
      onRequestAuth();
      return;
    }

    try {
      const message = await workspaceApi.addMessage(currentUser.id, {
        author_name: 'You',
        text,
        message_type: /\?/.test(text) ? 'question' : 'message',
      });
      setMessages((prev) => [...prev, message]);
      setDraftMessage('');
      setErrorMessage('');
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, 'Unable to send message.'));
    }
  };

  const shareCurrentPaper = async () => {
    if (!currentPaper) return;
    if (!currentUser?.id) {
      onRequestAuth();
      return;
    }

    try {
      const sharedPaper = await workspaceApi.addSharedPaper(currentUser.id, {
        title: currentPaper.title,
        source: currentPaper.source,
        authors: currentPaper.authors,
        language: currentPaper.language,
        shared_by: 'You',
      });
      const message = await workspaceApi.addMessage(currentUser.id, {
        author_name: 'You',
        text: `Shared paper: "${currentPaper.title}" for discussion.`,
        message_type: 'paper-share',
      });
      setSharedPapers((prev) => [sharedPaper, ...prev.filter((paper) => paper.title !== sharedPaper.title)]);
      setMessages((prev) => [...prev, message]);
      setErrorMessage('');
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, 'Unable to share paper.'));
    }
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[115] bg-[var(--bg-overlay)] p-4 backdrop-blur-md md:p-6">
      <div className="mx-auto flex h-full max-w-[1640px] flex-col overflow-hidden rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-strong)]">
        <header className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-shell)] px-5 py-5 md:px-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="premium-shimmer flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--text-accent)]">
                <Users size={24} />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">Workspace</div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Collaboration Hub</h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Add collaborators, share papers, and discuss research questions in one place.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-primary)]">
                <span className="font-semibold">{collaborators.length}</span> collaborators
              </div>
              <div className="rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-secondary)]">
                {onlineCount} online now
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

        <div className="grid flex-1 overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          {(
            <>
              <aside className="custom-scrollbar overflow-y-auto border-b border-[var(--border-color)] px-5 py-6 xl:border-b-0 xl:border-r md:px-6">
                <div className="mb-6">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">Invite Collaborators</div>
                  <div className="soft-card rounded-[1.6rem] p-4">
                    <div className="mb-3 grid gap-3">
                      <input
                        value={newFriendName}
                        onChange={(e) => setNewFriendName(e.target.value)}
                        placeholder="Friend name"
                        className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--ring-color)]"
                      />
                      <input
                        value={newFriendEmail}
                        onChange={(e) => setNewFriendEmail(e.target.value)}
                        placeholder="Email address"
                        className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--ring-color)]"
                      />
                    </div>
                    <button
                      onClick={addCollaborator}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)]"
                    >
                      <UserPlus size={16} />
                      Add collaborator
                    </button>
                  </div>
                </div>

                <div className="mb-4 flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">People</div>
                  <span className="text-xs text-[var(--text-tertiary)]">{filteredCollaborators.length} shown</span>
                </div>

                <div className="relative mb-4">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    value={collaboratorQuery}
                    onChange={(e) => setCollaboratorQuery(e.target.value)}
                    placeholder="Search collaborators"
                    className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)] py-3 pl-11 pr-4 text-sm text-[var(--text-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--ring-color)]"
                  />
                </div>

                <div className="space-y-3">
                  {filteredCollaborators.map((person) => (
                    <div key={person.id} className="soft-card rounded-[1.5rem] p-4">
                      <div className="mb-3 flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-sm font-bold text-[var(--text-accent)]">
                          {initialsFromName(person.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{person.name}</h3>
                            <span className={`h-2.5 w-2.5 rounded-full ${person.status === 'online' ? 'bg-[var(--status-online)] shadow-[0_0_8px_var(--status-online)]' : person.status === 'reviewing' ? 'bg-[var(--status-reviewing)] shadow-[0_0_8px_var(--status-reviewing)]' : 'bg-[var(--status-offline)]'}`} />
                          </div>
                          <p className="truncate text-xs text-[var(--text-secondary)]">{person.email}</p>
                        </div>
                      </div>
                      <div className="grid gap-2 text-xs text-[var(--text-secondary)]">
                        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
                          <span className="font-semibold text-[var(--text-primary)]">Role:</span> {person.role}
                        </div>
                        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
                          <span className="font-semibold text-[var(--text-primary)]">Focus:</span> {person.focus}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

              <section className="flex min-h-0 flex-col border-b border-[var(--border-color)] xl:border-b-0 xl:border-r">
                <div className="shrink-0 border-b border-[var(--border-color)] px-5 py-5 md:px-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">Research Discussion</div>
                      <h2 className="text-xl font-bold text-[var(--text-primary)]">Team Thread</h2>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Ask questions, assign reading, and capture research decisions around shared papers.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-secondary)]">
                        {messages.length} thread updates
                      </div>
                      <button
                        onClick={shareCurrentPaper}
                        disabled={!currentPaper}
                        className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                          currentPaper
                            ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)]'
                            : 'cursor-not-allowed border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-tertiary)]'
                        }`}
                      >
                        <Share2 size={16} />
                        Share selected paper
                      </button>
                    </div>
                  </div>
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-6 md:px-6">
                  {errorMessage && (
                    <div className="mb-4 rounded-[1.4rem] border border-[var(--error)]/20 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]">
                      {errorMessage}
                    </div>
                  )}
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <article key={message.id} className="soft-card rounded-[1.6rem] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${message.message_type === 'question' ? 'bg-[var(--status-reviewing)]/15 text-[var(--status-reviewing)]' : message.message_type === 'paper-share' ? 'bg-[var(--primary-soft)] text-[var(--text-accent)]' : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'}`}>
                              {message.message_type === 'question' ? <Sparkles size={16} /> : message.message_type === 'paper-share' ? <Link2 size={16} /> : <MessageSquareText size={16} />}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-[var(--text-primary)]">{message.author_name}</div>
                              <div className="text-xs text-[var(--text-tertiary)]">{message.message_type === 'question' ? 'Research question' : message.message_type === 'paper-share' ? 'Paper shared' : 'Comment'}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                            <Clock3 size={13} />
                            {formatTime(message.created_at)}
                          </div>
                        </div>
                        <p className="text-sm leading-7 text-[var(--text-primary)]">{message.text}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 border-t border-[var(--border-color)] px-5 py-5 md:px-6">
                  <div className="soft-card rounded-[1.6rem] p-4">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">New Message</div>
                    <div className="flex flex-col gap-3 lg:flex-row">
                      <textarea
                        value={draftMessage}
                        onChange={(e) => setDraftMessage(e.target.value)}
                        placeholder="Ask your collaborators about a paper, assign a follow-up, or raise a research question..."
                        className="min-h-[110px] flex-1 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--ring-color)]"
                      />
                      <button
                        onClick={sendMessage}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)] lg:self-stretch"
                      >
                        <Send size={16} />
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <aside className="custom-scrollbar overflow-y-auto px-5 py-6 md:px-6">
                <div className="mb-6">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">Shared Research</div>
                  <div className="soft-card rounded-[1.6rem] p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                      <FileText size={16} className="text-[var(--text-accent)]" />
                      Active paper context
                    </div>
                    {currentPaper ? (
                      <>
                        <h3 className="mb-2 text-base font-bold leading-6 text-[var(--text-primary)]">{currentPaper.title}</h3>
                        <p className="mb-3 text-sm text-[var(--text-secondary)]">{currentPaper.authors}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-accent)]">
                            {currentPaper.source}
                          </span>
                          {currentPaper.language && (
                            <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                              {currentPaper.language}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm leading-6 text-[var(--text-secondary)]">
                        Select a paper from the graph first, then share it here with one click.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-4 flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">Shared Papers</div>
                  <span className="text-xs text-[var(--text-tertiary)]">{sharedPapers.length} total</span>
                </div>

                <div className="space-y-3">
                  {sharedPapers.length === 0 ? (
                    <div className="rounded-[1.6rem] border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)]/50 p-5 text-sm leading-6 text-[var(--text-secondary)]">
                      No papers have been shared yet. Use the selected-paper shortcut to start a discussion around a paper.
                    </div>
                  ) : (
                    sharedPapers.map((paper) => (
                      <article key={paper.id} className="soft-card rounded-[1.6rem] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-accent)]">
                            {paper.source}
                          </span>
                          <span className="text-xs text-[var(--text-tertiary)]">{formatTime(paper.created_at)}</span>
                        </div>
                        <h3 className="mb-2 text-sm font-semibold leading-6 text-[var(--text-primary)]">{paper.title}</h3>
                        <p className="mb-3 line-clamp-2 text-sm text-[var(--text-secondary)]">{paper.authors}</p>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                          <Mail size={13} />
                          Shared by {paper.shared_by}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </aside>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
