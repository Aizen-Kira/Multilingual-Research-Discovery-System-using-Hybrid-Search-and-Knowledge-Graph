import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  BrainCircuit,
  CheckCircle2,
  DatabaseZap,
  FileSearch,
  Globe2,
  Languages,
  Layers3,
  MessageSquareText,
  Moon,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  SunMedium,
  UsersRound,
  Workflow,
  Zap,
} from 'lucide-react';
import { LandingThreeBackground } from './LandingThreeBackground';
import './premium-landing.css';

interface LandingPageProps {
  theme: 'dark' | 'light';
  isTransitioning?: boolean;
  isExiting?: boolean;
  onSearch: (query: string) => void;
  onToggleTheme?: () => void;
  onSearchFieldReady?: (node: HTMLDivElement | null) => void;
}

const HERO_BADGES = ['AI literature discovery', 'Graph intelligence', 'Team review', 'Multilingual search'];

const STYLE_OPTIONS = [
  {
    id: 'atlas',
    label: 'Atlas',
    title: 'Bright graph workspace',
  },
  {
    id: 'studio',
    label: 'Studio',
    title: 'Focused product deck',
  },
  {
    id: 'journal',
    label: 'Journal',
    title: 'Academic editorial view',
  },
] as const;

type StyleOptionId = (typeof STYLE_OPTIONS)[number]['id'];

const HERO_METRICS = [
  { value: '5', label: 'research sources unified' },
  { value: '8', label: 'query languages expanded' },
  { value: '1', label: 'workspace from search to review' },
];

const SUGGESTED_QUERIES = [
  'Graph neural networks for medical diagnosis',
  'Federated learning privacy in healthcare',
  'Explainable AI for climate prediction',
];

const COMMAND_ITEMS = [
  { label: 'Query expansion', value: '8 languages', icon: Languages },
  { label: 'Evidence filter', value: 'quality and relevance', icon: ShieldCheck },
  { label: 'Graph build', value: 'clusters and bridges', icon: Network },
  { label: 'AI review', value: 'summaries and gaps', icon: Bot },
];

const CAPABILITIES = [
  {
    title: 'Search Beyond Keywords',
    body: 'The workspace expands the original question, checks multiple academic sources, and keeps the results tied to the query intent.',
    icon: FileSearch,
  },
  {
    title: 'Read The Structure',
    body: 'Papers are converted into a visual map so users can see clusters, bridges, methods, citations, and weakly covered areas.',
    icon: Network,
  },
  {
    title: 'Review With Context',
    body: 'The copilot can discuss the active paper, compare findings, explain limitations, and surface practical next steps.',
    icon: BrainCircuit,
  },
  {
    title: 'Work As A Team',
    body: 'Saved papers, collaboration notes, and shared discussion keep the research process useful after the first search.',
    icon: UsersRound,
  },
];

const SECTIONS = [
  {
    id: 'source-mesh',
    step: '01',
    eyebrow: 'Source mesh',
    title: 'Collect papers from trusted sources without losing the research question.',
    body:
      'PolyResearch turns a single topic into a controlled discovery run across academic sources, multilingual variants, and relevance checks. Users get a clean evidence layer instead of a pile of tabs.',
    points: ['Academic source routing', 'Relevance and quality filtering', 'Duplicate-aware result handling'],
    icon: DatabaseZap,
    accent: 'blue',
  },
  {
    id: 'global-search',
    step: '02',
    eyebrow: 'Global search',
    title: 'Open the literature map to non-English signals and regional research.',
    body:
      'The landing page now explains why multilingual expansion matters: strong papers can sit outside the original language, and the app keeps those signals inside one ranked workspace.',
    points: ['Cross-language query variants', 'Global literature coverage', 'One ranked result stream'],
    icon: Globe2,
    accent: 'cyan',
  },
  {
    id: 'visual-analysis',
    step: '03',
    eyebrow: 'Visual analysis',
    title: 'Reveal clusters, bridges, and research gaps through a graph-first canvas.',
    body:
      'A graph is the product advantage. The UI now positions it as a reasoning layer where users can inspect relationships, find central papers, and see what needs more evidence.',
    points: ['Cluster-first exploration', 'Similarity and citation signals', 'Gap and bridge discovery'],
    icon: Workflow,
    accent: 'violet',
  },
  {
    id: 'review-layer',
    step: '04',
    eyebrow: 'Review layer',
    title: 'Move from discovery to decisions with grounded AI and collaboration.',
    body:
      'The final stage makes the project feel complete: users can save papers, discuss evidence, ask the copilot, and turn the graph into a defendable research direction.',
    points: ['Grounded paper summaries', 'Shared review workflow', 'Decision-ready synthesis'],
    icon: Bot,
    accent: 'orange',
  },
];

