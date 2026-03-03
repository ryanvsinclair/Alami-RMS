import Link from "next/link";
import { signInAction } from "@/app/actions/core/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = params?.next ? decodeURIComponent(params.next) : "/";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-normal text-muted">Welcome back</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Sign in to your workspace</h1>
      </div>

      <form action={signInAction} className="app-sheet space-y-3 rounded-3xl p-5">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-[13px] font-normal tracking-normal text-muted">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="h-12 w-full rounded-[10px] border border-border bg-[var(--fill-tertiary)] px-4 text-foreground placeholder:text-muted/70 focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-[13px] font-normal tracking-normal text-muted">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="h-12 w-full rounded-[10px] border border-border bg-[var(--fill-tertiary)] px-4 text-foreground placeholder:text-muted/70 focus:outline-none"
          />
        </div>
        {params?.error && (
          <p className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
            {decodeURIComponent(params.error)}
          </p>
        )}
        <button
          type="submit"
          className="h-12 w-full rounded-xl bg-primary font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Sign in
        </button>
      </form>

      <p className="text-sm text-muted">
        New here?{" "}
        <Link className="font-semibold text-primary" href="/auth/signup">
          Create an account
        </Link>
      </p>
    </div>
  );
}
