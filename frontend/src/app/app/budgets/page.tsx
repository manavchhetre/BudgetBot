"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";

export default function BudgetsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadBudgets = async () => {
    try {
      setSummary(await api("/api/analytics/summary"));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadBudgets(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/budgets", { method: "POST", body: JSON.stringify({ category, limit_amount: parseFloat(limit) }) });
      setCategory(""); setLimit(""); setShowForm(false);
      await loadBudgets();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (cat: string) => {
    try {
      await api(`/api/budgets/${encodeURIComponent(cat)}`, { method: "DELETE" });
      await loadBudgets();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto fade-in">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-ink">Budgets</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
          <Plus size={15} /> Add
        </button>
      </div>

      {showForm && (
        <div className="card p-4 mb-5 fade-in">
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-ink-secondary mb-1.5">Category</label>
              <input type="text" list="cats" value={category} onChange={(e) => setCategory(e.target.value)} required placeholder="e.g. Groceries" className="input-field" />
              <datalist id="cats">
                {summary?.category_breakdown?.map((c: any) => <option key={c.category} value={c.category} />)}
              </datalist>
            </div>
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-ink-secondary mb-1.5">Limit (₹)</label>
              <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} required placeholder="5000" className="input-field" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap w-full sm:w-auto">
              {loading ? "Adding…" : "Create"}
            </button>
          </form>
        </div>
      )}

      {!summary?.budget_tracking || summary.budget_tracking.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-muted text-sm">No budgets set. Tap &quot;Add&quot; to create one.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {summary.budget_tracking.map((b: any) => {
            const ratio = Math.min(b.spent_amount / b.limit_amount, 1);
            const pct = (ratio * 100).toFixed(0);
            let barColor = "#10b981"; // green
            if (ratio >= 0.9) barColor = "#ef4444"; // red
            else if (ratio >= 0.75) barColor = "#f59e0b"; // amber

            return (
              <div key={b.category} className="card p-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className="font-medium text-sm text-ink">{b.category}</span>
                    <span className="text-xs text-muted ml-2">₹{b.spent_amount.toFixed(0)} / ₹{b.limit_amount.toFixed(0)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: barColor }}>{pct}%</span>
                    <button onClick={() => handleDelete(b.category)} className="p-1 rounded text-muted hover:text-danger transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-alt overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
