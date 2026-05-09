"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Download, Check } from "lucide-react";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await api("/api/me");
        setName(data.name || "");
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
        body: JSON.stringify({ name }),
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
            <p className="text-[11px] text-muted -mt-1 italic">
              Note: You can update your monthly income and avatar directly by chatting with Jerry. Try: &quot;my income is 50000&quot;.
            </p>
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
