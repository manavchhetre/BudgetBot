"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function BudgetsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [loading, setLoading] = useState(false);

  const loadBudgets = async () => {
    try {
      const data = await api("/api/analytics/summary");
      setSummary(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/budgets", {
        method: "POST",
        body: JSON.stringify({ category, limit_amount: parseFloat(limit) }),
      });
      setCategory("");
      setLimit("");
      await loadBudgets();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cat: string) => {
    try {
      await api(`/api/budgets/${encodeURIComponent(cat)}`, { method: "DELETE" });
      await loadBudgets();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Budgeting</h1>

      <div className="bg-surface border border-line rounded-xl p-6 mb-8">
        <h2 className="font-bold text-lg mb-4">Create New Budget</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-semibold mb-1 text-ink">Category</label>
            <input
              type="text"
              list="categorySuggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              placeholder="e.g. Groceries"
              className="w-full p-3 border border-line rounded-lg bg-bg text-ink"
            />
            <datalist id="categorySuggestions">
              {summary?.category_breakdown?.map((c: any) => (
                <option key={c.category} value={c.category} />
              ))}
            </datalist>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold mb-1 text-ink">Limit Amount (₹)</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              required
              placeholder="5000"
              className="w-full p-3 border border-line rounded-lg bg-bg text-ink"
            />
          </div>
          <button type="submit" disabled={loading} className="px-6 py-3 font-bold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors h-[50px]">
            {loading ? "Adding..." : "Add Budget"}
          </button>
        </form>
      </div>

      <div className="bg-surface border border-line rounded-xl p-6">
        <h2 className="font-bold text-lg mb-4">Active Budgets</h2>
        {summary?.budget_tracking?.length === 0 ? (
          <p className="text-muted text-center py-8">You don't have any active budgets. Add one above!</p>
        ) : (
          <div className="space-y-6">
            {summary?.budget_tracking?.map((budget: any) => {
              const ratio = Math.min(budget.spent_amount / budget.limit_amount, 1);
              const percentage = (ratio * 100).toFixed(1);
              let colorClass = "bg-green";
              if (ratio >= 0.9) colorClass = "bg-danger";
              else if (ratio >= 0.75) colorClass = "bg-warn";

              return (
                <div key={budget.category} className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-lg">{budget.category}</span>
                      <span className="ml-3 text-sm text-muted">{percentage}% used</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-sm">
                        ₹{budget.spent_amount.toFixed(2)} / ₹{budget.limit_amount.toFixed(2)}
                      </span>
                      <button onClick={() => handleDelete(budget.category)} className="text-danger text-sm hover:underline">
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="w-full bg-bg rounded-full h-3 overflow-hidden border border-line">
                    <div className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
