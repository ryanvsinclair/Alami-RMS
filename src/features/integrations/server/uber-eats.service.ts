import { findIncomeConnectionByProvider } from "./connections.repository";
import { decryptIncomeSecret } from "./oauth-crypto";
import {
  deleteUberEatsStorePosData,
  getUberEatsApiBaseUrl,
  listUberEatsStores,
  postUberEatsStorePosData,
  type UberEatsStoreSummary,
} from "@/features/integrations/providers/uber-eats.marketplace";

export const UBER_EATS_V1_CAPABILITIES = {
  income: true,
  menu: true,
  availability: true,
  storeStatus: true,
  orderActions: false,
  promotions: false,
  catalog: false,
} as const;

export interface UberEatsMerchantStore extends UberEatsStoreSummary {
  environment: "sandbox" | "production";
}

function getUberEatsEnvironment(): "sandbox" | "production" {
  return getUberEatsApiBaseUrl().includes("test-api.uber.com") ? "sandbox" : "production";
}

async function getUberEatsActivationAccessToken(businessId: string): Promise<string> {
  const connection = await findIncomeConnectionByProvider({
    businessId,
    providerId: "uber_eats",
  });

  if (!connection) {
    throw new Error("Uber Eats is not connected for this business");
  }

  if (!connection.access_token_encrypted) {
    throw new Error("Uber Eats connection is missing the provisioning access token");
  }

  return decryptIncomeSecret(connection.access_token_encrypted);
}

export async function listUberEatsMerchantStores(
  businessId: string
): Promise<UberEatsMerchantStore[]> {
  const accessToken = await getUberEatsActivationAccessToken(businessId);
  const environment = getUberEatsEnvironment();
  const stores = await listUberEatsStores({ accessToken });

  return stores.map((store) => ({
    ...store,
    environment,
  }));
}

function buildIntegratorStoreId(storeId: string): string {
  return `vynance:${storeId}`;
}

function buildStoreConfigurationData() {
  return JSON.stringify({
    managed_by: "vynance",
    integration_version: "v1",
  });
}

export async function provisionUberEatsMerchantStore(params: {
  businessId: string;
  storeId: string;
}) {
  const accessToken = await getUberEatsActivationAccessToken(params.businessId);

  return postUberEatsStorePosData({
    accessToken,
    storeId: params.storeId,
    payload: {
      integrator_store_id: buildIntegratorStoreId(params.storeId),
      store_configuration_data: buildStoreConfigurationData(),
    },
  });
}

export async function deprovisionUberEatsMerchantStore(params: {
  businessId: string;
  storeId: string;
}) {
  const accessToken = await getUberEatsActivationAccessToken(params.businessId);

  await deleteUberEatsStorePosData({
    accessToken,
    storeId: params.storeId,
  });
}
