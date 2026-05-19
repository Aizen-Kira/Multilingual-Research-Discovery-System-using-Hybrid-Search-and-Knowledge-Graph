import { AlertTriangle, RefreshCw, MessageSquareWarning } from 'lucide-react';

interface ErrorStateProps {
    errorCode?: string;
    onRetry: () => void;
    onReport?: () => void;
}

export default function ErrorState({ errorCode = 'NET_ERR_500', onRetry, onReport }: ErrorStateProps) {
    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0F172A] p-6 text-center">
            <div className="bg-[#0F172A] border border-red-500/30 rounded-2xl p-8 max-w-[450px] w-full shadow-[0_0_50px_rgba(239,68,68,0.05)] flex flex-col items-center">

                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                    <AlertTriangle size={32} className="text-red-500" />
                </div>

                <h2 className="text-2xl font-bold text-white mb-3">Connection Error</h2>

                <p className="text-gray-400 mb-6 text-sm">
                    Unable to reach paper databases or semantic search backend. Please check your connection or wait a moment.
                </p>

                <div className="bg-red-500/5 border border-red-500/20 text-red-400 font-mono text-xs px-4 py-2 rounded-lg mb-8">
                    Error Code: {errorCode}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                    <button
                        onClick={onRetry}
                        className="flex-1 w-full bg-[#0F172A] hover:bg-[#0F172A] px-6 py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                        <RefreshCw size={18} /> Retry Search
                    </button>
                    <button
                        onClick={onReport || (() => alert("Issue reported to support team."))}
                        className="flex-1 w-full bg-transparent hover:bg-slate-800 border border-slate-600 px-6 py-3 rounded-xl text-gray-300 font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                        <MessageSquareWarning size={18} /> Report Issue
                    </button>
                </div>
            </div>
        </div>
    );
}
