import {
  addVendorAlias,
  createVendorProfile,
  evaluateAndUpdateTrustState,
  findAllVendors,
  findVendorByAlias,
  findVendorByExactName,
  findVendorByFuzzyName,
  findVendorById,
  updateVendorProfile,
} from "./vendor-profile.repository";
import {
  findAllMappingsForVendor,
  findMappingByLineItemName,
  upsertItemMapping,
} from "./vendor-item-mapping.repository";
import {
  findDraftById,
  updateDraftVendorProfile,
} from "./document-draft.repository";

export interface ResolveVendorForDraftInput {
  parsedVendorName: string | null;
  senderEmail?: string | null;
}

function normalizeValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function senderDomain(senderEmail: string | null | undefined) {
  const normalized = normalizeValue(senderEmail);
  if (!normalized) return null;
  const atIndex = normalized.indexOf("@");
  if (atIndex < 0) return null;
  const domain = normalized.slice(atIndex + 1).toLowerCase();
  return domain || null;
}

function toVendorSummary(vendor: {
  id: string;
  vendor_name: string;
  trust_state: string;
  total_posted: number;
  trust_threshold_override: number | null;
  auto_post_enabled: boolean;
  last_document_at: Date | null;
}) {
  return {
    id: vendor.id,
    vendor_name: vendor.vendor_name,
    trust_state: vendor.trust_state,
    total_posted: vendor.total_posted,
    trust_threshold_override: vendor.trust_threshold_override,
    auto_post_enabled: vendor.auto_post_enabled,
    last_document_at: vendor.last_document_at ? vendor.last_document_at.toISOString() : null,
  };
}

function extractSenderEmailFromDraftParseFlags(parseFlags: unknown) {
  if (!parseFlags || typeof parseFlags !== "object" || Array.isArray(parseFlags)) return null;
  const ingress = (parseFlags as Record<string, unknown>).ingress;
  if (!ingress || typeof ingress !== "object" || Array.isArray(ingress)) return null;
  const senderEmail = (ingress as Record<string, unknown>).sender_email;
  return typeof senderEmail === "string" ? senderEmail : null;
}

export async function resolveVendorForDraft(
  businessId: string,
  input: ResolveVendorForDraftInput | string,
) {
  let parsedVendorName: string | null = null;
  let parsedSenderEmail: string | null = null;

  if (typeof input === "string") {
    const draft = await findDraftById(businessId, input);
    if (!draft) {
      return {
        vendorProfileId: null,
        confidence: 0,
        suggestion: null,
      };
    }

    parsedVendorName = normalizeValue(draft.parsed_vendor_name);
    parsedSenderEmail = extractSenderEmailFromDraftParseFlags(draft.parse_flags);
  } else {
    parsedVendorName = normalizeValue(input.parsedVendorName);
    parsedSenderEmail = normalizeValue(input.senderEmail ?? null);
  }

  if (parsedVendorName) {
    const exact = await findVendorByExactName(businessId, parsedVendorName);
    if (exact) {
      return {
        vendorProfileId: exact.id,
        confidence: 1,
        suggestion: toVendorSummary(exact),
      };
    }

    const alias = await findVendorByAlias(businessId, parsedVendorName);
    if (alias) {
      return {
        vendorProfileId: alias.id,
        confidence: 0.92,
        suggestion: toVendorSummary(alias),
      };
    }

    const fuzzy = await findVendorByFuzzyName(businessId, parsedVendorName);
    if (fuzzy) {
      return {
        vendorProfileId: fuzzy.profile.id,
        confidence: fuzzy.similarity,
        suggestion: toVendorSummary(fuzzy.profile),
      };
    }
  }

  const domain = senderDomain(parsedSenderEmail);
  if (domain) {
    const aliasByDomain = await findVendorByAlias(businessId, domain);
    if (aliasByDomain) {
      return {
        vendorProfileId: aliasByDomain.id,
        confidence: 0.88,
        suggestion: toVendorSummary(aliasByDomain),
      };
    }
  }

  return {
    vendorProfileId: null,
    confidence: 0,
    suggestion: null,
  };
}

export async function confirmVendorMapping(
  businessId: string,
  draftId: string,
  vendorProfileId: string,
  options: { senderEmail?: string | null } = {},
) {
  const draft = await findDraftById(businessId, draftId);
  if (!draft) throw new Error("Document draft not found");

  const vendor = await findVendorById(businessId, vendorProfileId);
  if (!vendor) throw new Error("Vendor profile not found");

  await updateDraftVendorProfile(businessId, draftId, vendorProfileId);

  const parsedVendorName = normalizeValue(draft.parsed_vendor_name);
  if (parsedVendorName && parsedVendorName.toLowerCase() !== vendor.vendor_name.toLowerCase()) {
    await addVendorAlias(businessId, vendorProfileId, parsedVendorName);
  }

  const domainAlias = senderDomain(options.senderEmail ?? extractSenderEmailFromDraftParseFlags(draft.parse_flags));
  if (domainAlias) {
    await addVendorAlias(businessId, vendorProfileId, domainAlias);
  }

  await evaluateAndUpdateTrustState(businessId, vendorProfileId);
  return findDraftById(businessId, draftId);
}

export async function resolveLineItemMappings(
  businessId: string,
  vendorProfileId: string,
  parsedLineItems: unknown,
) {
  if (!Array.isArray(parsedLineItems)) return [];

  const results: Array<{
    rawName: string;
    mapping: Awaited<ReturnType<typeof findMappingByLineItemName>>;
  }> = [];

  for (const item of parsedLineItems) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const description = (item as Record<string, unknown>).description;
    if (typeof description !== "string" || !description.trim()) continue;

    const mapping = await findMappingByLineItemName(
      businessId,
      vendorProfileId,
      description,
    );
    results.push({
      rawName: description,
      mapping,
    });
  }

  return results;
}

export async function getVendorProfiles(businessId: string) {
  return findAllVendors(businessId);
}

export async function createVendorProfileForBusiness(
  businessId: string,
  payload: {
    vendorName: string;
    supplierId?: string | null;
    defaultCategoryId?: string | null;
    trustThresholdOverride?: number | null;
  },
) {
  return createVendorProfile(businessId, payload);
}

export async function updateVendorTrustThreshold(
  businessId: string,
  vendorProfileId: string,
  threshold: number | null,
) {
  const updated = await updateVendorProfile(businessId, vendorProfileId, {
    trustThresholdOverride: threshold,
  });
  await evaluateAndUpdateTrustState(businessId, vendorProfileId);
  return updated;
}

export async function updateVendorDefaults(
  businessId: string,
  vendorProfileId: string,
  defaults: { defaultCategoryId?: string | null; supplierId?: string | null },
) {
  return updateVendorProfile(businessId, vendorProfileId, {
    defaultCategoryId: defaults.defaultCategoryId,
    supplierId: defaults.supplierId,
  });
}

export async function confirmLineItemMapping(
  businessId: string,
  vendorProfileId: string,
  rawName: string,
  inventoryItemId: string,
) {
  return upsertItemMapping(businessId, vendorProfileId, rawName, inventoryItemId);
}

export async function getVendorMappingsForVendor(
  businessId: string,
  vendorProfileId: string,
) {
  return findAllMappingsForVendor(businessId, vendorProfileId);
}
