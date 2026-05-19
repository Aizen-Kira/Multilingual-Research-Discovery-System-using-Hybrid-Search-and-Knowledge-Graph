import { useState, useEffect } from 'react';
import { Bookmark, ChevronLeft, FileText, Share2, Globe, Check, Bot, Facebook, Twitter, Linkedin, MessageCircle, Link, Sparkles, Microscope, AlertTriangle } from 'lucide-react';
import type { AuthUser } from '../lib/auth';
import { workspaceApi } from '../lib/workspace';

interface PaperData {
  title: string;
  authors: string;
  source: string;
  abstract: string;
  keywords: string[];
  url?: string;
  quality_score?: number;
  research_domain?: string;
  key_findings?: string[];
  related_papers?: { id: string; title: string }[];
  methodology?: string;
  innovations?: string[] | string;
  contributions?: string[] | string;
  limitations?: string[] | string;
  citations?: number;
  language?: string;
}

interface SidebarProps {
  paper: PaperData | null;
  onOpenLLM?: () => void;
  currentUser: AuthUser | null;
  onRequestAuth: () => void;
  onCollapse?: () => void;
}

const languageMap: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  zh: 'Chinese',
  ja: 'Japanese',
  ar: 'Arabic',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">{children}</h2>;
}

function InfoCard({ title, children, accent = false }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'bg-[var(--primary-soft)] border-[var(--ring-color)]' : 'soft-card'}`}>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-secondary)]">{title}</div>
      {children}
    </div>
  );
}

export default function Sidebar({ paper, onOpenLLM, currentUser, onRequestAuth, onCollapse }: SidebarProps) {
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
  const [isMethodologyExpanded, setIsMethodologyExpanded] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, any>>({});
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setIsTranslated(false);
    setIsTranslating(false);
    setTranslatedTexts({});

    if (!paper?.title || !currentUser?.id) {
      setIsSaved(false);
      return;
    }

    workspaceApi
      .listSavedPapers(currentUser.id)
      .then((saved) => setIsSaved(saved.some((savedPaper) => savedPaper.title === paper.title)))
      .catch(() => setIsSaved(false));
  }, [paper?.title, currentUser?.id]);

  const translateText = async (text: string): Promise<string> => {
    if (!text) return text;

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      const data = await response.json();
      return data[0].map((item: any) => item[0]).join('');
    } catch {
      return `[EN] ${text}`;
    }
  };

  const getListContent = (field: any) => (Array.isArray(field) ? field : field ? [field] : []);

  const handleTranslate = async () => {
    if (isTranslated) {
      setIsTranslated(false);
      return;
    }

    setIsTranslating(true);

    try {
      const newTranslations: Record<string, any> = {};

      if (paper?.title) newTranslations.title = await translateText(paper.title);
      if (paper?.abstract) newTranslations.abstract = await translateText(paper.abstract);
      if (paper?.methodology) newTranslations.methodology = await translateText(paper.methodology);

      const translateArray = async (arr?: string[]) => Promise.all((arr || []).map((text) => translateText(text)));

      newTranslations.key_findings = await translateArray(paper?.key_findings);
      newTranslations.innovations = await translateArray(getListContent(paper?.innovations));
      newTranslations.contributions = await translateArray(getListContent(paper?.contributions));
      newTranslations.limitations = await translateArray(getListContent(paper?.limitations));

      setTranslatedTexts(newTranslations);
      setIsTranslated(true);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSaveToggle = async () => {
    if (!paper) return;
    if (!currentUser?.id) {
      onRequestAuth();
      return;
    }

    if (isSaved) {
      await workspaceApi.removeSavedPaper(currentUser.id, paper.title);
      setIsSaved(false);
      return;
    }

    await workspaceApi.savePaper(currentUser.id, {
      title: paper.title,
      authors: paper.authors,
      source: paper.source,
      abstract: paper.abstract,
      paper_url: paper.url,
      language: paper.language,
      year: '2024',
    });
    setIsSaved(true);
  };

  const getDisplayText = (originalText: string, fieldType: string) => {
    if (!isTranslated || !originalText) return originalText;
    return translatedTexts[fieldType] || originalText;
  };

  const getDisplayArray = (originalArray: string[] | undefined, fieldType: string) => {
    if (!isTranslated || !originalArray?.length) return originalArray || [];
    return translatedTexts[fieldType] || originalArray;
  };

  if (!paper) {
    return (
      <aside className="workspace-sidebar custom-scrollbar h-full w-full border-r border-[var(--border-color)] bg-[var(--bg-panel)] p-8">
        <div className="flex h-full items-center justify-center rounded-[2rem] border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)]/60 p-8 text-center text-[var(--text-secondary)]">
          Select a node to inspect paper details.
        </div>
      </aside>
    );
  }

  const metadata = [
    { label: 'Authors', value: paper.authors || 'Unknown' },
    { label: 'Source', value: paper.source || 'Unknown' },
    { label: 'Year', value: '2024' },
    { label: 'Citations', value: String(paper.citations || 0) },
  ];

  const displayLanguage = languageMap[(paper.language || 'en').toLowerCase()] || (paper.language || 'English');

  return (
    <aside className="workspace-sidebar custom-scrollbar relative flex h-full w-full flex-col overflow-y-auto border-r border-[var(--border-color)] bg-[var(--bg-panel)] p-5 md:p-7">
      <div className="workspace-sidebar__glow absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--primary-soft)] to-transparent pointer-events-none" />

      <div className="relative mb-6 flex items-center justify-between gap-3 border-b border-[var(--border-color)] pb-5">
        <button
          onClick={onCollapse}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title="Collapse details panel"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveToggle}
            className={`flex h-11 items-center justify-center rounded-2xl border px-3 transition-all ${isSaved ? 'soft-chip' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'}`}
            title={isSaved ? 'Remove saved paper' : 'Save paper'}
          >
            <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
          </button>

          <button
            onClick={onOpenLLM}
            className="flex items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-accent)] shadow-[var(--shadow-soft)] transition-all hover:bg-[var(--bg-hover)]"
          >
            <Bot size={16} />
            Ask AI
          </button>

          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all ${isTranslated ? 'soft-chip' : 'bg-[var(--primary-soft)] text-[var(--text-accent)] border-[var(--ring-color)] hover:bg-[var(--bg-hover)]'}`}
          >
            {isTranslating ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-accent)] border-t-transparent" />
            ) : isTranslated ? (
              <>
                <Check size={16} />
                Translated to EN
              </>
            ) : (
              <>
                <Globe size={16} />
                Translate to EN
              </>
            )}
          </button>
        </div>
      </div>

      <div className="relative mb-8">
        <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
          <Sparkles size={14} className="text-[var(--text-accent)]" />
          Selected Paper
        </div>

        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--ring-color)] bg-[var(--primary-soft)] px-3 py-2 text-xs font-semibold text-[var(--text-accent)]">
          <Globe size={14} />
          {displayLanguage} (Original)
        </div>

        <h1 className="mb-6 text-[22px] font-bold leading-[1.24] text-[var(--text-primary)] md:text-[28px]">
          {getDisplayText(paper.title, 'title')}
        </h1>

        <div className="grid gap-3 sm:grid-cols-2">
          {metadata.map((item) => (
            <div key={item.label} className="workspace-meta-card rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-soft)]">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">{item.label}</div>
              <div className="text-sm leading-snug text-[var(--text-primary)]">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-7">
        <SectionTitle>Abstract</SectionTitle>
        <div className="soft-card rounded-[1.6rem] p-5">
          <p className={`text-sm leading-7 text-[var(--text-primary)] ${!isAbstractExpanded ? 'line-clamp-4' : ''}`}>
            {getDisplayText(paper.abstract, 'abstract')}
          </p>
          <button
            onClick={() => setIsAbstractExpanded(!isAbstractExpanded)}
            className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-accent)] transition-colors hover:text-[var(--text-primary)]"
          >
            {isAbstractExpanded ? 'Show Less' : 'Expand'}
          </button>
        </div>
      </div>

      {paper.key_findings && paper.key_findings.length > 0 && (
        <div className="mb-7">
          <InfoCard title="Key Contributions" accent>
            <ul className="list-disc space-y-3 pl-5 text-sm leading-6 text-[var(--text-primary)] marker:text-[var(--text-accent)]">
              {getDisplayArray(paper.key_findings, 'key_findings').map((finding: string, idx: number) => (
                <li key={idx}>{finding}</li>
              ))}
            </ul>
          </InfoCard>
        </div>
      )}

      {paper.related_papers && paper.related_papers.length > 0 && (
        <div className="mb-7">
          <InfoCard title="Cross-Lingual Connections">
            <p className="mb-3 text-xs text-[var(--text-secondary)]">Related papers surfaced across languages.</p>
            <div className="space-y-2">
              {paper.related_papers.slice(0, 3).map((relatedPaper, index) => (
                <div key={relatedPaper.id || relatedPaper.title || index} className="flex items-center justify-between rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-3 text-xs text-[var(--text-primary)] transition-colors hover:border-[var(--primary)]">
                  <span className="truncate">{relatedPaper.title}</span>
                  <span className="rounded-full bg-[var(--primary-soft)] px-2 py-1 text-[10px] font-bold text-[var(--text-accent)]">{94 - index * 3}%</span>
                </div>
              ))}
            </div>
          </InfoCard>
        </div>
      )}

      <div className="mb-7 grid grid-cols-2 gap-4">
        {paper.research_domain && (
          <InfoCard title="Research Domain">
            <p className="text-sm font-semibold leading-6 text-[var(--text-accent)]">{paper.research_domain}</p>
          </InfoCard>
        )}
        {paper.quality_score && (
          <InfoCard title="AI Quality Score">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{Number(paper.quality_score).toFixed(2)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                <div className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[#60A5FA]" style={{ width: `${Math.min(Number(paper.quality_score) * 100, 100)}%` }} />
              </div>
            </div>
          </InfoCard>
        )}
      </div>

      {paper.methodology && (
        <div className="mb-7">
          <SectionTitle>Methodology</SectionTitle>
          <div className="soft-card rounded-[1.6rem] p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Microscope size={16} className="text-[var(--text-accent)]" />
              Research Method
            </div>
            <p className={`text-sm leading-7 text-[var(--text-primary)] ${!isMethodologyExpanded ? 'line-clamp-4' : ''}`}>
              {getDisplayText(paper.methodology, 'methodology')}
            </p>
            <button
              onClick={() => setIsMethodologyExpanded(!isMethodologyExpanded)}
              className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-accent)] transition-colors hover:text-[var(--text-primary)]"
            >
              {isMethodologyExpanded ? 'Show Less' : 'Expand'}
            </button>
          </div>
        </div>
      )}

      {getListContent(paper.innovations).length > 0 && (
        <div className="mb-7">
          <InfoCard title="Core Innovations" accent>
            <ul className="list-disc space-y-3 pl-5 text-sm leading-6 text-[var(--text-primary)] marker:text-[var(--text-accent)]">
              {getDisplayArray(getListContent(paper.innovations), 'innovations').map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </InfoCard>
        </div>
      )}

      {getListContent(paper.contributions).length > 0 && (
        <div className="mb-7">
          <InfoCard title="Additional Contributions">
            <ul className="list-disc space-y-3 pl-5 text-sm leading-6 text-[var(--text-primary)] marker:text-[var(--text-accent)]">
              {getDisplayArray(getListContent(paper.contributions), 'contributions').map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </InfoCard>
        </div>
      )}

      {getListContent(paper.limitations).length > 0 && (
        <div className="mb-7">
          <InfoCard title="Limitations & Considerations">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <AlertTriangle size={16} className="text-[var(--warning)]" />
              Read with caution
            </div>
            <ul className="list-disc space-y-3 pl-5 text-sm leading-6 text-[var(--text-primary)] marker:text-[var(--warning)]">
              {getDisplayArray(getListContent(paper.limitations), 'limitations').map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </InfoCard>
        </div>
      )}

      <div className="mt-auto border-t border-[var(--border-color)] pt-5">
        <SectionTitle>Quick Actions</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => window.open(paper.url || `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title)}`, '_blank')}
            className="rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_var(--primary-glow)] transition-all hover:bg-[var(--primary-strong)]"
          >
            <span className="flex items-center justify-center gap-2">
              <FileText size={16} />
              Read Paper
            </span>
          </button>
          <button
            onClick={() => setIsShareOpen(true)}
            className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-soft)] transition-all hover:bg-[var(--bg-hover)]"
          >
            <span className="flex items-center justify-center gap-2">
              <Share2 size={16} />
              Share Link
            </span>
          </button>
        </div>
      </div>

      {isShareOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-md">
          <div className="glass-panel w-full max-w-sm rounded-[1.75rem] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
                <Share2 size={20} className="text-[var(--text-accent)]" />
                Share Paper
              </h3>
              <button onClick={() => setIsShareOpen(false)} className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                Close
              </button>
            </div>

            <div className="mb-6 grid grid-cols-5 gap-3">
              {[
                { icon: MessageCircle, label: 'WhatsApp', className: 'bg-[#22C55E]' },
                { icon: Linkedin, label: 'LinkedIn', className: 'bg-[#2563EB]' },
                { icon: Twitter, label: 'X', className: 'bg-[#0F172A] text-white' },
                { icon: Facebook, label: 'Facebook', className: 'bg-[#1D4ED8]' },
              ].map(({ icon: Icon, label, className }) => (
                <button key={label} className="flex flex-col items-center gap-2 text-center text-xs text-[var(--text-secondary)] transition-opacity hover:opacity-80">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${className}`}>
                    <Icon size={18} />
                  </div>
                  {label}
                </button>
              ))}
              <button className="flex flex-col items-center gap-2 text-center text-xs text-[var(--text-secondary)] transition-opacity hover:opacity-80">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                  <Link size={18} />
                </div>
                Copy
              </button>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 truncate rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-3 text-xs text-[var(--text-secondary)]">
                {paper.url || `https://mlrd.graph/paper?id=${encodeURIComponent(paper.title)}`}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(paper.url || `https://mlrd.graph/paper?id=${encodeURIComponent(paper.title)}`);
                  setIsShareOpen(false);
                }}
                className="rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)]"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
