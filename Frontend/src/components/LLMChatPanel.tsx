import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, Sparkles, PanelRightClose, FileText, Network, ShieldCheck } from 'lucide-react';
import { api, type ChatContextPaper } from '../api/client';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  layerUsed?: string;
}

interface LLMChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  contextPaper?: ChatContextPaper | null;
  currentQuery?: string;
}

function buildFallbackResponse(question: string, contextPaper?: ChatContextPaper | null, currentQuery?: string) {
  if (!contextPaper) {
    return [
      '## No Active Paper',
      'I could not reach the RAG backend, and there is no selected paper context to ground a full answer.',
      currentQuery ? `- Current workspace query: ${currentQuery}` : '',
      '- Select a paper node, then ask again for a grounded summary, methodology, limitations, or comparison.',
    ].filter(Boolean).join('\n');
  }

  const q = question.toLowerCase();
  const keyFindings = contextPaper.key_findings?.filter(Boolean) ?? [];
  const limitations = contextPaper.limitations?.filter(Boolean) ?? [];
  const contributions = contextPaper.contributions?.filter(Boolean) ?? [];

  const sections: string[] = [];

  sections.push('## Summary');
  sections.push(
    `${contextPaper.title} focuses on retrieval-augmented generation in the medical and nursing domain${
      contextPaper.abstract ? ` and frames the work around the problem described in the current paper context.` : '.'
    }`
  );

  if (contextPaper.abstract) {
    sections.push(contextPaper.abstract.length > 420 ? `${contextPaper.abstract.slice(0, 417)}...` : contextPaper.abstract);
  }

  if (q.includes('method') || q.includes('how') || q.includes('approach')) {
    sections.push('## Methodology');
    sections.push(contextPaper.methodology || 'The current workspace context does not expose a detailed methodology field for this paper.');
  }

  if (keyFindings.length > 0 || q.includes('finding') || q.includes('evidence') || q.includes('support')) {
    sections.push('## Evidence from Current Context');
    if (keyFindings.length > 0) {
      keyFindings.slice(0, 5).forEach((finding) => sections.push(`- ${finding}`));
    } else {
      sections.push('- No explicit key findings are attached to the selected paper in the current UI context.');
    }
  }

  if (contributions.length > 0) {
    sections.push('## Contributions');
    contributions.slice(0, 4).forEach((item) => sections.push(`- ${item}`));
  }

  if (limitations.length > 0 || q.includes('limit') || q.includes('weakness')) {
    sections.push('## Limitations');
    if (limitations.length > 0) {
      limitations.slice(0, 4).forEach((item) => sections.push(`- ${item}`));
    } else {
      sections.push('- The current paper context does not include explicit limitations metadata.');
    }
  }

  if (currentQuery && (q.includes('graph') || q.includes('query') || q.includes('gap'))) {
    sections.push('## Relation to the Workspace Query');
    sections.push(
      `This paper appears relevant to the workspace query "${currentQuery}" because it is positioned as a connected node in the current graph and discusses retrieval-augmented generation in the same topic area.`
    );
  }

  sections.push('## Uncertainty');
  sections.push(
    'This answer was generated from the paper metadata already loaded in the workspace because the live RAG backend was unavailable. It is grounded, but it is narrower than a full retrieval-backed answer.'
  );

  return sections.join('\n\n');
}

function renderMessageToHtml(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const withBold = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  const lines = withBold.split(/\r?\n/);
  let html = '';
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      const level = line.match(/^#+/)?.[0].length || 1;
      const content = line.replace(/^#{1,3}\s+/, '');
      html += `<h${Math.min(level + 2, 6)} class="mb-2 mt-3 font-semibold tracking-tight text-[var(--text-primary)]">${content}</h${Math.min(level + 2, 6)}>`;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html += '<ul class="mb-3 space-y-2 pl-5">';
        inList = true;
      }
      html += `<li class="text-[var(--text-primary)]">${line.replace(/^[-*]\s+/, '')}</li>`;
      continue;
    }

    if (inList) {
      html += '</ul>';
      inList = false;
    }

    html += `<p class="mb-3 text-[var(--text-primary)]">${line}</p>`;
  }

  if (inList) {
    html += '</ul>';
  }

  return html;
}

