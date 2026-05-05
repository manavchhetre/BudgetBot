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

  if (loading) return <div className="p-8">Loading history...</div>;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Transaction History</h1>
      
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-muted">No transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg border-b border-line text-sm uppercase text-muted tracking-wider">
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Merchant</th>
                  <th className="p-4 font-semibold">Category</th>
                  <th className="p-4 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-line last:border-0 hover:bg-bg transition-colors">
                    <td className="p-4 text-sm">{format(new Date(tx.date), "MMM d, yyyy")}</td>
                    <td className="p-4 font-medium">{tx.merchant}</td>
                    <td className="p-4 text-sm">
                      <span className="bg-bg px-2 py-1 rounded-md text-xs font-semibold text-muted border border-line">
                        {tx.category}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold">₹{tx.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
