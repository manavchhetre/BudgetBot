"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { TrendingUp, ArrowUpRight, Tag } from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        setSummary(await api("/api/analytics/summary"));
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, []);

  if (!summary) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted text-sm">Loading…</p></div>;
  }

  const chartData = {
    labels: summary.category_breakdown?.map((c: any) => c.category) || [],
    datasets: [{
      data: summary.category_breakdown?.map((c: any) => c.amount) || [],
      backgroundColor: CHART_COLORS,
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { color: 'var(--muted)', padding: 12, font: { size: 12 }, usePointStyle: true, pointStyleWidth: 8 } },
    },
    cutout: "65%",
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto fade-in">
      <h1 className="text-lg font-bold text-ink mb-5">Analytics</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total Spend", value: `₹${summary.total_spend?.toFixed(0) || 0}`, icon: TrendingUp, color: "text-primary" },
          { label: "Transactions", value: summary.transaction_count || 0, icon: ArrowUpRight, color: "text-blue-500" },
          { label: "Top Category", value: summary.top_category || "—", icon: Tag, color: "text-amber-500" },
        ].map((card, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted uppercase tracking-wide">{card.label}</span>
              <card.icon size={16} className={card.color} />
            </div>
            <div className="text-xl font-bold text-ink">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Spending by Category</h2>
          <div className="relative h-56">
            {summary.category_breakdown?.length > 0 ? (
              <Doughnut data={chartData} options={chartOptions} />
            ) : (
              <p className="text-muted text-sm text-center mt-20">No data yet</p>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Daily Breakdown</h2>
          <div className="space-y-0 max-h-56 overflow-y-auto">
            {summary.daily_breakdown?.length > 0 ? (
              summary.daily_breakdown.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2.5 border-b border-line last:border-0">
                  <span className="text-sm text-muted">{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  <span className="text-sm font-semibold text-ink">₹{item.amount.toFixed(0)}</span>
                </div>
              ))
            ) : (
              <p className="text-muted text-sm text-center py-10">No data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
