"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Settings as SettingsIcon, Download, Check } from "lucide-react";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [income, setIncome] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await api("/api/user/profile");
        setName(data.name || "");
        setAvatar(data.avatar || "");
        setIncome(data.monthly_income?.toString() || "");
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify({
          name,
          avatar,
          monthly_income: income ? parseFloat(income) : null,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const baseUrl = process.env.NODE_ENV === "development" ? "http://localhost:8000" : "";
    window.location.href = `${baseUrl}/api/export`;
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto fade-in">
      <div className="flex items-center gap-2 mb-6">
        <SettingsIcon size={20} className="text-accent" />
        <h1 className="text-2xl font-bold text-ink">Settings</h1>
      </div>

      <div className="flex flex-col gap-6">
        {/* Profile */}
        <section className="glass p-6 slide-up">
          <h2 className="font-semibold text-base mb-5 text-ink">Profile</h2>
          <form onSubmit={handleSave} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wider">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input-glass"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wider">Avatar (Emoji)</label>
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                maxLength={2}
                placeholder="🐾"
                className="input-glass"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wider">Monthly Income (₹)</label>
              <input
                type="number"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                required
                placeholder="50000"
                className="input-glass"
              />
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving…" : saved ? (
                  <span className="flex items-center gap-2">
                    <Check size={16} /> Saved
                  </span>
                ) : "Save Changes"}
              </button>
            </div>
          </form>
        </section>

        {/* Data Management */}
        <section className="glass p-6 slide-up-delay">
          <h2 className="font-semibold text-base mb-4 text-ink">Data Management</h2>
          <p className="text-sm text-muted mb-4">Download all your expense data as a CSV file for use in Excel or Google Sheets.</p>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(16, 185, 129, 0.08))',
              border: '1px solid rgba(52, 211, 153, 0.15)',
              color: '#34d399',
            }}
          >
            <Download size={16} />
            Export Transactions (CSV)
          </button>
        </section>
      </div>
    </div>
  );
}
