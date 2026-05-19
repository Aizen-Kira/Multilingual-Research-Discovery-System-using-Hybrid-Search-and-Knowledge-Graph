import { type ReactNode, useEffect, useState } from 'react';
import { FileText, Layers3 } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  navbar: ReactNode;
  sidebar: ReactNode;
  sidebarCollapsed?: boolean;
  sidebarHidden?: boolean;
}

export default function Layout({
  children,
  navbar,
  sidebar,
  sidebarCollapsed = false,
  sidebarHidden = false,
}: LayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<'graph' | 'details'>('graph');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="workspace-shell flex h-screen w-full flex-col overflow-hidden bg-[var(--bg-primary)] font-sans transition-colors duration-300">
      {navbar}

      {isMobile && (
        <div className="z-20 flex w-full shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
          <button
            onClick={() => setActiveTab('graph')}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-bold ${
              activeTab === 'graph'
                ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            <Layers3 size={16} /> Graph View
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-bold ${
              activeTab === 'details'
                ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            <FileText size={16} /> Details
          </button>
        </div>
      )}

      <div
        className={`workspace-grid relative flex-1 overflow-hidden ${
          !isMobile
            ? `grid ${
                sidebarHidden
                  ? 'grid-cols-[minmax(0,1fr)]'
                  : sidebarCollapsed
                    ? 'grid-cols-[72px_minmax(0,1fr)]'
                    : 'grid-cols-[448px_minmax(0,1fr)]'
              }`
            : 'flex flex-col'
        }`}
      >
        {!sidebarHidden && (!isMobile || activeTab === 'details') && (
          <div className="app-panel app-panel--sidebar h-full min-h-0 overflow-hidden">
            {sidebar}
          </div>
        )}

        {(!isMobile || activeTab === 'graph') && (
          <main className="app-panel app-panel--main relative h-full w-full overflow-hidden bg-[var(--bg-primary)] transition-colors">
            {children}
          </main>
        )}

      </div>
    </div>
  );
}
