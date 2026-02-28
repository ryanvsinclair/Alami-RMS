import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { serialize } from "@/domain/shared/serialize";
import {
  type MenuCsvImportReport,
  type TableServiceMenuCategorySummary,
  type TableServiceMenuItemSummary,
  type TableServiceMenuSetupData,
  type UpsertMenuCategoryInput,
  type UpsertMenuItemInput,
} from "../shared/table-service.contracts";
import { parseMenuCsv } from "./menu-csv";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function toDecimal(price: number) {
  return new Prisma.Decimal(price.toFixed(2));
}

function toSortOrder(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function toMenuCategorySummary(category: {
  id: string;
  business_id: string;
  name: string;
  sort_order: number;
  is_seeded: boolean;
}): TableServiceMenuCategorySummary {
  return {
    id: category.id,
    businessId: category.business_id,
    name: category.name,
    sortOrder: category.sort_order,
    isSeeded: category.is_seeded,
  };
}

function toMenuItemSummary(item: {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: Prisma.Decimal;
  is_available: boolean;
  sort_order: number;
}): TableServiceMenuItemSummary {
  return {
    id: item.id,
    businessId: item.business_id,
    categoryId: item.category_id,
    name: item.name,
    description: item.description,
    price: item.price.toNumber(),
    isAvailable: item.is_available,
    sortOrder: item.sort_order,
  };
}

export async function getMenuSetupData(businessId: string) {
  const [categories, items] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { business_id: businessId },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    }),
    prisma.menuItem.findMany({
      where: { business_id: businessId },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    }),
  ]);

  const result: TableServiceMenuSetupData = {
    categories: categories.map(toMenuCategorySummary),
    items: items.map(toMenuItemSummary),
  };
  return serialize(result);
}

export async function createMenuCategory(
  businessId: string,
  input: UpsertMenuCategoryInput,
) {
  const category = await prisma.menuCategory.create({
    data: {
      business_id: businessId,
      name: input.name.trim(),
      sort_order: toSortOrder(input.sortOrder),
      is_seeded: input.isSeeded ?? false,
    },
  });

  return serialize(toMenuCategorySummary(category));
}

export async function updateMenuCategory(
  businessId: string,
  categoryId: string,
  input: UpsertMenuCategoryInput,
) {
  const existing = await prisma.menuCategory.findFirst({
    where: { id: categoryId, business_id: businessId },
    select: { id: true },
  });
  if (!existing) throw new Error("Menu category not found");

  const category = await prisma.menuCategory.update({
    where: { id: categoryId },
    data: {
      name: input.name.trim(),
      sort_order: toSortOrder(input.sortOrder),
      is_seeded: input.isSeeded ?? false,
    },
  });

  return serialize(toMenuCategorySummary(category));
}

export async function deleteMenuCategory(businessId: string, categoryId: string) {
  const existing = await prisma.menuCategory.findFirst({
    where: { id: categoryId, business_id: businessId },
    select: { id: true },
  });
  if (!existing) throw new Error("Menu category not found");

  await prisma.menuCategory.delete({ where: { id: categoryId } });
}

export async function createMenuItem(businessId: string, input: UpsertMenuItemInput) {
  const categoryId = normalizeOptionalText(input.categoryId);
  if (categoryId) {
    const category = await prisma.menuCategory.findFirst({
      where: { id: categoryId, business_id: businessId },
      select: { id: true },
    });
    if (!category) throw new Error("Menu category not found");
  }

  const item = await prisma.menuItem.create({
    data: {
      business_id: businessId,
      category_id: categoryId,
      name: input.name.trim(),
      description: normalizeOptionalText(input.description),
      price: toDecimal(input.price),
      is_available: input.isAvailable ?? true,
      sort_order: toSortOrder(input.sortOrder),
    },
  });

  return serialize(toMenuItemSummary(item));
}

