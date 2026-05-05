"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      router.push("/app");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg">
      <div className="w-full max-w-sm p-8 bg-surface border border-line rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center text-ink">Create an Account</h1>
        {error && <p className="text-danger mb-4 text-center">{error}</p>}
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
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
              minLength={8}
              className="w-full p-3 border border-line rounded-lg bg-bg text-ink"
            />
          </div>
          <button type="submit" className="w-full py-3 mt-2 font-bold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors">
            Sign Up
          </button>
        </form>
        <p className="mt-6 text-center text-muted">
          Already have an account? <a href="/login" className="text-primary font-semibold hover:underline">Log in</a>
        </p>
      </div>
    </div>
  );
}
