import Link from "next/link";
import { signUpAction } from "@/app/actions/core/auth";
import { INDUSTRY_LABELS, INDUSTRY_TYPES } from "@/lib/config/presets";
import { RestaurantPlaceSearch } from "./RestaurantPlaceSearch";

const INDUSTRY_CARD_NOTES: Record<(typeof INDUSTRY_TYPES)[number], string> = {
  restaurant: "POS + delivery source suggestions",
  salon: "Service and payment source suggestions",
  retail: "Store and ecommerce source suggestions",
  contractor: "Payment-first source suggestions",
  general: "Generic setup with flexible defaults",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = params?.next ? decodeURIComponent(params.next) : "/onboarding/income-sources";

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
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Industry
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {INDUSTRY_TYPES.map((industry) => (
              <label key={industry} className="block cursor-pointer">
                <input
                  type="radio"
                  name="industry_type"
                  value={industry}
                  defaultChecked={industry === "general"}
                  className="peer sr-only"
                />
                <div className="rounded-2xl border border-border bg-foreground/[0.02] px-4 py-3 transition-all peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:shadow-[0_8px_20px_rgba(0,127,255,0.18)] hover:border-foreground/20">
                  <p className="text-sm font-semibold text-foreground">{INDUSTRY_LABELS[industry]}</p>
                  <p className="mt-1 text-xs text-muted">{INDUSTRY_CARD_NOTES[industry]}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted/80">We use this to set module defaults and terminology.</p>
        </div>
        <RestaurantPlaceSearch />
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
