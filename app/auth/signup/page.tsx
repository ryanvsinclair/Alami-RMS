import Link from "next/link";
import { signUpAction } from "@/app/actions/core/auth";
import { INDUSTRY_LABELS, INDUSTRY_TYPES } from "@/lib/config/presets";

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
        <h1 className="mt-1 text-3xl font-bold text-foreground">Create your account</h1>
      </div>

      <form action={signUpAction} className="app-sheet space-y-3 rounded-3xl p-5 ring-1 ring-primary/10">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1.5">
          <label htmlFor="business_name" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Business name
          </label>
          <input
            id="business_name"
            name="business_name"
            required
            className="h-12 w-full rounded-2xl border border-border bg-foreground/[0.04] px-4 text-foreground placeholder:text-muted/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none focus:ring-2 focus:ring-primary/30"
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
            className="h-12 w-full rounded-2xl border border-border bg-foreground/[0.04] px-4 text-foreground placeholder:text-muted/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="industry_type" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Industry
          </label>
          <select
            id="industry_type"
            name="industry_type"
            defaultValue="general"
            className="h-12 w-full rounded-2xl border border-border bg-foreground/[0.04] px-4 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none focus:ring-2 focus:ring-primary/30"
          >
            {INDUSTRY_TYPES.map((industry) => (
              <option key={industry} value={industry} className="bg-card text-foreground">
                {INDUSTRY_LABELS[industry]}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted/80">We use this to set module defaults and terminology.</p>
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
            className="h-12 w-full rounded-2xl border border-border bg-foreground/[0.04] px-4 text-foreground placeholder:text-muted/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {params?.error && (
          <p className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
            {decodeURIComponent(params.error)}
          </p>
        )}
        <button
          type="submit"
          className="h-12 w-full rounded-2xl bg-primary font-semibold text-white shadow-[0_8px_20px_rgba(0,127,255,0.32)] transition-colors hover:bg-primary-hover"
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
