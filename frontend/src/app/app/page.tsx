"use client";

import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { api } from "@/lib/api";

export default function ChatPage() {
  const [messages, setMessages] = useState<{ role: string; content: string; created_at?: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const convos = await api("/api/chat/conversations");
        if (convos && convos.length > 0) {
          const hist = await api(`/api/chat/conversations/${convos[0].id}`);
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
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I ran into an error." }]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      <header className="p-4 bg-surface border-b border-line">
        <h2 className="text-xl font-bold">Chat with Jerry</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="text-center text-muted mt-10">
            Say hi to Jerry or log an expense like "I spent 500 on coffee".
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${msg.role === "user" ? "bg-primary text-white rounded-br-none" : "bg-surface border border-line text-ink rounded-bl-none"}`}>
              <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
            </div>
            <span className="text-[11px] text-muted mt-1 px-1">{formatTime(msg.created_at)}</span>
          </div>
        ))}
        
        {loading && (
          <div className="flex flex-col items-start">
            <div className="bg-surface border border-line rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-1">
              <div className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-muted rounded-full animate-bounce"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-surface border-t border-line">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="w-full bg-bg border border-line rounded-full py-3 pl-4 pr-12 text-ink outline-none focus:border-primary transition-colors"
          />
          <button type="submit" disabled={!input.trim() || loading} className="absolute right-2 p-2 bg-primary text-white rounded-full disabled:opacity-50 hover:bg-primary-hover transition-colors">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
