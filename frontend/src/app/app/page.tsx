"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Plus, BarChart3, CheckCircle2, HelpCircle, WalletCards } from "lucide-react";
import { api } from "@/lib/api";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

type ChatArtifact = {
  type: "analytics" | "transaction_receipt" | "clarification" | "profile" | "suggestions";
  title: string;
  data: unknown;
};

type ChatMessage = {
  role: string;
  content: string;
  created_at?: string;
  artifacts?: ChatArtifact[];
};

type TransactionItem = {
  merchant?: string;
  amount?: number | string;
  currency?: string;
  category?: string;
  date?: string;
};

type SummarySnapshot = {
  total_spend?: number | string;
  monthly_income?: number | string | null;
  remaining_budget?: number | string | null;
  transaction_count?: number;
  top_category?: string | null;
  top_merchant?: string | null;
};

type BreakdownItem = {
  category?: string;
  amount?: number | string;
  date?: string;
};

type ClarificationItem = {
  merchant?: string | null;
  missing?: string[];
  suggested_prompt?: string;
};

type ProfileData = {
  monthly_income?: number | string | null;
  remaining_budget?: number | string | null;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Always start with a fresh chat — no history loading on mount
  // Users can view past conversations in the History tab

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
    setLoading(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg, created_at: new Date().toISOString() }]);
    setLoading(true);

    try {
      const res = await api("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: userMsg,
          conversation_id: conversationId,
        }),
      });
      // Track conversation ID from first response
      if (res.conversation_id && !conversationId) {
        setConversationId(res.conversation_id);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.message,
          artifacts: res.artifacts || [],
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 sm:px-6 h-14 flex items-center justify-between border-b border-line bg-surface shrink-0">
        <h2 className="text-sm font-semibold text-ink">Chat</h2>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary-light rounded-lg hover:bg-primary/20 transition-colors"
          title="Start a new conversation"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">New Chat</span>
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center fade-in px-4">
            <Image src="/jerry-icon.png" alt="Jerry" width={64} height={64} className="mb-4 rounded-2xl" />
            <h3 className="text-lg font-bold text-ink mb-1">Hi! I&apos;m Jerry</h3>
            <p className="text-muted text-sm max-w-xs leading-relaxed mb-4">
              Your AI budget assistant. Tell me about your expenses, ask about your spending, or just chat!
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["I spent ₹500 on coffee", "Show my budget", "Hey Jerry, how are you?"].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="px-3 py-1.5 text-xs font-medium text-primary bg-primary-light rounded-full hover:bg-primary/20 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <Image src="/jerry-icon.png" alt="Jerry" width={28} height={28} className="rounded-full mr-2 mt-1 shrink-0 self-start" />
            )}
            <div className="max-w-[88%] sm:max-w-[78%] lg:max-w-[68%]">
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-md"
                    : "card rounded-bl-md"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="markdown-body">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
              {msg.role === "assistant" && msg.artifacts?.length ? (
                <div className="mt-2 space-y-2">
                  {msg.artifacts.map((artifact, artifactIndex) => (
                    <ArtifactRenderer
                      key={`${idx}-${artifactIndex}`}
                      artifact={artifact}
                      onPrompt={(prompt) => setInput(prompt)}
                    />
                  ))}
                </div>
              ) : null}
              <span className="text-[10px] text-muted mt-1 px-1 block">{formatTime(msg.created_at)}</span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <Image src="/jerry-icon.png" alt="Jerry" width={28} height={28} className="rounded-full mr-2 mt-1 shrink-0" />
            <div className="card rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 sm:px-6 py-3 border-t border-line bg-surface shrink-0">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Jerry…"
            className="input-field flex-1"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="btn-primary px-3 py-2.5 shrink-0"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

function ArtifactRenderer({
  artifact,
  onPrompt,
}: {
  artifact: ChatArtifact;
  onPrompt: (prompt: string) => void;
}) {
  if (artifact.type === "transaction_receipt") {
    return <TransactionReceipt artifact={artifact} />;
  }
  if (artifact.type === "analytics") {
    return <AnalyticsArtifact artifact={artifact} />;
  }
  if (artifact.type === "clarification") {
    return <ClarificationArtifact artifact={artifact} onPrompt={onPrompt} />;
  }
  if (artifact.type === "profile") {
    return <ProfileArtifact artifact={artifact} />;
  }
  if (artifact.type === "suggestions") {
    return <SuggestionArtifact artifact={artifact} onPrompt={onPrompt} />;
  }
  return null;
}

function TransactionReceipt({ artifact }: { artifact: ChatArtifact }) {
  const data = asRecord(artifact.data);
  const transactions = asArray<TransactionItem>(data.transactions);
  const summary = asRecord(data.summary) as SummarySnapshot;

  return (
    <div className="agent-artifact">
      <div className="artifact-heading">
        <CheckCircle2 size={16} className="text-success" />
        <span>{artifact.title}</span>
      </div>
      <div className="space-y-2">
        {transactions.map((item, index) => (
          <div key={index} className="artifact-row">
            <div className="min-w-0">
              <p className="artifact-primary truncate">{item.merchant || "Unknown"}</p>
              <p className="artifact-muted">{item.category || "Uncategorized"}</p>
            </div>
            <div className="artifact-amount">{formatMoney(item.amount, item.currency)}</div>
          </div>
        ))}
      </div>
      <KpiStrip summary={summary} />
    </div>
  );
}

