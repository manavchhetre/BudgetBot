"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Wallet, Plus, Trash2, AlertTriangle } from "lucide-react";

export default function BudgetsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

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
      setShowForm(false);
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
    <div className="p-6 md:p-8 max-w-5xl mx-auto fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Wallet size={20} className="text-accent" />
          <h1 className="text-2xl font-bold text-ink">Budgets</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
          }}
        >
          <Plus size={16} className="text-white" />
          <span className="text-white">New Budget</span>
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="glass p-6 mb-8 slide-up">
          <h2 className="font-semibold text-base mb-4 text-ink">Create New Budget</h2>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wider">Category</label>
              <input
                type="text"
                list="categorySuggestions"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                placeholder="e.g. Groceries"
                className="input-glass"
              />
              <datalist id="categorySuggestions">
                {summary?.category_breakdown?.map((c: any) => (
                  <option key={c.category} value={c.category} />
                ))}
              </datalist>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wider">Limit (₹)</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                required
                placeholder="5000"
                className="input-glass"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
              {loading ? "Adding…" : "Add Budget"}
            </button>
          </form>
        </div>
      )}

      {/* Budget List */}
      {!summary?.budget_tracking || summary.budget_tracking.length === 0 ? (
        <div className="glass p-16 text-center slide-up">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.1)' }}>
            <Wallet size={28} className="text-accent" />
          </div>
          <h3 className="text-lg font-semibold text-ink mb-1">No budgets set</h3>
          <p className="text-muted text-sm">Click &quot;New Budget&quot; to start tracking your spending limits.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {summary.budget_tracking.map((budget: any, i: number) => {
            const ratio = Math.min(budget.spent_amount / budget.limit_amount, 1);
            const percentage = (ratio * 100).toFixed(1);
            const isOver = ratio >= 0.9;
            const isWarning = ratio >= 0.75 && ratio < 0.9;

            let barColor = '#34d399';
            let barGlow = 'rgba(52, 211, 153, 0.3)';
            if (isOver) { barColor = '#f43f5e'; barGlow = 'rgba(244, 63, 94, 0.3)'; }
            else if (isWarning) { barColor = '#fbbf24'; barGlow = 'rgba(251, 191, 36, 0.3)'; }

            return (
              <div
                key={budget.category}
                className="glass p-5 hover:-translate-y-0.5 transition-all duration-300 slide-up"
                style={{ animationDelay: `${i * 0.08}s`, animationFillMode: 'both' }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-ink">{budget.category}</h3>
                      {isOver && <AlertTriangle size={14} className="text-danger" />}
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      ₹{budget.spent_amount.toFixed(0)} of ₹{budget.limit_amount.toFixed(0)} spent
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-sm font-bold"
                      style={{ color: barColor }}
                    >
                      {percentage}%
                    </span>
                    <button
                      onClick={() => handleDelete(budget.category)}
                      className="p-2 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-all duration-200"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.06)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${percentage}%`,
                      background: barColor,
                      boxShadow: `0 0 12px ${barGlow}`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
