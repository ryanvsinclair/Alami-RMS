import { BottomNav } from "@/components/nav/bottom-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen max-w-lg mx-auto pb-24 bg-[#080d14] text-foreground">
      {children}
      <BottomNav />
    </div>
  );
}
