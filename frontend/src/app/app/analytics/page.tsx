"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await api("/api/analytics/summary");
        setSummary(data);
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, []);

  if (!summary) return <div className="p-8">Loading analytics...</div>;

  const chartData = {
    labels: summary.category_breakdown?.map((c: any) => c.category) || [],
    datasets: [
      {
        data: summary.category_breakdown?.map((c: any) => c.amount) || [],
        backgroundColor: ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6", "#10b981", "#64748b"],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right" as const, labels: { color: "var(--ink)" } },
    },
    cutout: "65%",
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface border border-line rounded-xl p-6">
          <div className="text-3xl font-bold text-ink">₹{summary.total_spend?.toFixed(2)}</div>
          <div className="text-sm text-muted mt-1">Total spend</div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-6">
          <div className="text-3xl font-bold text-ink">{summary.transaction_count}</div>
          <div className="text-sm text-muted mt-1">Transactions</div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-6">
          <div className="text-3xl font-bold text-ink truncate">{summary.top_category || "-"}</div>
          <div className="text-sm text-muted mt-1">Top category</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface border border-line rounded-xl p-6">
          <h2 className="font-bold text-lg mb-4">Top Categories</h2>
          <div className="relative h-64 w-full">
            {summary.category_breakdown?.length > 0 ? (
              <Doughnut data={chartData} options={chartOptions} />
            ) : (
              <p className="text-muted text-center mt-20">No spend data yet.</p>
            )}
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-6">
          <h2 className="font-bold text-lg mb-4">Daily Breakdown</h2>
          <div className="space-y-3">
            {summary.daily_breakdown?.length > 0 ? (
              summary.daily_breakdown.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-line last:border-0">
                  <span className="font-semibold text-sm">{new Date(item.date).toLocaleDateString()}</span>
                  <span className="font-bold">₹{item.amount.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-muted text-center mt-10">No daily data yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
