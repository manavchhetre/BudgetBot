"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { MessageSquare, Receipt, ChevronRight, ArrowLeft, X } from "lucide-react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";

type Tab = "conversations" | "transactions";

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("conversations");
  const [conversations, setConversations] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Conversation detail view
  const [selectedConvo, setSelectedConvo] = useState<any | null>(null);
  const [convoMessages, setConvoMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [convos, txns] = await Promise.all([
          api("/api/conversations"),
          api("/api/transactions"),
        ]);
        setConversations(convos || []);
        setTransactions(txns || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const openConversation = async (convo: any) => {
    setSelectedConvo(convo);
    setLoadingMessages(true);
    try {
      const msgs = await api(`/api/conversations/${convo.id}/messages`);
      setConvoMessages(msgs || []);
    } catch (err) {
      console.error(err);
      setConvoMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const closeConversation = () => {
    setSelectedConvo(null);
    setConvoMessages([]);
  };

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-muted text-sm">Loading…</p></div>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto fade-in">
      <h1 className="text-lg font-bold text-ink mb-5">History</h1>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-surface-alt rounded-xl mb-5 max-w-xs">
        <button
          onClick={() => { setActiveTab("conversations"); closeConversation(); }}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "conversations"
              ? "bg-surface text-ink shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          <MessageSquare size={14} />
          Chats
        </button>
        <button
          onClick={() => { setActiveTab("transactions"); closeConversation(); }}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "transactions"
              ? "bg-surface text-ink shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          <Receipt size={14} />
          Transactions
        </button>
      </div>

      {/* ─── Conversations Tab ───────────────────────────────── */}
      {activeTab === "conversations" && !selectedConvo && (
        <>
          {conversations.length === 0 ? (
            <div className="card p-10 text-center">
              <MessageSquare size={32} className="mx-auto text-muted mb-3" />
              <p className="text-muted text-sm">No conversations yet. Start chatting with Jerry!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {conversations.map((convo, i) => (
                <button
                  key={convo.id || i}
                  onClick={() => openConversation(convo)}
                  className="card p-3.5 flex items-center gap-3 text-left hover:bg-surface-alt transition-colors group w-full"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                    <MessageSquare size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{convo.title || "Untitled chat"}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {convo.created_at ? format(new Date(convo.created_at), "MMM d, yyyy · h:mm a") : ""}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-muted group-hover:text-ink transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Conversation Detail (transcript) ────────────────── */}
      {activeTab === "conversations" && selectedConvo && (
        <div className="fade-in">
          <button
            onClick={closeConversation}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-4 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to conversations
          </button>

          <div className="card overflow-hidden">
            {/* Transcript header */}
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">{selectedConvo.title || "Untitled chat"}</h3>
                <p className="text-xs text-muted mt-0.5">
                  {selectedConvo.created_at ? format(new Date(selectedConvo.created_at), "MMM d, yyyy · h:mm a") : ""}
                </p>
              </div>
              <button onClick={closeConversation} className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface-alt transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Transcript messages */}
            <div className="p-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
              {loadingMessages ? (
                <p className="text-muted text-sm text-center py-6">Loading messages…</p>
              ) : convoMessages.length === 0 ? (
                <p className="text-muted text-sm text-center py-6">No messages in this conversation.</p>
              ) : (
                convoMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <Image src="/jerry-icon.png" alt="Jerry" width={24} height={24} className="rounded-full mr-2 mt-1 shrink-0 self-start" />
                    )}
                    <div className="max-w-[80%]">
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-white rounded-br-md"
                            : "bg-surface-alt rounded-bl-md"
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
                      {msg.created_at && (
                        <span className="text-[10px] text-muted mt-0.5 px-1 block">
                          {format(new Date(msg.created_at), "h:mm a")}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Transactions Tab ────────────────────────────────── */}
      {activeTab === "transactions" && (
        <>
          {transactions.length === 0 ? (
            <div className="card p-10 text-center">
              <Receipt size={32} className="mx-auto text-muted mb-3" />
              <p className="text-muted text-sm">No transactions yet. Start by telling Jerry about your expenses.</p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="flex flex-col gap-2 sm:hidden">
                {transactions.map((tx, i) => (
                  <div key={tx.id || i} className="card p-3.5">
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="font-medium text-sm text-ink">{tx.merchant}</span>
                      <span className="font-semibold text-sm text-ink">₹{tx.amount.toFixed(0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{format(new Date(tx.date), "MMM d, yyyy")}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-primary-light text-primary font-medium">{tx.category}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="card overflow-hidden hidden sm:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="p-3 text-xs font-medium text-muted uppercase tracking-wide">Date</th>
                      <th className="p-3 text-xs font-medium text-muted uppercase tracking-wide">Merchant</th>
                      <th className="p-3 text-xs font-medium text-muted uppercase tracking-wide">Category</th>
                      <th className="p-3 text-xs font-medium text-muted uppercase tracking-wide text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, i) => (
                      <tr key={tx.id || i} className="border-b border-line last:border-0 hover:bg-surface-alt transition-colors">
                        <td className="p-3 text-sm text-muted">{format(new Date(tx.date), "MMM d, yyyy")}</td>
                        <td className="p-3 text-sm font-medium text-ink">{tx.merchant}</td>
                        <td className="p-3">
                          <span className="text-xs px-2 py-0.5 rounded-md bg-primary-light text-primary font-medium">{tx.category}</span>
                        </td>
                        <td className="p-3 text-sm font-semibold text-ink text-right">₹{tx.amount.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
