import { redirect } from "next/navigation";
import { isModuleEnabled } from "@/core/modules/guard";

export default async function ShoppingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enabled = await isModuleEnabled("shopping");
  if (!enabled) redirect("/");
  return <>{children}</>;
}
