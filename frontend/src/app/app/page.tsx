"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

export default function ChatPage() {
  const [messages, setMessages] = useState<{ role: string; content: string; created_at?: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const convos = await api("/api/conversations");
        if (convos && convos.length > 0) {
          const hist = await api(`/api/conversations/${convos[0].id}/messages`);
          setMessages(hist.reverse());
        }
      } catch (err) {
        console.error("Failed to load chat history", err);
      }
    }
    loadHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
        body: JSON.stringify({ message: userMsg }),
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.message, created_at: new Date().toISOString() }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I ran into an error. Please try again." }]);
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
      <header
        className="px-6 h-16 flex items-center shrink-0"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-accent" />
          <h2 className="text-base font-semibold text-ink">Chat with Jerry</h2>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center slide-up">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(167, 139, 250, 0.1))',
                border: '1px solid rgba(99, 102, 241, 0.15)',
              }}
            >
              <span className="text-4xl">🐾</span>
            </div>
            <h3 className="text-xl font-bold text-ink mb-2">Hey there! I&apos;m Jerry</h3>
            <p className="text-muted text-sm max-w-sm leading-relaxed">
              I can help you track expenses, manage budgets, and give you insights on your spending.
              Try saying something like:
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {["I spent ₹500 on coffee", "Show my budget", "How much did I spend this week?"].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="glass-subtle px-4 py-2 text-xs font-medium text-muted hover:text-ink hover:bg-white/5 transition-all duration-200 rounded-full"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} fade-in`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "rounded-br-md text-white"
                  : "rounded-bl-md text-ink"
              }`}
              style={
                msg.role === "user"
                  ? {
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      boxShadow: '0 4px 16px rgba(99, 102, 241, 0.25)',
                    }
                  : {
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }
              }
            >
              <div className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</div>
            </div>
            <span className="text-[10px] text-muted mt-1.5 px-1 opacity-60">{formatTime(msg.created_at)}</span>
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start fade-in">
            <div
              className="rounded-2xl rounded-bl-md px-5 py-4 flex items-center gap-1.5"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 bg-accent rounded-full animate-bounce" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Jerry…"
            className="input-glass w-full py-3.5 pl-5 pr-14 !rounded-2xl"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 p-2.5 rounded-xl transition-all duration-200 disabled:opacity-30"
            style={{
              background: input.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
              boxShadow: input.trim() ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none',
            }}
          >
            <Send size={16} className="text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
