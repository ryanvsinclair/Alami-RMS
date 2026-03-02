export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(0,127,255,0.16),transparent_52%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/8 to-transparent" />
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}
