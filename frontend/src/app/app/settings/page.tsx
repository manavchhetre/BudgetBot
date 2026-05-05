"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [income, setIncome] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [theme, setTheme] = useState("light");

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
    const t = localStorage.getItem("theme") || "light";
    setTheme(t);
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
      setMsg("Settings saved successfully!");
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleThemeToggle = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleExport = () => {
    const baseUrl = process.env.NODE_ENV === "development" ? "http://localhost:8000" : "";
    window.location.href = `${baseUrl}/api/export`;
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex flex-col gap-6">
        <section className="bg-surface border border-line rounded-xl p-6">
          <h2 className="font-bold text-lg mb-4">Profile Settings</h2>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-ink">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full p-3 border border-line rounded-lg bg-bg text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-ink">Avatar (Emoji)</label>
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                maxLength={2}
                className="w-full p-3 border border-line rounded-lg bg-bg text-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-ink">Monthly Income (₹)</label>
              <input
                type="number"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                required
                className="w-full p-3 border border-line rounded-lg bg-bg text-ink"
              />
            </div>
            <div className="flex items-center gap-4 mt-2">
              <button type="submit" disabled={saving} className="px-6 py-3 font-bold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors">
                {saving ? "Saving..." : "Save Profile"}
              </button>
              {msg && <span className="text-green text-sm font-medium">{msg}</span>}
            </div>
          </form>
        </section>

        <section className="bg-surface border border-line rounded-xl p-6">
          <h2 className="font-bold text-lg mb-4">Appearance</h2>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={theme === "dark"} onChange={handleThemeToggle} />
              <div className="w-11 h-6 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              <span className="ml-3 text-sm font-medium text-ink">Dark Mode</span>
            </label>
          </div>
        </section>

        <section className="bg-surface border border-line rounded-xl p-6">
          <h2 className="font-bold text-lg mb-4">Data Management</h2>
          <button onClick={handleExport} className="px-6 py-3 font-bold text-white bg-green hover:bg-opacity-90 rounded-lg transition-colors">
            Export Transactions (CSV)
          </button>
          <p className="text-muted text-xs mt-2">Download all your expense data as a CSV file.</p>
        </section>
      </div>
    </div>
  );
}
