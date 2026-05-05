"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Download, Check } from "lucide-react";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [income, setIncome] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await api("/api/me");
        setName(data.name || "");
        setAvatar(data.avatar || "");
        setIncome(data.monthly_income?.toString() || "");
      } catch (err) { console.error(err); }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify({ name, avatar, monthly_income: income ? parseFloat(income) : null }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleExport = () => {
    const base = process.env.NODE_ENV === "development" ? "http://localhost:8000" : "";
    window.location.href = `${base}/api/export`;
  };

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto fade-in">
      <h1 className="text-lg font-bold text-ink mb-5">Settings</h1>

      <div className="flex flex-col gap-4">
        {/* Profile */}
        <div className="card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Profile</h2>
          <form onSubmit={handleSave} className="flex flex-col gap-3.5">
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1.5">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1.5">Avatar (emoji)</label>
              <input type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)} maxLength={2} placeholder="😊" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1.5">Monthly income (₹)</label>
              <input type="number" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="50000" className="input-field" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
              {saving ? "Saving…" : saved ? <span className="flex items-center justify-center gap-1.5"><Check size={15} /> Saved</span> : "Save"}
            </button>
          </form>
        </div>

        {/* Export */}
        <div className="card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink mb-2">Export Data</h2>
          <p className="text-xs text-muted mb-3">Download all transactions as CSV.</p>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary bg-primary-light rounded-lg hover:bg-primary/20 transition-colors">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
