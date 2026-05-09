"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Image from "next/image";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-bg">
      <div className="card w-full max-w-sm p-6 sm:p-8 fade-in">
        <div className="text-center mb-6">
          <Image src="/jerry-icon.png" alt="Jerry" width={56} height={56} className="mx-auto mb-3 rounded-xl" />
          <h1 className="text-xl font-bold text-ink">Welcome back</h1>
          <p className="text-muted text-sm mt-1">Sign in to Jerry</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger/10 text-danger text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1.5">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="input-field" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          No account?{" "}
          <a href="/register" className="text-primary font-medium hover:underline">Sign up</a>
        </p>
      </div>
    </div>
  );
}
