import { redirect } from "next/navigation";
import { isModuleEnabled } from "@/core/modules/guard";

export default async function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enabled = await isModuleEnabled("integrations");
  if (!enabled) redirect("/");
  return <>{children}</>;
}