export default function LLMChatPanel({ isOpen, onClose, contextPaper, currentQuery }: LLMChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputStr, setInputStr] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastContextTitleRef = useRef<string | null>(null);

  const suggestedPrompts = useMemo(() => {
    const title = contextPaper?.title;
    return [
      title ? `Summarize the selected paper and cite the strongest supporting evidence.` : 'Summarize the strongest paper cluster for this query.',
      title ? `What are the key findings, methodology, and limitations of "${title}"?` : 'What are the most important nodes and connections in this graph?',
      currentQuery ? `How does this graph answer the query "${currentQuery}" and where are the gaps?` : 'What research gaps are visible from these connected papers?',
    ];
  }, [contextPaper?.title, currentQuery]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: '1',
          text: 'Ask for summaries, evidence-grounded explanations, limitations, comparisons, or gaps. I will answer from the selected paper and workspace context when available.',
          sender: 'ai',
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (contextPaper?.title && isOpen && lastContextTitleRef.current !== contextPaper.title) {
      lastContextTitleRef.current = contextPaper.title;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: `Active RAG context updated to "${contextPaper.title}". Ask for a grounded summary, methodological critique, limitations, or comparison against related papers in the graph.`,
          sender: 'ai',
          timestamp: new Date(),
        },
      ]);
    }
  }, [contextPaper, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    void api.checkHealth().then((online) => {
      if (active) setIsBackendOnline(online);
    });

    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendPrompt = (prompt: string) => {
    setInputStr(prompt);
  };

  const handleSend = async () => {
    if (!inputStr.trim()) return;

    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      text: inputStr,
      sender: 'user',
      timestamp: new Date(),
    };

    const currentMessages = [...messages];
    setMessages([...currentMessages, newUserMsg]);
    setInputStr('');
    setIsTyping(true);

    try {
      const history = currentMessages.map((message) => ({
        role: message.sender === 'ai' ? 'assistant' : 'user',
        content: message.text,
      }));

      const result = await api.chat(inputStr, contextPaper || null, history, currentQuery);

      if (!result.success || !result.response) {
        throw new Error(result.error || 'Invalid response from API');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: result.response as string,
          sender: 'ai',
          timestamp: new Date(),
          layerUsed: result.layer_used,
        },
      ]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: buildFallbackResponse(inputStr, contextPaper, currentQuery),
          sender: 'ai',
          timestamp: new Date(),
          layerUsed: 'workspace-fallback',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <aside
      className={`fixed right-0 top-0 bottom-0 z-[60] flex w-full max-w-[520px] flex-col border-l border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-strong)] backdrop-blur-xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[var(--primary)]/35 to-transparent" />

      <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[#8B5CF6] text-white shadow-[0_12px_24px_var(--primary-glow)]">
            <Bot size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold tracking-tight text-[var(--text-primary)]">Research Copilot</h2>
              <span className="soft-chip rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]">RAG</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <span className={`h-1.5 w-1.5 rounded-full ${isBackendOnline === false ? 'bg-red-400' : 'bg-[var(--success)] animate-pulse'}`} />
              {isBackendOnline === false ? 'Backend offline' : 'Grounded mode'}
            </div>
          </div>
        </div>

        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
          <PanelRightClose size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 custom-scrollbar">
        <div className="rounded-[1.4rem] border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-4 shadow-[var(--shadow-soft)]">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
            <ShieldCheck className="h-4 w-4 text-[var(--text-accent)]" />
            Active Context
          </div>
          <div className="grid gap-2">
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-accent)]" />
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Selected paper</div>
                <div className="mt-1 text-sm leading-6 text-[var(--text-primary)]">
                  {contextPaper?.title || 'No paper selected'}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-3">
              <Network className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-accent)]" />
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Retrieval scope</div>
                <div className="mt-1 text-sm leading-6 text-[var(--text-primary)]">
                  {currentQuery ? `Workspace query: ${currentQuery}` : 'Using graph context and selected paper when available'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.4rem] border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-4 shadow-[var(--shadow-soft)]">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
            <Sparkles className="h-4 w-4 text-[var(--text-accent)]" />
            Suggested Prompts
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendPrompt(prompt)}
                className="rounded-full border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] rounded-[1.4rem] px-4 py-3 text-[14px] leading-7 whitespace-pre-wrap ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-br from-[var(--primary)] to-[#3B82F6] text-white rounded-tr-md shadow-[0_12px_24px_var(--primary-glow)]'
                  : 'border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-tl-md shadow-[var(--shadow-soft)]'
              }`}
              dangerouslySetInnerHTML={{
                __html: msg.sender === 'ai' ? renderMessageToHtml(msg.text) : msg.text
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;'),
              }}
            />
            {msg.sender === 'ai' && msg.layerUsed && (
              <div className="mt-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Layer: {msg.layerUsed}
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-[1.4rem] rounded-tl-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-soft)]">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-shell)] px-5 py-4">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputStr}
            onChange={(e) => setInputStr(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about your research..."
            className="w-full rounded-full border border-[var(--border-color)] bg-[var(--bg-input)] py-3.5 pl-5 pr-14 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--ring-color)] focus:ring-4 focus:ring-[var(--ring-color)]"
          />
          <button
            onClick={handleSend}
            disabled={!inputStr.trim() || isTyping}
            className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-white transition-colors hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          <Sparkles size={10} />
          Ask for evidence-grounded answers. Verify important claims.
        </div>
      </div>
    </aside>
  );
}
