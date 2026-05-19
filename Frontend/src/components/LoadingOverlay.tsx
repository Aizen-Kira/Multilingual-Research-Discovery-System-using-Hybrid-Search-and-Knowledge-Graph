interface LoadingOverlayProps {
    progress: number;
    estimatedSeconds: number;
    onCancel: () => void;
}

export default function LoadingOverlay({ progress, onCancel }: LoadingOverlayProps) {
    return (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[var(--bg-overlay)] backdrop-blur-md pointer-events-auto">
            <div className="glass-panel max-w-[420px] w-full mx-4 rounded-[2rem] p-8 flex flex-col items-center text-center">

                <div className="globe-container">
                    <svg className="rotating-globe" width="60" height="60">
                        <circle cx="30" cy="30" r="28"
                            fill="none"
                            stroke="url(#globeGradient)"
                            strokeWidth="2" />
                        <circle cx="30" cy="30" r="24"
                            fill="none"
                            stroke="rgba(100, 150, 255, 0.3)"
                            strokeWidth="1"
                            strokeDasharray="4 4" />
                        <circle cx="30" cy="30" r="20"
                            fill="none"
                            stroke="rgba(100, 150, 255, 0.2)"
                            strokeWidth="1"
                            strokeDasharray="4 4" />

                        <defs>
                            <linearGradient id="globeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#4ECDC4" />
                                <stop offset="100%" stopColor="#667EEA" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>

                <div className="flex flex-col items-center gap-2 mb-6 text-center">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Searching the graph</h2>
                    <p className="text-[13px] text-[var(--similarity-high)] font-semibold tracking-[0.24em] uppercase">Across Languages</p>
                </div>

                <div className="progress-container">
                    <div
                        className="progress-bar"
                        style={{
                            width: `${Math.max(5, progress)}%`,
                            transition: 'width 0.5s ease-out'
                        }}
                    >
                        <div className="progress-bar__sheen" />
                    </div>
                    <span className="progress-text">{progress}%</span>
                </div>

                <button
                    onClick={onCancel}
                    className="px-6 py-3 rounded-2xl border border-[var(--border-color)] text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors w-full"
                >
                    Cancel Search
                </button>
            </div>
        </div>
    );
}
