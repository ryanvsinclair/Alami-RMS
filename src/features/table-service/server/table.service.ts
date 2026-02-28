import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db/prisma";
import { serialize } from "@/domain/shared/serialize";
import type { TableServiceDiningTableSummary } from "../shared/table-service.contracts";

function generateQrToken() {
  return `tbl_${randomUUID().replace(/-/g, "")}`;
}

function normalizeTableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Table number is required");
  return trimmed;
}

function toDiningTableSummary(table: {
  id: string;
  business_id: string;
  table_number: string;
  qr_token: string;
}): TableServiceDiningTableSummary {
  return {
    id: table.id,
    businessId: table.business_id,
    tableNumber: table.table_number,
    qrToken: table.qr_token,
  };
}

async function createUniqueQrToken() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateQrToken();
    const existing = await prisma.diningTable.findUnique({
      where: { qr_token: token },
      select: { id: true },
    });
    if (!existing) return token;
  }
  throw new Error("Failed to generate unique QR token");
}

export async function getDiningTables(businessId: string) {
  const tables = await prisma.diningTable.findMany({
    where: { business_id: businessId },
    orderBy: [{ table_number: "asc" }],
  });

  return serialize(tables.map(toDiningTableSummary));
}

export async function createDiningTable(businessId: string, input: { tableNumber: string }) {
  const tableNumber = normalizeTableNumber(input.tableNumber);
  const qrToken = await createUniqueQrToken();

  const table = await prisma.diningTable.create({
    data: {
      business_id: businessId,
      table_number: tableNumber,
      qr_token: qrToken,
    },
  });

  return serialize(toDiningTableSummary(table));
}

export async function updateDiningTable(
  businessId: string,
  tableId: string,
  input: { tableNumber: string },
) {
  const tableNumber = normalizeTableNumber(input.tableNumber);

  const existing = await prisma.diningTable.findFirst({
    where: { id: tableId, business_id: businessId },
    select: { id: true },
  });
  if (!existing) throw new Error("Dining table not found");

  const table = await prisma.diningTable.update({
    where: { id: tableId },
    data: { table_number: tableNumber },
  });

  return serialize(toDiningTableSummary(table));
}

export async function deleteDiningTable(businessId: string, tableId: string) {
  const existing = await prisma.diningTable.findFirst({
    where: { id: tableId, business_id: businessId },
    select: { id: true },
  });
  if (!existing) throw new Error("Dining table not found");

  await prisma.diningTable.delete({
    where: { id: tableId },
  });
}

export async function regenerateDiningTableQrToken(businessId: string, tableId: string) {
  const existing = await prisma.diningTable.findFirst({
    where: { id: tableId, business_id: businessId },
    select: { id: true },
  });
  if (!existing) throw new Error("Dining table not found");

  const qrToken = await createUniqueQrToken();
  const table = await prisma.diningTable.update({
    where: { id: tableId },
    data: { qr_token: qrToken },
  });

  return serialize(toDiningTableSummary(table));
}
