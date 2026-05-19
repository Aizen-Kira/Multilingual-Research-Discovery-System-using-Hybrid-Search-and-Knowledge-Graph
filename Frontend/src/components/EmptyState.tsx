import { Search, SlidersHorizontal } from 'lucide-react';

interface EmptyStateProps {
    onAdjustFilters: () => void;
    onNewSearch: () => void;
}

export default function EmptyState({ onAdjustFilters, onNewSearch }: EmptyStateProps) {
    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--bg-primary)] p-6 text-center">
            <div className="max-w-[450px] w-full flex flex-col items-center">

                <div className="w-20 h-20 bg-[var(--bg-elevated)] rounded-full flex items-center justify-center mb-6 border border-[var(--border-strong)] shadow-[var(--shadow-soft)]">
                    <span className="text-4xl">🌐</span>
                </div>

                <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3">No Papers Found in This Language</h2>

                <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
                    Try searching in other languages to discover global research:
                </p>

                <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl p-5 w-full text-left mb-8 text-sm shadow-[var(--shadow-soft)]">
                    <ul className="text-[var(--text-primary)] space-y-3 flex flex-col list-none">
                        <li className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="text-lg">🇪🇸</span> Spanish</span> <span className="text-[var(--text-secondary)]">45 papers match</span></li>
                        <li className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="text-lg">🇧🇷</span> Portuguese</span> <span className="text-[var(--text-secondary)]">23 papers match</span></li>
                        <li className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="text-lg">🇫🇷</span> French</span> <span className="text-[var(--text-secondary)]">12 papers match</span></li>
                    </ul>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                    <button
                        onClick={onNewSearch}
                        className="flex-1 w-full sm:w-auto px-6 py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white font-semibold flex items-center justify-center gap-2 transition-colors shadow-[0_12px_24px_var(--primary-glow)]"
                    >
                        <Search size={18} /> Search All Languages
                    </button>
                    <button
                        onClick={onAdjustFilters}
                        className="flex-1 w-full sm:w-auto px-6 py-3 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] font-semibold flex items-center justify-center gap-2 transition-colors border border-[var(--border-color)] shadow-[var(--shadow-soft)]"
                    >
                        <SlidersHorizontal size={18} /> Adjust Filters
                    </button>
                </div>
            </div>
        </div>
    );
}
