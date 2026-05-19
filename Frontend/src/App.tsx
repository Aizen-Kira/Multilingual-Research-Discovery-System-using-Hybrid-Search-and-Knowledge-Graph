import { useEffect, useRef, useState } from 'react';
import Layout from './components/Layout';
import LandingPage from './components/LandingPage';
import GraphView from './components/GraphView';
import Sidebar from './components/Sidebar';
import CollapsedSidebar from './components/CollapsedSidebar';
import TopBar from './components/TopBar';
import SettingsDrawer from './components/SettingsDrawer';
import SavedPapersPage from './components/SavedPapersPage';
import LLMChatPanel from './components/LLMChatPanel';
import CollaborationPage from './components/CollaborationPage';
import AuthPage from './components/AuthPage';
import LoadingOverlay from './components/LoadingOverlay';
import EmptyState from './components/EmptyState';
import ErrorState from './components/ErrorState';
import NotificationsWindow, { type WorkspaceNotification } from './components/NotificationsWindow';
import WorkspaceActionDialog from './components/WorkspaceActionDialog';
import { authApi, type AuthUser } from './lib/auth';
import { hasSupabaseConfig } from './lib/supabase';
import type { GraphData } from './api/client';
import { api } from './api/client';

interface PaperData {
  title: string;
  authors: string;
  source: string;
  abstract: string;
  keywords: string[];
  language?: string;
  citations?: number;
  quality_score?: number;
  research_domain?: string;
  key_findings?: string[];
  methodology?: string;
  limitations?: string[];
  contributions?: string[];
}

interface SearchTransitionState {
  query: string;
  sourceRect: DOMRect;
  targetRect: DOMRect;
  phase: 'capturing' | 'lifting' | 'moving' | 'settling';
}

const GUEST_USER: AuthUser = {
  id: 'guest-researcher',
  name: 'Guest Researcher',
  email: 'Open workspace access',
};

