export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#080d14] text-foreground">
      <div className="mx-auto max-w-lg px-4 py-10">
        {children}
      </div>
    </div>
  );
}
