"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Plus } from "lucide-react";
import { api } from "@/lib/api";
import Image from "next/image";
import ReactMarkdown from "react-markdown";

export default function ChatPage() {
  const [messages, setMessages] = useState<{ role: string; content: string; created_at?: string }[]>([]);
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
            <div className="max-w-[80%] sm:max-w-[70%]">
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
