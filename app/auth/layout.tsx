export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(0,127,255,0.16),transparent_52%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/8 to-transparent" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl xl:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
        <section className="hidden xl:flex xl:flex-col xl:justify-center xl:px-10 xl:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">Alamir</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight text-foreground">
            One workspace for intake, inventory, schedule, and service.
          </h2>
          <p className="mt-4 max-w-xl text-base text-muted">
            Sign in to continue with your team operations dashboard.
          </p>
        </section>

        <div className="flex min-h-screen flex-col justify-center px-4 py-10 sm:px-6 xl:px-10">
          <div className="mx-auto w-full max-w-lg">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
