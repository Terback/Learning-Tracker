"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName })
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.error || "Unable to create account.");
      return;
    }

    if (result.hasSession) {
      router.replace("/");
      router.refresh();
      return;
    }

    setNotice("Account created. Check your email to confirm it before signing in.");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f8fb] px-4 text-slate-950 dark:bg-[#101214] dark:text-slate-100">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-6 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon.png" alt="Grinding Progress" className="size-9 shrink-0 rounded-full object-cover" />
          <div>
            <div className="font-semibold">Grinding Progress</div>
            <div className="text-xs text-slate-500">Create your workspace account</div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-400">Display Name</span>
            <input
              type="text"
              required
              autoFocus
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Terrence Dai"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-white/10 dark:bg-black/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-400">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-white/10 dark:bg-black/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-400">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-white/10 dark:bg-black/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase text-slate-400">Confirm password</span>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-white/10 dark:bg-black/20"
            />
          </label>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}
          <button
            type="submit"
            disabled={loading}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-slate-950 underline dark:text-white">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