const USE_CASES = [
  {
    title: 'Final year project research',
    body: 'Build a literature review, identify methodology gaps, and defend why the selected topic has room for contribution.',
    icon: BookOpenCheck,
  },
  {
    title: 'Lab and team review',
    body: 'Collect relevant studies, discuss evidence with collaborators, and keep every decision attached to the source paper.',
    icon: MessageSquareText,
  },
  {
    title: 'Fast topic scouting',
    body: 'Turn an unfamiliar area into a readable map of authors, methods, clusters, and promising follow-up questions.',
    icon: Zap,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export default function LandingPage({
  theme,
  isTransitioning = false,
  isExiting = false,
  onSearch,
  onToggleTheme,
  onSearchFieldReady,
}: LandingPageProps) {
  const [query, setQuery] = useState('');
  const [styleOption, setStyleOption] = useState<StyleOptionId>('atlas');
  const searchFieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onSearchFieldReady?.(searchFieldRef.current);
    return () => onSearchFieldReady?.(null);
  }, [onSearchFieldReady]);

  const submitSearch = () => {
    if (!query.trim() || isTransitioning) return;
    onSearch(query.trim());
  };

  const runSuggestedSearch = (suggestedQuery: string) => {
    if (isTransitioning) return;
    setQuery(suggestedQuery);
    onSearch(suggestedQuery);
  };

  return (
    <div
      className={`premium-page-shell ${isExiting ? 'opacity-0 transition-opacity duration-500' : ''}`}
      style={{ position: 'absolute', inset: 0, zIndex: 10 }}
    >
      <div className={`premium-page premium-page--${styleOption} ${isTransitioning ? 'premium-page--transitioning' : ''}`}>
        <LandingThreeBackground styleOption={styleOption} theme={theme} />

        <motion.div
          className="premium-top-band"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="premium-top-band__item">
            <ShieldCheck className="h-4 w-4" />
            Evidence backed
          </div>
          <div className="premium-top-band__item">
            <Network className="h-4 w-4" />
            Graph first
          </div>
          <div className="premium-top-band__item">
            <Languages className="h-4 w-4" />
            Multilingual
          </div>
          <div className="premium-top-band__item">
            <UsersRound className="h-4 w-4" />
            Collaboration ready
          </div>
        </motion.div>

        <nav className="premium-nav">
          <div className="premium-brand">
            <div className="premium-brand-icon premium-shimmer">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="premium-brand-text">
              <h1>PolyResearch Workspace</h1>
              <p>Search, graph, review, and collaborate</p>
            </div>
          </div>

          <div className="premium-nav-actions">
            <div className="premium-style-switcher" aria-label="Landing style options">
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={styleOption === option.id ? 'is-active' : ''}
                  title={option.title}
                  onClick={() => setStyleOption(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="premium-nav-chip">Guest mode</div>
            <button onClick={onToggleTheme} className="premium-nav-theme" aria-label="Toggle theme">
              {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </nav>

        <section className="premium-hero-section">
          <div className="premium-hero-backdrop">
            <div className="premium-hero-backdrop__mesh" />
            <div className="premium-hero-backdrop__field" />
            <div className="premium-hero-graph" aria-hidden="true">
              <div className="premium-hero-graph__edge premium-hero-graph__edge--one" />
              <div className="premium-hero-graph__edge premium-hero-graph__edge--two" />
              <div className="premium-hero-graph__edge premium-hero-graph__edge--three" />
              <div className="premium-hero-graph__edge premium-hero-graph__edge--four" />
              <div className="premium-hero-graph__edge premium-hero-graph__edge--five" />
              <div className="premium-hero-graph__node premium-hero-graph__node--center premium-shimmer">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="premium-hero-graph__node premium-hero-graph__node--one">
                <DatabaseZap className="h-6 w-6" />
              </div>
              <div className="premium-hero-graph__node premium-hero-graph__node--two">
                <Globe2 className="h-6 w-6" />
              </div>
              <div className="premium-hero-graph__node premium-hero-graph__node--three">
                <Workflow className="h-6 w-6" />
              </div>
              <div className="premium-hero-graph__node premium-hero-graph__node--four">
                <Bot className="h-6 w-6" />
              </div>
              <div className="premium-hero-graph__node premium-hero-graph__node--five">
                <BookOpenCheck className="h-5 w-5" />
              </div>
            </div>
          </div>

          <motion.div
            className="premium-hero-shell"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.08 } },
            }}
          >
            <div className="premium-hero-copy">
              <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="premium-hero-eyebrow">
                <Sparkles className="h-4 w-4" />
                Research intelligence for serious academic work
              </motion.div>

              <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="premium-hero-badges">
                {HERO_BADGES.map((badge) => (
                  <span key={badge}>{badge}</span>
                ))}
              </motion.div>

              <motion.h1 variants={fadeUp} transition={{ duration: 0.55 }} className="premium-hero-title">
                Turn scattered papers into a connected research command center.
              </motion.h1>

              <motion.p variants={fadeUp} transition={{ duration: 0.55 }} className="premium-hero-subtitle">
                PolyResearch helps students and research teams discover papers, map relationships, compare evidence, and move from a broad topic to a defendable research direction.
              </motion.p>

              <motion.div variants={fadeUp} transition={{ duration: 0.58 }} className="premium-search-shell" ref={searchFieldRef}>
                <div className={`premium-search-box ${isTransitioning ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Search className="premium-search-icon h-5 w-5" />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && submitSearch()}
                    placeholder="Search topic or research question"
                    className="premium-search-input"
                  />
                  <button onClick={submitSearch} className="premium-btn-primary">
                    Explore workspace
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>

              <motion.div variants={fadeUp} transition={{ duration: 0.6 }} className="premium-query-strip">
                {SUGGESTED_QUERIES.map((suggestedQuery) => (
                  <button key={suggestedQuery} type="button" onClick={() => runSuggestedSearch(suggestedQuery)}>
                    {suggestedQuery}
                  </button>
                ))}
              </motion.div>

              <motion.div variants={fadeUp} transition={{ duration: 0.62 }} className="premium-metrics-row">
                {HERO_METRICS.map((metric) => (
                  <div key={metric.label} className="premium-metric-card">
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.aside variants={fadeUp} transition={{ duration: 0.65 }} className="premium-hero-aside">
              <div className="premium-panel premium-panel--highlight">
                <div className="premium-panel__header">
                  <span>Live evidence deck</span>
                  <div className="premium-pulse" />
                </div>
                <h3>One search launches a complete research workflow.</h3>
                <p>
                  The workspace fetches literature, expands language coverage, builds a graph, and keeps AI review tied to the actual papers.
                </p>
                <div className="premium-command-list">
                  {COMMAND_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="premium-command-row">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    );
                  })}
                </div>
                <div className="premium-evidence-score">
                  <div>
                    <span>Workspace readiness</span>
                    <strong>Production style demo</strong>
                  </div>
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </motion.aside>
          </motion.div>
        </section>

        <section className="premium-content-band">
          <motion.div
            className="premium-band-shell"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.35 }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.08 } },
            }}
          >
            <motion.div variants={fadeUp} className="premium-section-heading">
              <span>Why this project stands out</span>
              <h2>It is not only a search box. It is a research workflow.</h2>
              <p>
                The landing page now explains the complete value of the final year project: retrieval, multilingual expansion, graph reasoning, AI review, saved papers, and collaboration.
              </p>
            </motion.div>
            <div className="premium-capability-grid">
              {CAPABILITIES.map((capability) => {
                const Icon = capability.icon;
                return (
                  <motion.article variants={fadeUp} key={capability.title} className="premium-capability-card">
                    <div className="premium-card-icon">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3>{capability.title}</h3>
                    <p>{capability.body}</p>
                  </motion.article>
                );
              })}
            </div>
          </motion.div>
        </section>

        <div className="premium-sections-rail">
          {SECTIONS.map((section, index) => {
            const Icon = section.icon;

            return (
              <section key={section.id} className={`premium-stage-section premium-stage-section--${section.accent}`}>
                <motion.div
                  className="premium-stage-shell"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: false, amount: 0.42 }}
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.1 } },
                  }}
                >
                  <motion.div variants={fadeUp} transition={{ duration: 0.52 }} className="premium-stage-visual">
                    <div className="premium-stage-grid" />
                    <div className="premium-stage-orbit" />
                    <div className="premium-stage-orbit premium-stage-orbit--inner" />
                    <div className="premium-stage-link premium-stage-link--left" />
                    <div className="premium-stage-link premium-stage-link--right" />
                    <div className="premium-stage-mini-node premium-stage-mini-node--left" />
                    <div className="premium-stage-mini-node premium-stage-mini-node--right" />
                    <div className="premium-stage-node-card">
                      <div className="premium-stage-node-card__step">{section.step}</div>
                      <div className="premium-stage-node">
                        <div className="premium-stage-node__orb">
                          <Icon className="h-12 w-12" />
                        </div>
                        <div className="premium-stage-node__label">{section.eyebrow}</div>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div variants={fadeUp} transition={{ duration: 0.58 }} className="premium-stage-copy">
                    <div className="premium-stage-copy__eyebrow">
                      <span>{section.step}</span>
                      {section.eyebrow}
                    </div>
                    <h2>{section.title}</h2>
                    <p>{section.body}</p>
                    <div className="premium-detail-points">
                      {section.points.map((point) => (
                        <div key={point} className="premium-detail-point">
                          <span className="premium-detail-point__dot" />
                          {point}
                        </div>
                      ))}
                    </div>
                    <div className="premium-stage-progress">
                      {SECTIONS.map((item, itemIndex) => (
                        <div
                          key={item.id}
                          className={`premium-stage-progress__item ${itemIndex === index ? 'is-active' : ''}`}
                        >
                          <em>{item.step}</em>
                          <span>{item.eyebrow}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              </section>
            );
          })}
        </div>

        <section className="premium-use-case-section">
          <div className="premium-band-shell">
            <div className="premium-section-heading">
              <span>Built for real academic pressure</span>
              <h2>Use it when your research needs proof, not decoration.</h2>
            </div>
            <div className="premium-use-case-grid">
              {USE_CASES.map((useCase) => {
                const Icon = useCase.icon;
                return (
                  <article key={useCase.title} className="premium-use-case-card">
                    <Icon className="h-6 w-6" />
                    <h3>{useCase.title}</h3>
                    <p>{useCase.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="premium-final-cta">
          <div className="premium-final-cta__inner">
            <Layers3 className="h-7 w-7" />
            <h2>Start with one topic. Leave with a research map.</h2>
            <p>
              Use the search bar above to enter the workspace, generate a graph, and begin reviewing papers with context.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
