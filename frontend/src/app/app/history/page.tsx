"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { format } from "date-fns";

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setTransactions(await api("/api/transactions"));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-muted text-sm">Loading…</p></div>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto fade-in">
      <h1 className="text-lg font-bold text-ink mb-5">History</h1>

      {transactions.length === 0 ? (
        <div className="card p-10 text-center">
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
    </div>
  );
}