function App() {
  const [selectedPaper, setSelectedPaper] = useState<PaperData | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSavedPapersOpen, setIsSavedPapersOpen] = useState(false);
  const [isCollaborationOpen, setIsCollaborationOpen] = useState(false);
  const [isLLMPanelOpen, setIsLLMPanelOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(hasSupabaseConfig ? null : GUEST_USER);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'recovery'>('login');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'light';
  });
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [estimatedSeconds, setEstimatedSeconds] = useState(3);
  const [searchController, setSearchController] = useState<AbortController | null>(null);
  const [status, setStatus] = useState<'idle' | 'searching' | 'enriching' | 'complete' | 'error'>('idle');
  const [hasEnteredWorkspace, setHasEnteredWorkspace] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [searchTransition, setSearchTransition] = useState<SearchTransitionState | null>(null);
  const [threshold, setThreshold] = useState(0);
  const [maxNodes, setMaxNodes] = useState(30);
  const [showKeyPapers, setShowKeyPapers] = useState(false);
  const [showClusters, setShowClusters] = useState(false);
  const [showCitations, setShowCitations] = useState(true);
  const [resetViewportKey, setResetViewportKey] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isWorkspaceSettingsOpen, setIsWorkspaceSettingsOpen] = useState(false);
  const [isHelpSupportOpen, setIsHelpSupportOpen] = useState(false);
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([
    {
      id: 'welcome',
      title: 'Workspace ready',
      description: 'Your research workspace is set up. Search a topic to generate a graph and start reviewing papers.',
      time: 'Now',
      unread: true,
      kind: 'system',
    },
  ]);

  const landingSearchFieldRef = useRef<HTMLDivElement | null>(null);
  const topBarSearchFieldRef = useRef<HTMLDivElement | null>(null);
  const liftSearchTimerRef = useRef<number | null>(null);
  const moveSearchTimerRef = useRef<number | null>(null);
  const settleSearchTimerRef = useRef<number | null>(null);
  const finishSearchTimerRef = useRef<number | null>(null);
  const transitionFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const handleOpenSavedPapers = () => setIsSavedPapersOpen(true);
    window.addEventListener('openSavedPapers', handleOpenSavedPapers);
    return () => window.removeEventListener('openSavedPapers', handleOpenSavedPapers);
  }, []);

  useEffect(() => {
    const handleOpenCollaborationHub = () => setIsCollaborationOpen(true);
    window.addEventListener('openCollaborationHub', handleOpenCollaborationHub);
    return () => window.removeEventListener('openCollaborationHub', handleOpenCollaborationHub);
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setCurrentUser(GUEST_USER);
      return;
    }

    authApi.getCurrentUser()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));

    const { data } = authApi.onAuthStateChange((_event, _session, user) => {
      setCurrentUser(user);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (settleSearchTimerRef.current) {
        window.clearTimeout(settleSearchTimerRef.current);
      }
      if (liftSearchTimerRef.current) {
        window.clearTimeout(liftSearchTimerRef.current);
      }
      if (moveSearchTimerRef.current) {
        window.clearTimeout(moveSearchTimerRef.current);
      }
      if (finishSearchTimerRef.current) {
        window.clearTimeout(finishSearchTimerRef.current);
      }
      if (transitionFrameRef.current) {
        window.cancelAnimationFrame(transitionFrameRef.current);
      }
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const closeWorkspaceMenu = () => {
    setIsSettingsOpen(false);
  };

  const openDashboard = () => {
    closeWorkspaceMenu();
    setIsSavedPapersOpen(false);
    setIsCollaborationOpen(false);
    setIsNotificationsOpen(false);
    setIsWorkspaceSettingsOpen(false);
    setIsHelpSupportOpen(false);
  };

  const openSavedPapers = () => {
    closeWorkspaceMenu();
    setIsSavedPapersOpen(true);
  };

  const openCollaborationHub = () => {
    closeWorkspaceMenu();
    setIsCollaborationOpen(true);
  };

  const openWorkspaceSettings = () => {
    closeWorkspaceMenu();
    setIsWorkspaceSettingsOpen(true);
  };

  const openHelpSupport = () => {
    closeWorkspaceMenu();
    setIsHelpSupportOpen(true);
  };

  const pushNotification = (notification: WorkspaceNotification) => {
    setNotifications((prev) => [notification, ...prev].slice(0, 12));
  };

  const clearSearchTransitionTimers = () => {
    if (liftSearchTimerRef.current) {
      window.clearTimeout(liftSearchTimerRef.current);
      liftSearchTimerRef.current = null;
    }
    if (moveSearchTimerRef.current) {
      window.clearTimeout(moveSearchTimerRef.current);
      moveSearchTimerRef.current = null;
    }
    if (settleSearchTimerRef.current) {
      window.clearTimeout(settleSearchTimerRef.current);
      settleSearchTimerRef.current = null;
    }
    if (finishSearchTimerRef.current) {
      window.clearTimeout(finishSearchTimerRef.current);
      finishSearchTimerRef.current = null;
    }
    if (transitionFrameRef.current) {
      window.cancelAnimationFrame(transitionFrameRef.current);
      transitionFrameRef.current = null;
    }
  };

  const normalizeErrorCode = (message?: string) => {
    if (!message) return 'NET_ERR_500';

    const compact = message.replace(/\s+/g, ' ').trim();
    const normalized = compact.toUpperCase();
    if (/^<!DOCTYPE HTML|^<HTML/i.test(compact)) return 'API_HTML_RESPONSE';
    if (/<[a-z][\s\S]*>/i.test(compact)) return 'API_HTML_RESPONSE';
    if (/HTML_ERROR_\d{3}/i.test(compact)) return normalized;
    if (/500|internal/i.test(compact)) return 'API_ERR_500';
    if (/404|not found/i.test(compact)) return 'API_ERR_404';
    if (/403|forbidden/i.test(compact)) return 'API_ERR_403';
    if (/401|unauthorized/i.test(compact)) return 'API_ERR_401';
    if (/proxy|gateway|bad gateway/i.test(compact)) return 'API_PROXY_ERR';
    if (/network|fetch|failed to fetch|connection/i.test(compact)) return 'NET_ERR_500';
    if (/timeout/i.test(compact)) return 'REQ_TIMEOUT';

    return compact.length > 36 ? `${compact.slice(0, 33)}...` : compact;
  };

  const cancelSearch = () => {
    if (searchController) {
      searchController.abort();
    }
    setIsLoading(false);
    setStatus('idle');
  };

  const requestAuth = () => {
    if (!hasSupabaseConfig) {
      setCurrentUser(GUEST_USER);
      return;
    }
    setAuthMode('login');
    setIsAuthOpen(true);
  };

  const handleLogin = async (email: string, password: string) => {
    const user = await authApi.signIn(email, password);
    setCurrentUser(user);
    return user;
  };

  const handleRegister = async (name: string, email: string, password: string) => {
    const user = await authApi.signUp(name, email, password);
    setCurrentUser(user);
    return user;
  };

  const handleSignOut = async () => {
    if (!hasSupabaseConfig) {
      setCurrentUser(GUEST_USER);
      return;
    }
    await authApi.signOut();
    setCurrentUser(null);
  };

  const handleSearch = async (query: string) => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;

    setCurrentQuery(normalizedQuery);
    setSelectedPaper(null);
    setStatus('searching');
    setIsLoading(true);
    setError(null);
    setGraphData(null);
    setThreshold(0);
    setShowKeyPapers(false);

    const controller = new AbortController();
    setSearchController(controller);

    setProgress(5);
    setEstimatedSeconds(3);

    const progressInterval = window.setInterval(() => {
      setProgress((p) => Math.min(p + Math.floor(Math.random() * 15), 90));
      setEstimatedSeconds((s) => Math.max(1, s - 0.5));
    }, 500);

    try {
      const result = await api.research(normalizedQuery, 'full', { signal: controller.signal });
      window.clearInterval(progressInterval);
      setProgress(100);

      if (controller.signal.aborted) return;

      if (result.success) {
        setGraphData(result.graph);

        const centerNode = result.graph.nodes.find((n) => n.id === 'center' || n.group === 1);
        if (centerNode && centerNode.data) {
          const authorsStr = Array.isArray(centerNode.data.authors)
            ? centerNode.data.authors.join(', ')
            : centerNode.data.authors || 'Unknown';

          setSelectedPaper({
            title: centerNode.data.title || 'Unknown Title',
            authors: authorsStr,
            source: centerNode.data.source || 'Unknown',
            abstract: centerNode.data.abstract || 'Analyzing...',
            keywords: [centerNode.data.language || 'en'],
            language: centerNode.data.language || 'en',
            citations: centerNode.data.citation_count || 0,
            quality_score: centerNode.data.quality_score,
            research_domain: centerNode.data.research_domain,
            key_findings: centerNode.data.key_findings,
            methodology: centerNode.data.methodology,
            limitations: centerNode.data.limitations,
            contributions: centerNode.data.contributions,
          });
        }

        setIsLoading(false);
        setStatus('complete');
        pushNotification({
          id: `search-${Date.now()}`,
          title: `Graph ready for "${normalizedQuery}"`,
          description: `Your latest search finished successfully and the graph is ready to explore.`,
          time: 'Just now',
          unread: true,
          kind: 'search',
        });
      } else {
        setStatus('error');
        setError({ code: 'API_ERR_FORMAT' });
        setIsLoading(false);
      }
    } catch (searchError: unknown) {
      window.clearInterval(progressInterval);
      if (!controller.signal.aborted) {
        const message = searchError instanceof Error ? searchError.message : undefined;
        setStatus('error');
        setError({ code: normalizeErrorCode(message) });
        setIsLoading(false);
      }
    }
  };

  const handleLandingSearch = (query: string) => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;

    clearSearchTransitionTimers();
    setCurrentQuery(normalizedQuery);

    const sourceRect = landingSearchFieldRef.current?.getBoundingClientRect();
    if (!sourceRect) {
      finishSearchTimerRef.current = window.setTimeout(() => {
        void handleSearch(normalizedQuery);
      }, 120);
      return;
    }

    const searchSnapshot: SearchTransitionState = {
      query: normalizedQuery,
      sourceRect,
      targetRect: sourceRect,
      phase: 'capturing',
    };

    setSearchTransition(searchSnapshot);
    setHasEnteredWorkspace(true);

    let attempts = 0;
    const resolveTargetRect = () => {
      const targetRect = topBarSearchFieldRef.current?.getBoundingClientRect();

      if (targetRect) {
        setSearchTransition({ ...searchSnapshot, targetRect, phase: 'capturing' });

        liftSearchTimerRef.current = window.setTimeout(() => {
          setSearchTransition({ ...searchSnapshot, targetRect, phase: 'lifting' });
        }, 120);

        moveSearchTimerRef.current = window.setTimeout(() => {
          setSearchTransition({
            ...searchSnapshot,
            targetRect,
            phase: 'moving',
          });
        }, 300);

        settleSearchTimerRef.current = window.setTimeout(() => {
          setSearchTransition({
            ...searchSnapshot,
            targetRect,
            phase: 'settling',
          });
          void handleSearch(normalizedQuery);
        }, 1120);

        finishSearchTimerRef.current = window.setTimeout(() => {
          setSearchTransition(null);
        }, 1700);

        transitionFrameRef.current = null;
        return;
      }

      attempts += 1;
      if (attempts > 36) {
        setSearchTransition(null);
        void handleSearch(normalizedQuery);
        transitionFrameRef.current = null;
        return;
      }

      transitionFrameRef.current = window.requestAnimationFrame(resolveTargetRect);
    };

    transitionFrameRef.current = window.requestAnimationFrame(resolveTargetRect);
  };

  const activeSearchRect = searchTransition
    ? searchTransition.phase === 'moving' || searchTransition.phase === 'settling'
      ? searchTransition.targetRect
      : searchTransition.sourceRect
    : null;
  const isTopBarSearchHidden = searchTransition ? searchTransition.phase !== 'settling' : false;
  const hasGraphResults = Boolean(graphData && graphData.nodes.length > 0);

  return (
    <div className="relative flex h-screen w-full overflow-hidden font-sans text-[var(--text-primary)]">
      {hasEnteredWorkspace && (
        <div className={`workspace-stage relative flex h-full w-full flex-col ${searchTransition ? 'workspace-stage--transitioning' : ''}`}>
          <Layout
            sidebarHidden={!hasGraphResults}
            sidebarCollapsed={isSidebarCollapsed}
            navbar={
              <TopBar
                onMenuClick={() => setIsSettingsOpen(true)}
                onSearch={handleSearch}
                initialQuery={currentQuery}
                isSearchTransitioning={isTopBarSearchHidden}
                onSearchFieldReady={(node) => {
                  topBarSearchFieldRef.current = node;
                }}
                currentUser={currentUser}
                onRequestAuth={requestAuth}
                onSignOut={handleSignOut}
                theme={theme}
                onToggleTheme={toggleTheme}
                notifications={notifications}
                onOpenNotifications={() => {
                  setNotifications((prev) =>
                    prev.map((notification) => ({ ...notification, unread: false }))
                  );
                  setIsNotificationsOpen(true);
                }}
              />
            }
            sidebar={
              isSidebarCollapsed ? (
                <CollapsedSidebar onExpand={() => setIsSidebarCollapsed(false)} />
              ) : (
                <Sidebar
                  paper={selectedPaper}
                  onOpenLLM={() => setIsLLMPanelOpen(true)}
                  currentUser={currentUser}
                  onRequestAuth={requestAuth}
                  onCollapse={() => setIsSidebarCollapsed(true)}
                />
              )
            }
          >
            {!isLoading && status !== 'error' && graphData && graphData.nodes.length > 0 ? (
              <GraphView
                onNodeClick={setSelectedPaper}
                theme={theme}
                data={graphData}
                threshold={threshold}
                maxNodes={maxNodes}
                showKeyPapers={showKeyPapers}
                showClusters={showClusters}
                showCitations={showCitations}
                resetViewportKey={resetViewportKey}
                setThreshold={setThreshold}
                setMaxNodes={setMaxNodes}
                setShowKeyPapers={setShowKeyPapers}
                setShowClusters={setShowClusters}
                setShowCitations={setShowCitations}
                onResetLayout={() => setResetViewportKey((prev) => prev + 1)}
              />
            ) : !isLoading && status !== 'error' && status !== 'idle' && graphData && graphData.nodes.length === 0 ? (
              <EmptyState
                onAdjustFilters={() => setIsSettingsOpen(true)}
                onNewSearch={() => {
                  setGraphData(null);
                  setStatus('idle');
                }}
              />
            ) : status === 'idle' && !isLoading ? (
              <div className="workspace-idle-state absolute inset-0 flex items-center justify-center p-8">
                <div className="workspace-idle-state__panel soft-card max-w-2xl rounded-[2rem] p-8 text-center">
                  <div className="mb-4 inline-flex rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
                    Research Workspace
                  </div>
                  <h2 className="mb-3 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                    Start from the search bar to map papers, themes, and relationships.
                  </h2>
                  <p className="mx-auto max-w-xl text-sm leading-7 text-[var(--text-secondary)]">
                    Query in any language and the graph view will build an evidence trail across papers,
                    methods, and related work inside this workspace.
                  </p>
                </div>
              </div>
            ) : null}

            {isLoading && (
              <LoadingOverlay
                progress={progress}
                estimatedSeconds={Math.ceil(estimatedSeconds)}
                onCancel={cancelSearch}
              />
            )}

            {status === 'error' && (
              <ErrorState
                errorCode={error?.code}
                onRetry={() => handleSearch(currentQuery || 'Machine Learning')}
              />
            )}

            {status === 'enriching' && (
              <div className="absolute right-6 top-20 z-40 flex items-center space-x-2 rounded-full border border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.1)] px-4 py-1.5 backdrop-blur animate-pulse">
                <div className="h-2 w-2 animate-ping rounded-full bg-[var(--primary)]" />
                <span className="text-xs font-bold uppercase tracking-tight text-[var(--primary)]">AI Analyzing...</span>
              </div>
            )}
          </Layout>

          {isSettingsOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setIsSettingsOpen(false)}
            />
          )}

          <SettingsDrawer
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onOpenDashboard={openDashboard}
            onOpenSavedPapers={openSavedPapers}
            onOpenCollaborationHub={openCollaborationHub}
            onOpenWorkspaceSettings={openWorkspaceSettings}
            onOpenHelpSupport={openHelpSupport}
          />

          <SavedPapersPage
            isOpen={isSavedPapersOpen}
            onClose={() => setIsSavedPapersOpen(false)}
            currentUser={currentUser}
            onRequestAuth={requestAuth}
          />
          <CollaborationPage
            isOpen={isCollaborationOpen}
            onClose={() => setIsCollaborationOpen(false)}
            currentPaper={selectedPaper}
            currentUser={currentUser}
            onRequestAuth={requestAuth}
          />
          <AuthPage
            isOpen={isAuthOpen}
            mode={authMode}
            onClose={() => setIsAuthOpen(false)}
            onSwitchMode={setAuthMode}
            onAuthSuccess={setCurrentUser}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onForgotPassword={authApi.sendPasswordReset}
            onResetPassword={authApi.updatePassword}
          />
          <LLMChatPanel
            isOpen={isLLMPanelOpen}
            onClose={() => setIsLLMPanelOpen(false)}
            contextPaper={selectedPaper ? {
              title: selectedPaper.title,
              source: selectedPaper.source,
              research_domain: selectedPaper.research_domain,
              citations: selectedPaper.citations,
              abstract: selectedPaper.abstract,
              methodology: selectedPaper.methodology,
              key_findings: selectedPaper.key_findings,
              limitations: selectedPaper.limitations,
              contributions: selectedPaper.contributions,
            } : null}
            currentQuery={currentQuery}
          />
          <WorkspaceActionDialog
            isOpen={isWorkspaceSettingsOpen}
            onClose={() => setIsWorkspaceSettingsOpen(false)}
            eyebrow="Workspace Settings"
            title="Preferences and quick controls"
            description="Use the menu to change appearance and reach the most important workspace tools without leaving the graph."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="soft-card rounded-[1.6rem] border border-[var(--border-color)] px-5 py-5 text-left transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                  Appearance
                </div>
                <div className="text-lg font-semibold text-[var(--text-primary)]">
                  Switch to {theme === 'dark' ? 'light' : 'dark'} mode
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                  Match the workspace tone to your current reading session.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsWorkspaceSettingsOpen(false);
                  setNotifications((prev) =>
                    prev.map((notification) => ({ ...notification, unread: false }))
                  );
                  setIsNotificationsOpen(true);
                }}
                className="soft-card rounded-[1.6rem] border border-[var(--border-color)] px-5 py-5 text-left transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                  Workspace
                </div>
                <div className="text-lg font-semibold text-[var(--text-primary)]">
                  Review alerts and recent activity
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                  Open the activity panel to track searches, collaboration updates, and system notices.
                </p>
              </button>
            </div>
          </WorkspaceActionDialog>

          <WorkspaceActionDialog
            isOpen={isHelpSupportOpen}
            onClose={() => setIsHelpSupportOpen(false)}
            eyebrow="Help & Support"
            title="How to navigate this workspace"
            description="These shortcuts explain what each workspace area does and give you immediate next steps when the graph, paper panel, or copilot need attention."
          >
            <div className="grid gap-3">
              {[
                {
                  title: 'Dashboard',
                  body: 'Return to the main research canvas and close any auxiliary panels that are covering the graph.',
                },
                {
                  title: 'My Papers',
                  body: 'Open the saved papers library to review bookmarked studies and bring one back into the workspace.',
                },
                {
                  title: 'Collaborators',
                  body: 'Open the collaboration hub to share the current paper context, comments, and review activity.',
                },
                {
                  title: 'Need backend help?',
                  body: 'If the copilot cannot reach the RAG backend, the workspace still uses local paper context, but restarting the backend will restore full grounded responses.',
                },
              ].map((item) => (
                <article
                  key={item.title}
                  className="soft-card rounded-[1.4rem] border border-[var(--border-color)] px-5 py-4"
                >
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{item.body}</p>
                </article>
              ))}
            </div>
          </WorkspaceActionDialog>
        </div>
      )}

      {(!hasEnteredWorkspace || Boolean(searchTransition)) && (
        <LandingPage
          theme={theme}
          isTransitioning={Boolean(searchTransition)}
          isExiting={hasEnteredWorkspace}
          onSearch={handleLandingSearch}
          onToggleTheme={toggleTheme}
          onSearchFieldReady={(node) => {
            landingSearchFieldRef.current = node;
          }}
        />
      )}

      {searchTransition && activeSearchRect && (
        <>
          <div className={`search-transition-wash search-transition-wash--${searchTransition.phase}`} />
          <div
            className={`search-shared-transition search-shared-transition--${searchTransition.phase}`}
            style={{
              left: activeSearchRect.left,
              top: activeSearchRect.top,
              width: activeSearchRect.width,
              height: activeSearchRect.height,
            }}
          >
            <div className="search-shared-transition__trail" />
            <div className="search-shared-transition__icon" />
            <span className="search-shared-transition__text">{searchTransition.query}</span>
            <div className="search-shared-transition__spark" />
          </div>
        </>
      )}

      <NotificationsWindow
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={() => {
          setNotifications((prev) =>
            prev.map((notification) => ({ ...notification, unread: false }))
          );
        }}
      />
    </div>
  );
}

export default App;