export async function updateMenuItem(
  businessId: string,
  menuItemId: string,
  input: UpsertMenuItemInput,
) {
  const existing = await prisma.menuItem.findFirst({
    where: { id: menuItemId, business_id: businessId },
    select: { id: true },
  });
  if (!existing) throw new Error("Menu item not found");

  const categoryId = normalizeOptionalText(input.categoryId);
  if (categoryId) {
    const category = await prisma.menuCategory.findFirst({
      where: { id: categoryId, business_id: businessId },
      select: { id: true },
    });
    if (!category) throw new Error("Menu category not found");
  }

  const item = await prisma.menuItem.update({
    where: { id: menuItemId },
    data: {
      category_id: categoryId,
      name: input.name.trim(),
      description: normalizeOptionalText(input.description),
      price: toDecimal(input.price),
      is_available: input.isAvailable ?? true,
      sort_order: toSortOrder(input.sortOrder),
    },
  });

  return serialize(toMenuItemSummary(item));
}

export async function deleteMenuItem(businessId: string, menuItemId: string) {
  const existing = await prisma.menuItem.findFirst({
    where: { id: menuItemId, business_id: businessId },
    select: { id: true },
  });
  if (!existing) throw new Error("Menu item not found");

  await prisma.menuItem.delete({ where: { id: menuItemId } });
}

export async function importMenuItemsFromCsv(
  businessId: string,
  csvText: string,
): Promise<MenuCsvImportReport> {
  const parsed = parseMenuCsv(csvText);
  if (parsed.rows.length === 0) {
    return {
      createdCount: 0,
      updatedCount: 0,
      skippedCount: parsed.errors.length,
      errors: parsed.errors,
    };
  }

  return prisma.$transaction(async (tx) => {
    let createdCount = 0;
    let updatedCount = 0;

    const categoryNames = Array.from(
      new Set(
        parsed.rows
          .map((row) => row.categoryName?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const existingCategories = await tx.menuCategory.findMany({
      where: {
        business_id: businessId,
        name: { in: categoryNames },
      },
      select: { id: true, name: true },
    });

    const categoryByName = new Map<string, string>();
    for (const category of existingCategories) {
      categoryByName.set(normalizeText(category.name), category.id);
    }

    for (const categoryName of categoryNames) {
      const key = normalizeText(categoryName);
      if (categoryByName.has(key)) continue;
      const created = await tx.menuCategory.create({
        data: {
          business_id: businessId,
          name: categoryName.trim(),
          sort_order: 0,
          is_seeded: false,
        },
        select: { id: true, name: true },
      });
      categoryByName.set(normalizeText(created.name), created.id);
    }

    const itemNames = Array.from(new Set(parsed.rows.map((row) => row.name.trim())));
    const existingItems = await tx.menuItem.findMany({
      where: {
        business_id: businessId,
        name: { in: itemNames },
      },
      select: {
        id: true,
        name: true,
        category_id: true,
      },
    });

    const existingByKey = new Map<string, { id: string }>();
    for (const item of existingItems) {
      const key = `${normalizeText(item.name)}::${item.category_id ?? ""}`;
      if (!existingByKey.has(key)) {
        existingByKey.set(key, { id: item.id });
      }
    }

    for (const row of parsed.rows) {
      const categoryId = row.categoryName
        ? categoryByName.get(normalizeText(row.categoryName)) ?? null
        : null;
      const key = `${normalizeText(row.name)}::${categoryId ?? ""}`;
      const existing = existingByKey.get(key);

      if (existing) {
        await tx.menuItem.update({
          where: { id: existing.id },
          data: {
            description: row.description,
            price: toDecimal(row.price),
            is_available: row.isAvailable,
            sort_order: row.sortOrder,
          },
        });
        updatedCount += 1;
      } else {
        const created = await tx.menuItem.create({
          data: {
            business_id: businessId,
            category_id: categoryId,
            name: row.name,
            description: row.description,
            price: toDecimal(row.price),
            is_available: row.isAvailable,
            sort_order: row.sortOrder,
          },
          select: { id: true },
        });
        existingByKey.set(key, { id: created.id });
        createdCount += 1;
      }
    }

    return {
      createdCount,
      updatedCount,
      skippedCount: parsed.errors.length,
      errors: parsed.errors,
    };
  });
}
