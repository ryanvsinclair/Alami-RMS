"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import {
  createMenuCategory,
  createMenuItem,
  deleteMenuCategory,
  deleteMenuItem,
  getMenuSetupData,
  importMenuItemsFromCsv,
  updateMenuCategory,
  updateMenuItem,
} from "@/app/actions/modules/table-service";
import type {
  MenuCsvImportReport,
  TableServiceMenuCategorySummary,
  TableServiceMenuItemSummary,
  TableServiceMenuSetupData,
} from "@/features/table-service/shared";

type MenuCategory = TableServiceMenuCategorySummary;
type MenuItem = TableServiceMenuItemSummary;

const EMPTY_CATEGORY_FORM = {
  name: "",
  sortOrder: "0",
};

const EMPTY_ITEM_FORM = {
  categoryId: "",
  name: "",
  description: "",
  price: "",
  isAvailable: true,
  sortOrder: "0",
};

function parseSortOrder(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.trunc(parsed);
}

function parsePrice(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export default function MenuSetupPageClient() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importReport, setImportReport] = useState<MenuCsvImportReport | null>(null);

  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryForm, setEditingCategoryForm] = useState(EMPTY_CATEGORY_FORM);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemForm, setEditingItemForm] = useState(EMPTY_ITEM_FORM);

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories],
  );

  async function loadData() {
    setLoading(true);
    try {
      const result = (await getMenuSetupData()) as TableServiceMenuSetupData;
      setCategories(result.categories ?? []);
      setItems(result.items ?? []);
    } catch {
      setError("Failed to load menu setup data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreateCategory() {
    if (!categoryForm.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createMenuCategory({
        name: categoryForm.name,
        sortOrder: parseSortOrder(categoryForm.sortOrder),
        isSeeded: false,
      });
      setCategoryForm(EMPTY_CATEGORY_FORM);
      await loadData();
    } catch {
      setError("Failed to create menu category");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateCategory(categoryId: string) {
    if (!editingCategoryForm.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await updateMenuCategory(categoryId, {
        name: editingCategoryForm.name,
        sortOrder: parseSortOrder(editingCategoryForm.sortOrder),
        isSeeded: false,
      });
      setEditingCategoryId(null);
      setEditingCategoryForm(EMPTY_CATEGORY_FORM);
      await loadData();
    } catch {
      setError("Failed to update menu category");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    setSaving(true);
    setError("");
    try {
      await deleteMenuCategory(categoryId);
      await loadData();
    } catch {
      setError("Failed to delete menu category");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateItem() {
    const price = parsePrice(itemForm.price);
    if (!itemForm.name.trim() || price == null) return;

    setSaving(true);
    setError("");
    try {
      await createMenuItem({
        name: itemForm.name,
        categoryId: itemForm.categoryId || null,
        description: itemForm.description || null,
        price,
        isAvailable: itemForm.isAvailable,
        sortOrder: parseSortOrder(itemForm.sortOrder),
      });
      setItemForm(EMPTY_ITEM_FORM);
      await loadData();
    } catch {
      setError("Failed to create menu item");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateItem(menuItemId: string) {
    const price = parsePrice(editingItemForm.price);
    if (!editingItemForm.name.trim() || price == null) return;

    setSaving(true);
    setError("");
    try {
      await updateMenuItem(menuItemId, {
        name: editingItemForm.name,
        categoryId: editingItemForm.categoryId || null,
        description: editingItemForm.description || null,
        price,
        isAvailable: editingItemForm.isAvailable,
        sortOrder: parseSortOrder(editingItemForm.sortOrder),
      });
      setEditingItemId(null);
      setEditingItemForm(EMPTY_ITEM_FORM);
      await loadData();
    } catch {
      setError("Failed to update menu item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(menuItemId: string) {
    setSaving(true);
    setError("");
    try {
      await deleteMenuItem(menuItemId);
      await loadData();
    } catch {
      setError("Failed to delete menu item");
    } finally {
      setSaving(false);
    }
  }

  async function handleImportCsv() {
    if (!csvText.trim()) return;
    setCsvImporting(true);
    setError("");
    setImportReport(null);
    try {
      const report = (await importMenuItemsFromCsv(csvText)) as MenuCsvImportReport;
      setImportReport(report);
      if (report.createdCount > 0 || report.updatedCount > 0) {
        await loadData();
      }
    } catch {
      setError("Failed to import CSV");
    } finally {
      setCsvImporting(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <Card className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Table Service</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">Menu Setup</h1>
        <p className="mt-2 text-sm text-muted">
          Manage categories and menu items. CSV import supports headers: name, category, description, price, is_available, sort_order.
        </p>
      </Card>

      {error && (
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Add Category</p>
        <Input
          label="Name"
          value={categoryForm.name}
          onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Entrees"
        />
        <Input
          label="Sort order"
          type="number"
          min={0}
          value={categoryForm.sortOrder}
          onChange={(event) => setCategoryForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
        />
        <Button onClick={handleCreateCategory} loading={saving} disabled={!categoryForm.name.trim()}>
          Add Category
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Add Menu Item</p>
        <Select
          label="Category"
          options={categoryOptions}
          placeholder="No category"
          value={itemForm.categoryId}
          onChange={(event) => setItemForm((prev) => ({ ...prev, categoryId: event.target.value }))}
        />
        <Input
          label="Name"
          value={itemForm.name}
          onChange={(event) => setItemForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Cheeseburger"
        />
        <Input
          label="Description"
          value={itemForm.description}
          onChange={(event) => setItemForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Brioche bun, cheddar, pickles"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Price"
            type="number"
            min={0}
            step="0.01"
            value={itemForm.price}
            onChange={(event) => setItemForm((prev) => ({ ...prev, price: event.target.value }))}
          />
          <Input
            label="Sort order"
            type="number"
            min={0}
            value={itemForm.sortOrder}
            onChange={(event) => setItemForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={itemForm.isAvailable}
            onChange={(event) =>
              setItemForm((prev) => ({ ...prev, isAvailable: event.target.checked }))
            }
          />
          Available
        </label>
        <Button
          onClick={handleCreateItem}
          loading={saving}
          disabled={!itemForm.name.trim() || parsePrice(itemForm.price) == null}
        >
          Add Menu Item
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">CSV Import</p>
        <textarea
          rows={6}
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
          className="w-full resize-y rounded-2xl border border-border bg-foreground/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-muted/70"
          placeholder={"name,category,description,price,is_available,sort_order\nCheeseburger,Entrees,Brioche bun,12.50,true,10"}
        />
        <Button onClick={handleImportCsv} loading={csvImporting} disabled={!csvText.trim()}>
          Import CSV
        </Button>
        {importReport && (
          <div className="rounded-2xl border border-border bg-foreground/[0.03] px-4 py-3 text-xs text-muted space-y-1">
            <p>Created: {importReport.createdCount}</p>
            <p>Updated: {importReport.updatedCount}</p>
            <p>Skipped: {importReport.skippedCount}</p>
            {importReport.errors.length > 0 && (
              <div className="pt-1">
                {importReport.errors.slice(0, 6).map((issue) => (
                  <p key={issue}>- {issue}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Categories ({categories.length})</p>
        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted">No categories yet.</p>
        ) : (
          categories.map((category) => (
            <div key={category.id} className="rounded-2xl border border-border p-3 space-y-2">
              {editingCategoryId === category.id ? (
                <>
                  <Input
                    label="Name"
                    value={editingCategoryForm.name}
                    onChange={(event) =>
                      setEditingCategoryForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                  <Input
                    label="Sort order"
                    type="number"
                    min={0}
                    value={editingCategoryForm.sortOrder}
                    onChange={(event) =>
                      setEditingCategoryForm((prev) => ({
                        ...prev,
                        sortOrder: event.target.value,
                      }))
                    }
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateCategory(category.id)}
                      loading={saving}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingCategoryId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{category.name}</p>
                    <p className="text-xs text-muted">
                      sort {category.sortOrder}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingCategoryId(category.id);
                        setEditingCategoryForm({
                          name: category.name,
                          sortOrder: String(category.sortOrder ?? 0),
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteCategory(category.id)}
                      loading={saving}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Menu Items ({items.length})</p>
        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">No menu items yet.</p>
        ) : (
          items.map((item) => {
            const categoryName =
              categories.find((category) => category.id === item.categoryId)?.name ??
              "No category";
            const displayPrice = Number(item.price).toFixed(2);
            const isAvailable = item.isAvailable;
            const sortOrder = item.sortOrder ?? 0;

            return (
              <div key={item.id} className="rounded-2xl border border-border p-3 space-y-2">
                {editingItemId === item.id ? (
                  <>
                    <Select
                      label="Category"
                      options={categoryOptions}
                      placeholder="No category"
                      value={editingItemForm.categoryId}
                      onChange={(event) =>
                        setEditingItemForm((prev) => ({
                          ...prev,
                          categoryId: event.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Name"
                      value={editingItemForm.name}
                      onChange={(event) =>
                        setEditingItemForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                    <Input
                      label="Description"
                      value={editingItemForm.description}
                      onChange={(event) =>
                        setEditingItemForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        label="Price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={editingItemForm.price}
                        onChange={(event) =>
                          setEditingItemForm((prev) => ({
                            ...prev,
                            price: event.target.value,
                          }))
                        }
                      />
                      <Input
                        label="Sort order"
                        type="number"
                        min={0}
                        value={editingItemForm.sortOrder}
                        onChange={(event) =>
                          setEditingItemForm((prev) => ({
                            ...prev,
                            sortOrder: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={editingItemForm.isAvailable}
                        onChange={(event) =>
                          setEditingItemForm((prev) => ({
                            ...prev,
                            isAvailable: event.target.checked,
                          }))
                        }
                      />
                      Available
                    </label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateItem(item.id)}
                        loading={saving}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingItemId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted">
                        {categoryName} | ${displayPrice} | {isAvailable ? "Available" : "86"} | sort {sortOrder}
                      </p>
                      {item.description && (
                        <p className="text-xs text-muted mt-1">{item.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingItemId(item.id);
                          setEditingItemForm({
                            categoryId: item.categoryId ?? "",
                            name: item.name,
                            description: item.description ?? "",
                            price: String(item.price),
                            isAvailable: Boolean(isAvailable),
                            sortOrder: String(sortOrder),
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDeleteItem(item.id)}
                        loading={saving}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
