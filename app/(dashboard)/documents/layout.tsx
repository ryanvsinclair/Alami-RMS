import { redirect } from "next/navigation";
import { isModuleEnabled } from "@/core/modules/guard";

export default async function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enabled = await isModuleEnabled("documents");
  if (!enabled) redirect("/");
  return <>{children}</>;
}
