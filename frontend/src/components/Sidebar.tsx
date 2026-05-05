"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare, PieChart, Clock, Wallet, Settings, PanelLeftClose, PanelLeft, LogOut } from "lucide-react";
import { api } from "@/lib/api";

export default function Sidebar({ userProfile }: { userProfile: any }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
    setCollapsed(isCollapsed);
  }, []);

  const toggleSidebar = () => {
    const newVal = !collapsed;
    setCollapsed(newVal);
    localStorage.setItem("sidebarCollapsed", newVal.toString());
  };

  const handleLogout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  const navItems = [
    { href: "/app", icon: MessageSquare, label: "Chat" },
    { href: "/app/analytics", icon: PieChart, label: "Analytics" },
    { href: "/app/history", icon: Clock, label: "History" },
    { href: "/app/budgets", icon: Wallet, label: "Budgets" },
    { href: "/app/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <nav
      className={`flex flex-col h-screen transition-all duration-300 ease-in-out border-r ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 h-16" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shrink-0" style={{ boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)' }}>
              <span className="text-sm">🐾</span>
            </div>
            <span className="font-bold text-lg text-ink tracking-tight whitespace-nowrap">Jerry</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-muted hover:text-ink hover:bg-white/5 transition-all duration-200"
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-3 flex flex-col gap-1 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative ${
                active
                  ? "text-white"
                  : "text-muted hover:text-ink hover:bg-white/5"
              }`}
            >
              {active && (
                <div
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.15))',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                  }}
                />
              )}
              <item.icon size={19} className="shrink-0 relative z-10" />
              {!collapsed && (
                <span className="font-medium text-sm whitespace-nowrap relative z-10">{item.label}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* User section */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div className="flex items-center gap-3 p-2 mb-2 overflow-hidden">
          <div
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md"
            style={{ background: 'linear-gradient(135deg, #6366f1, #a78bfa)' }}
          >
            {userProfile?.avatar || userProfile?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <div className="flex flex-col whitespace-nowrap overflow-hidden">
              <span className="font-semibold text-sm text-ink truncate">{userProfile?.name || "User"}</span>
              <span className="text-xs text-muted">Free plan</span>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-muted hover:text-danger hover:bg-danger/10 transition-all duration-200"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span className="font-medium text-sm whitespace-nowrap">Sign out</span>}
        </button>
      </div>
    </nav>
  );
}
