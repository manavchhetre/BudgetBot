"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { TrendingUp, ArrowUpRight, BarChart3 } from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const CHART_COLORS = [
  '#6366f1', '#a78bfa', '#f43f5e', '#34d399', '#fbbf24',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6',
];

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

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 fade-in">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Loading analytics…</p>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: summary.category_breakdown?.map((c: any) => c.category) || [],
    datasets: [
      {
        data: summary.category_breakdown?.map((c: any) => c.amount) || [],
        backgroundColor: CHART_COLORS,
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right" as const,
        labels: {
          color: '#94a3b8',
          padding: 16,
          font: { size: 12 },
          usePointStyle: true,
          pointStyleWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
      },
    },
    cutout: "70%",
  };

  const statCards = [
    {
      label: "Total Spend",
      value: `₹${summary.total_spend?.toFixed(0) || 0}`,
      icon: TrendingUp,
      gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.08))',
      borderColor: 'rgba(99, 102, 241, 0.15)',
      iconColor: '#818cf8',
    },
    {
      label: "Transactions",
      value: summary.transaction_count || 0,
      icon: ArrowUpRight,
      gradient: 'linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(16, 185, 129, 0.08))',
      borderColor: 'rgba(52, 211, 153, 0.15)',
      iconColor: '#34d399',
    },
    {
      label: "Top Category",
      value: summary.top_category || "—",
      icon: BarChart3,
      gradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.08))',
      borderColor: 'rgba(251, 191, 36, 0.15)',
      iconColor: '#fbbf24',
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto fade-in">
      <h1 className="text-2xl font-bold mb-6 text-ink">Analytics</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {statCards.map((card, i) => (
          <div
            key={i}
            className="rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 slide-up"
            style={{
              background: card.gradient,
              border: `1px solid ${card.borderColor}`,
              animationDelay: `${i * 0.1}s`,
              animationFillMode: 'both',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted uppercase tracking-wider">{card.label}</span>
              <card.icon size={18} style={{ color: card.iconColor }} />
            </div>
            <div className="text-2xl font-bold text-ink">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-6 slide-up-delay">
          <h2 className="font-semibold text-base mb-5 text-ink">Spending by Category</h2>
          <div className="relative h-64 w-full">
            {summary.category_breakdown?.length > 0 ? (
              <Doughnut data={chartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted text-sm">No spend data yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass p-6 slide-up-delay" style={{ animationDelay: '0.2s' }}>
          <h2 className="font-semibold text-base mb-5 text-ink">Daily Breakdown</h2>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {summary.daily_breakdown?.length > 0 ? (
              summary.daily_breakdown.map((item: any, i: number) => (
                <div
                  key={i}
                  className="flex justify-between items-center py-3 px-3 rounded-xl hover:bg-white/5 transition-colors duration-200"
                  style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}
                >
                  <span className="text-sm text-muted">{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  <span className="font-semibold text-sm text-ink">₹{item.amount.toFixed(0)}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-40">
                <p className="text-muted text-sm">No daily data yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
