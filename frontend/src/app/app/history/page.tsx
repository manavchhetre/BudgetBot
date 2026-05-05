"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { Clock, ArrowDownLeft } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  food: '#f43f5e',
  transport: '#3b82f6',
  entertainment: '#a78bfa',
  groceries: '#34d399',
  shopping: '#ec4899',
  bills: '#f97316',
  health: '#14b8a6',
  education: '#6366f1',
};

function getCategoryColor(category: string): string {
  const key = category.toLowerCase();
  return CATEGORY_COLORS[key] || '#64748b';
}

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api("/api/transactions");
        setTransactions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 fade-in">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Loading history…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Clock size={20} className="text-accent" />
        <h1 className="text-2xl font-bold text-ink">Transaction History</h1>
      </div>

      {transactions.length === 0 ? (
        <div className="glass p-16 text-center slide-up">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
            <ArrowDownLeft size={28} className="text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-ink mb-1">No transactions yet</h3>
          <p className="text-muted text-sm">Start by telling Jerry about your expenses in the chat.</p>
        </div>
      ) : (
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <th className="p-4 text-xs font-medium text-muted uppercase tracking-wider">Date</th>
                  <th className="p-4 text-xs font-medium text-muted uppercase tracking-wider">Merchant</th>
                  <th className="p-4 text-xs font-medium text-muted uppercase tracking-wider">Category</th>
                  <th className="p-4 text-xs font-medium text-muted uppercase tracking-wider text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => {
                  const catColor = getCategoryColor(tx.category);
                  return (
                    <tr
                      key={tx.id || i}
                      className="transition-colors duration-200 hover:bg-white/[0.03]"
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        animationDelay: `${i * 0.03}s`,
                      }}
                    >
                      <td className="p-4 text-sm text-muted">
                        {format(new Date(tx.date), "MMM d, yyyy")}
                      </td>
                      <td className="p-4 font-medium text-sm text-ink">{tx.merchant}</td>
                      <td className="p-4">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium"
                          style={{
                            background: `${catColor}15`,
                            color: catColor,
                            border: `1px solid ${catColor}25`,
                          }}
                        >
                          {tx.category}
                        </span>
                      </td>
                      <td className="p-4 text-right font-semibold text-sm text-ink">
                        ₹{tx.amount.toFixed(0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
