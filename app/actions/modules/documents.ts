"use server";

import { requireBusinessMembership } from "@/core/auth/tenant";
import { requireModule } from "@/core/modules/guard";
import {
  findOrCreateInboundAddress,
  getAddressDisplayString,
} from "@/features/documents/server";

export async function getInboundAddress() {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");

  const inboundAddress = await findOrCreateInboundAddress(business.id);
  return {
    addressToken: inboundAddress.addressToken,
    isActive: inboundAddress.isActive,
    emailAddress: getAddressDisplayString(inboundAddress.addressToken),
  };
}
