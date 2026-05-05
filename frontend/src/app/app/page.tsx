"use client";

import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { api } from "@/lib/api";
import Image from "next/image";

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
      <header className="px-4 sm:px-6 h-14 flex items-center border-b border-line bg-surface shrink-0">
        <h2 className="text-sm font-semibold text-ink">Chat</h2>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center fade-in px-4">
            <Image src="/jerry-icon.png" alt="Jerry" width={64} height={64} className="mb-4 rounded-2xl" />
            <h3 className="text-lg font-bold text-ink mb-1">Hi! I&apos;m Jerry</h3>
            <p className="text-muted text-sm max-w-xs leading-relaxed mb-4">
              Your AI budget assistant. Tell me about your expenses and I&apos;ll help you track them.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["I spent ₹500 on coffee", "Show my budget", "How much did I spend?"].map((s) => (
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
            <div className="max-w-[80%] sm:max-w-[70%]">
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-md"
                    : "card rounded-bl-md"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
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
