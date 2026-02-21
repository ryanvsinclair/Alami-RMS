import Link from "next/link";
import { signUpAction } from "@/app/actions/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = params?.next ? decodeURIComponent(params.next) : "/";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Get started</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">Create your restaurant account</h1>
      </div>

      <form action={signUpAction} className="space-y-3 rounded-3xl border border-[rgba(128,164,202,0.24)] bg-[linear-gradient(150deg,rgba(20,42,67,0.72)_0%,rgba(14,30,50,0.7)_60%,rgba(10,22,39,0.8)_100%)] p-5">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1.5">
          <label htmlFor="restaurant_name" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Restaurant name
          </label>
          <input
            id="restaurant_name"
            name="restaurant_name"
            required
            className="h-12 w-full rounded-2xl border border-border bg-white/7 px-4 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="h-12 w-full rounded-2xl border border-border bg-white/7 px-4 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            className="h-12 w-full rounded-2xl border border-border bg-white/7 px-4 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {params?.error && (
          <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {decodeURIComponent(params.error)}
          </p>
        )}
        <button
          type="submit"
          className="h-12 w-full rounded-2xl bg-primary font-semibold text-white shadow-[0_8px_20px_rgba(6,193,103,0.35)]"
        >
          Create account
        </button>
      </form>

      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link className="font-semibold text-primary" href="/auth/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
