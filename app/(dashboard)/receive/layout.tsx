import { redirect } from "next/navigation";
import { isModuleEnabled } from "@/core/modules/guard";

export default async function ReceiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enabled = await isModuleEnabled("receipts");
  if (!enabled) redirect("/");
  return <>{children}</>;
}
