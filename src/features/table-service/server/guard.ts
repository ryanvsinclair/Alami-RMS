import { requireBusinessMembership } from "@/core/auth/tenant";
import { requireModule } from "@/core/modules/guard";

export async function requireTableServiceAccess() {
  const { business } = await requireBusinessMembership();
  if (business.industry_type !== "restaurant") {
    throw new Error("Table service is currently available for restaurant businesses only");
  }

  await requireModule("table_service");
  return { businessId: business.id };
}
