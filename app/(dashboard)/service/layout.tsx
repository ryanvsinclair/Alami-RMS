import { redirect } from "next/navigation";
import { requireTableServiceAccess } from "@/features/table-service/server";

export default async function TableServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireTableServiceAccess();
  } catch {
    redirect("/");
  }

  return <>{children}</>;
}
