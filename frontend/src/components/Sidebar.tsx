"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, PieChart, History, Wallet, Settings, Menu, LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

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
      await api("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  const navItems = [
    { href: "/app", icon: MessageSquare, label: "Chat" },
    { href: "/app/analytics", icon: PieChart, label: "Analytics" },
    { href: "/app/history", icon: History, label: "History" },
    { href: "/app/budgets", icon: Wallet, label: "Budgets" },
    { href: "/app/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <nav className={`bg-surface border-r border-line flex flex-col h-screen transition-all duration-300 ${collapsed ? "w-20" : "w-64"}`}>
      <div className="flex items-center justify-between p-4 border-b border-line">
        {!collapsed && <h1 className="font-bold text-xl text-ink whitespace-nowrap overflow-hidden">Jerry</h1>}
        <button onClick={toggleSidebar} className="p-2 rounded-lg text-muted hover:bg-line transition-colors">
          <Menu size={20} />
        </button>
      </div>

      <div className="flex-1 py-4 flex flex-col gap-2 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${active ? "bg-primary text-white" : "text-muted hover:bg-line hover:text-ink"}`}>
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span className="font-medium whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-line">
        <div className="flex items-center gap-3 mb-4 overflow-hidden">
          <div className="w-10 h-10 shrink-0 bg-primary rounded-full flex items-center justify-center text-white text-lg shadow-md">
            {userProfile?.avatar || userProfile?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <div className="flex flex-col whitespace-nowrap">
              <span className="font-bold text-sm text-ink">{userProfile?.name || "User"}</span>
              <span className="text-xs text-muted">Active</span>
            </div>
          )}
        </div>
        <button onClick={handleLogout} className="flex items-center gap-3 p-3 w-full rounded-lg text-danger hover:bg-line transition-colors">
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span className="font-medium whitespace-nowrap">Log Out</span>}
        </button>
      </div>
    </nav>
  );
}
