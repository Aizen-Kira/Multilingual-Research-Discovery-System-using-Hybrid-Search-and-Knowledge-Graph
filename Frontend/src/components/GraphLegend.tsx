import { useState, useEffect } from 'react';

export default function GraphLegend() {
    const [minimized, setMinimized] = useState(false);

    // Auto-minimize after 10 seconds of inactivity on first load
    useEffect(() => {
        const timer = setTimeout(() => {
            setMinimized(true);
        }, 10000);
        return () => clearTimeout(timer);
    }, []);

    if (minimized) {
        return (
            <button
                onClick={() => setMinimized(false)}
                className="absolute top-6 right-6 bg-[#0F172A]/95 text-white p-3 rounded-full border border-[#0F172A] shadow-lg hover:bg-[#0F172A] transition-colors z-[100] flex items-center justify-center w-12 h-12 text-xl font-bold"
                title="Open Node Legend"
            >
                🎨
            </button>
        );
    }

    return (
        <div className="absolute top-6 right-6 w-[220px] bg-[#0F172A]/95 backdrop-blur-[10px] text-gray-200 p-5 rounded-xl border border-[#0F172A] shadow-[0_4px_30px_rgba(0,0,0,0.5)] z-[100] flex flex-col gap-4 text-xs font-medium pointer-events-auto">
            <div className="flex justify-between items-center border-b border-[#0F172A] pb-2">
                <h3 className="font-bold text-white flex items-center gap-2 text-sm tracking-widest uppercase">
                    <span>📖</span> Legend
                </h3>
                <button onClick={() => setMinimized(true)} className="text-gray-400 hover:text-white" title="Minimize Legend">
                    [—]
                </button>
            </div>

            <div>
                <ul className="space-y-4 mt-2">
                    <li className="flex items-center gap-3">
                        <span className="w-3.5 h-3.5 rounded-full bg-[#0F172A] shadow-[0_0_8px_#A855F7] flex-shrink-0"></span>
                        <span className="text-gray-100 font-semibold">Query Paper</span>
                    </li>
                    <li className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-[#0F172A] flex-shrink-0 animate-[slow-glow_3s_ease-in-out_infinite]"></span>
                        <span className="text-gray-200">Key Papers</span>
                    </li>
                    <li className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#64748B] flex-shrink-0"></span>
                        <span className="text-gray-300">Related Papers</span>
                    </li>
                    <li className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0F172A] opacity-70 flex-shrink-0"></span>
                        <span className="text-gray-400">Weakly Related</span>
                    </li>
                </ul>
            </div>

            <div className="mt-2 pt-4 border-t border-[#0F172A]">
                <div className="text-[10px] text-gray-500 italic">
                    Node clusters mapped dynamically via Louvain community detection.
                </div>
            </div>
        </div>
    );
}
