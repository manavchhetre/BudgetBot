"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare, PieChart, Clock, Wallet, Settings, Menu, X, LogOut, Sun, Moon } from "lucide-react";
import { api } from "@/lib/api";
import Image from "next/image";

export default function Sidebar({ userProfile }: { userProfile: any }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved === "dark";
    setDarkMode(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

    const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
    setCollapsed(isCollapsed);
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  };

  const toggleSidebar = () => {
    const newVal = !collapsed;
    setCollapsed(newVal);
    localStorage.setItem("sidebarCollapsed", newVal.toString());
  };

  const handleLogout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login");
  };

  const navItems = [
    { href: "/app", icon: MessageSquare, label: "Chat" },
    { href: "/app/analytics", icon: PieChart, label: "Analytics" },
    { href: "/app/history", icon: Clock, label: "History" },
    { href: "/app/budgets", icon: Wallet, label: "Budgets" },
    { href: "/app/settings", icon: Settings, label: "Settings" },
  ];

  const navContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-3 h-14 border-b border-line">
        <div className="flex items-center gap-2 overflow-hidden">
          <Image src="/jerry-icon.png" alt="Jerry" width={28} height={28} className="rounded-lg shrink-0" />
          {(!collapsed || mobileOpen) && <span className="font-bold text-base text-ink whitespace-nowrap">Jerry</span>}
        </div>
        {/* Desktop collapse toggle */}
        <button onClick={toggleSidebar} className="hidden md:block p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface-alt transition-colors">
          <Menu size={16} />
        </button>
        {/* Mobile close */}
        <button onClick={() => setMobileOpen(false)} className="md:hidden p-1.5 rounded-lg text-muted hover:text-ink">
          <X size={16} />
        </button>
      </div>

      {/* Nav links */}
      <div className="flex-1 py-2 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-primary-light text-primary font-semibold"
                  : "text-muted hover:text-ink hover:bg-surface-alt"
              }`}
            >
              <item.icon size={18} className="shrink-0" />
              {(!collapsed || mobileOpen) && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-line">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm text-muted hover:text-ink hover:bg-surface-alt transition-colors mb-0.5"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          {(!collapsed || mobileOpen) && <span>{darkMode ? "Light mode" : "Dark mode"}</span>}
        </button>

        {/* User info */}
        <div className="flex items-center gap-2.5 px-3 py-2 overflow-hidden">
          <div className="w-7 h-7 shrink-0 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
            {userProfile?.avatar || userProfile?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          {(!collapsed || mobileOpen) && (
            <span className="text-sm font-medium text-ink truncate">{userProfile?.name || "User"}</span>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm text-muted hover:text-danger hover:bg-danger/10 transition-colors"
        >
          <LogOut size={18} className="shrink-0" />
          {(!collapsed || mobileOpen) && <span>Sign out</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-surface border border-line text-ink shadow-sm"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <nav
        className={`md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-surface border-r border-line flex flex-col transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </nav>

      {/* Desktop sidebar */}
      <nav
        className={`hidden md:flex flex-col h-screen bg-surface border-r border-line transition-all duration-200 ${
          collapsed ? "w-[60px]" : "w-56"
        }`}
      >
        {navContent}
      </nav>
    </>
  );
}
