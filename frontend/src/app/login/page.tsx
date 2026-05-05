"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/app");
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg">
      <div className="w-full max-w-sm p-8 bg-surface border border-line rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center text-ink">Welcome back to Jerry</h1>
        {error && <p className="text-danger mb-4 text-center">{error}</p>}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-ink">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 border border-line rounded-lg bg-bg text-ink"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-ink">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-3 border border-line rounded-lg bg-bg text-ink"
            />
          </div>
          <button type="submit" className="w-full py-3 mt-2 font-bold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors">
            Log In
          </button>
        </form>
        <p className="mt-6 text-center text-muted">
          Don't have an account? <a href="/register" className="text-primary font-semibold hover:underline">Sign up</a>
        </p>
      </div>
    </div>
  );
}
