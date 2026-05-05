"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      try {
        const data = await api("/api/user/profile");
        setProfile(data);
      } catch (err) {
        // Will be redirected by api utility if 401
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-bg text-ink">Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden text-ink">
      <Sidebar userProfile={profile} />
      <main className="flex-1 h-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
