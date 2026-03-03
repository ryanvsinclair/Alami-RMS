import Image from "next/image";
import Link from "next/link";

const quickPoints = [
  "Unify income and operations data",
  "Track inventory and receipts in one place",
  "Keep your business workflow clear and simple",
];

export function PublicLandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(0,127,255,0.18),transparent_38%),radial-gradient(circle_at_84%_16%,rgba(0,127,255,0.12),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-primary/12 to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/logotransparentbackground.svg"
              alt="Vynance"
              width={34}
              height={24}
              className="h-6 w-auto"
              priority
            />
            <span className="text-sm font-semibold tracking-tight text-foreground/90">
              Vynance
            </span>
          </div>

          <Link
            href="/auth/login"
            className="inline-flex h-9 items-center rounded-full border border-border bg-card/70 px-4 text-sm font-semibold text-foreground/85 transition-colors hover:bg-card"
          >
            Sign in
          </Link>
        </header>

        <main className="flex flex-1 items-center py-10 sm:py-16">
          <div className="mx-auto w-full max-w-3xl text-center">
            <p className="text-xs font-semibold normal-case tracking-normal text-primary/85">
              Inventory + Income
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Run your daily operations from one clean workspace.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Connect your business systems, track transactions, and keep inventory organized
              without adding complexity.
            </p>

            <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/auth/signup"
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(0,127,255,0.3)] transition-colors hover:bg-primary-hover"
              >
                Get started
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-card/75 px-6 text-sm font-semibold text-foreground/90 transition-colors hover:bg-card"
              >
                I already have an account
              </Link>
            </div>

            <div className="mt-7 grid gap-2 text-left sm:grid-cols-3">
              {quickPoints.map((point) => (
                <div
                  key={point}
                  className="rounded-xl border border-border/70 bg-card/65 px-3 py-3 text-xs text-muted sm:text-sm"
                >
                  {point}
                </div>
              ))}
            </div>
          </div>
        </main>

        <footer className="pt-3 text-center text-xs text-muted/85">
          <p>Built for mobile first, ready on desktop.</p>
          <div className="mt-2 inline-flex items-center gap-3">
            <Link
              href="/privacy"
              className="text-primary/90 transition-colors hover:text-primary"
            >
              Privacy
            </Link>
            <span className="text-muted/60">|</span>
            <Link
              href="/terms"
              className="text-primary/90 transition-colors hover:text-primary"
            >
              Terms
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