function AnalyticsArtifact({ artifact }: { artifact: ChatArtifact }) {
  const data = asRecord(artifact.data);
  const summary = asRecord(data.summary) as SummarySnapshot;
  const categories = asArray<BreakdownItem>(data.category_breakdown);
  const days = asArray<BreakdownItem>(data.daily_breakdown);
  const recent = asArray<TransactionItem>(data.recent_transactions);

  const barData = {
    labels: categories.map((item) => item.category || "Uncategorized"),
    datasets: [
      {
        label: "Spend",
        data: categories.map((item) => Number(item.amount || 0)),
        backgroundColor: "#10b981",
        borderRadius: 6,
      },
    ],
  };

  const lineData = {
    labels: days.map((item) => shortDate(item.date)),
    datasets: [
      {
        label: "Daily spend",
        data: days.map((item) => Number(item.amount || 0)),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.12)",
        tension: 0.35,
        fill: true,
      },
    ],
  };

  return (
    <div className="agent-artifact">
      <div className="artifact-heading">
        <BarChart3 size={16} className="text-primary" />
        <span>{artifact.title}</span>
      </div>
      <KpiStrip summary={summary} />
      <div className="grid gap-3 lg:grid-cols-2">
        {categories.length ? (
          <div className="artifact-chart">
            <p className="artifact-chart-title">By category</p>
            <Bar data={barData} options={chartOptions(false)} />
          </div>
        ) : null}
        {days.length ? (
          <div className="artifact-chart">
            <p className="artifact-chart-title">Daily trend</p>
            <Line data={lineData} options={chartOptions(true)} />
          </div>
        ) : null}
      </div>
      {recent.length ? (
        <div className="overflow-hidden rounded-lg border border-line">
          {recent.map((item, index) => (
            <div key={index} className="artifact-row border-0 border-b border-line last:border-b-0 rounded-none">
              <div className="min-w-0">
                <p className="artifact-primary truncate">{item.merchant || "Unknown"}</p>
                <p className="artifact-muted">{shortDate(item.date)} · {item.category || "Uncategorized"}</p>
              </div>
              <div className="artifact-amount">{formatMoney(item.amount, item.currency)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ClarificationArtifact({ artifact, onPrompt }: { artifact: ChatArtifact; onPrompt: (prompt: string) => void }) {
  const items = asArray<ClarificationItem>(artifact.data);
  return (
    <div className="agent-artifact">
      <div className="artifact-heading">
        <HelpCircle size={16} className="text-warn" />
        <span>{artifact.title}</span>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="artifact-row items-start">
            <div>
              <p className="artifact-primary">{item.merchant || "This expense"}</p>
              <p className="artifact-muted">Needs: {(item.missing || []).join(", ")}</p>
            </div>
            <button className="artifact-action" onClick={() => onPrompt(item.suggested_prompt || "")}>
              Fill
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileArtifact({ artifact }: { artifact: ChatArtifact }) {
  const data = asRecord(artifact.data) as ProfileData;
  return (
    <div className="agent-artifact">
      <div className="artifact-heading">
        <WalletCards size={16} className="text-primary" />
        <span>{artifact.title}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Monthly income" value={data.monthly_income ? formatMoney(data.monthly_income, "INR") : "Not set"} />
        <Metric label="Remaining" value={data.remaining_budget != null ? formatMoney(data.remaining_budget, "INR") : "Not set"} />
      </div>
    </div>
  );
}

function SuggestionArtifact({ artifact, onPrompt }: { artifact: ChatArtifact; onPrompt: (prompt: string) => void }) {
  return (
    <div className="agent-artifact">
      <div className="artifact-heading">
        <HelpCircle size={16} className="text-primary" />
        <span>{artifact.title}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {asArray<string>(artifact.data).map((prompt) => (
          <button key={prompt} className="artifact-action" onClick={() => onPrompt(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function KpiStrip({ summary }: { summary: SummarySnapshot }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric label="Total spend" value={formatMoney(summary.total_spend || 0, "INR")} />
      <Metric label="Transactions" value={summary.transaction_count ?? 0} />
      <Metric label="Top category" value={summary.top_category || "None"} />
      <Metric label="Remaining" value={summary.remaining_budget != null ? formatMoney(summary.remaining_budget, "INR") : "Not set"} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="artifact-metric">
      <div className="artifact-muted uppercase tracking-wide">{label}</div>
      <div className="artifact-primary mt-1 truncate">{value}</div>
    </div>
  );
}

function chartOptions(fill: boolean) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#6b7280", font: { size: 10 } } },
      y: { grid: { color: "rgba(107,114,128,0.18)" }, ticks: { color: "#6b7280", font: { size: 10 } } },
    },
    elements: fill ? { point: { radius: 2 } } : undefined,
  };
}

function formatMoney(amount: number | string | undefined, currency = "INR") {
  const value = Number(amount || 0);
  return `${currency} ${value.toFixed(0)}`;
}

function shortDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}
