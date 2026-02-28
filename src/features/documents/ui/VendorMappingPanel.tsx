"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface VendorProfileOption {
  id: string;
  vendor_name: string;
  trust_state: string;
  total_posted: number;
  trust_threshold_override: number | null;
}

interface InventoryItemOption {
  id: string;
  name: string;
}

interface ParsedLineItemView {
  description: string;
}

interface VendorSuggestionView {
  id: string;
  vendor_name: string;
  confidence: number;
}

export interface VendorMappingPanelProps {
  parsedVendorName: string | null;
  senderEmail?: string | null;
  suggestedVendor?: VendorSuggestionView | null;
  vendorProfiles: VendorProfileOption[];
  parsedLineItems?: ParsedLineItemView[];
  inventoryItems?: InventoryItemOption[];
  globalTrustThreshold?: number;
  canManageTrustThreshold?: boolean;
  onConfirmVendor?: (vendorProfileId: string) => Promise<void> | void;
  onCreateVendor?: (payload: {
    vendorName: string;
    supplierId?: string | null;
    defaultCategoryId?: string | null;
    trustThresholdOverride?: number | null;
  }) => Promise<void> | void;
  onUpdateTrustThreshold?: (vendorProfileId: string, threshold: number | null) => Promise<void> | void;
  onConfirmLineItemMapping?: (
    vendorProfileId: string,
    rawName: string,
    inventoryItemId: string,
  ) => Promise<void> | void;
}

export function VendorMappingPanel(props: VendorMappingPanelProps) {
  const {
    parsedVendorName,
    senderEmail,
    suggestedVendor,
    vendorProfiles,
    parsedLineItems = [],
    inventoryItems = [],
    globalTrustThreshold = 5,
    canManageTrustThreshold = false,
    onConfirmVendor,
    onCreateVendor,
    onUpdateTrustThreshold,
    onConfirmLineItemMapping,
  } = props;

  const [selectedVendorId, setSelectedVendorId] = useState<string>(suggestedVendor?.id ?? "");
  const [newVendorName, setNewVendorName] = useState(parsedVendorName ?? "");
  const [trustThresholdInput, setTrustThresholdInput] = useState("");
  const [lineItemMappings, setLineItemMappings] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const vendorOptions = useMemo(
    () =>
      vendorProfiles.map((vendor) => ({
        value: vendor.id,
        label: `${vendor.vendor_name} (${vendor.trust_state})`,
      })),
    [vendorProfiles],
  );

  async function runAsync(action: () => Promise<void> | void) {
    setIsSaving(true);
    try {
      await action();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold">Vendor Mapping</h3>
        <p className="text-xs text-muted">
          Parsed vendor: {parsedVendorName ?? "Unknown"}{senderEmail ? ` - ${senderEmail}` : ""}
        </p>
        {suggestedVendor ? (
          <p className="text-xs text-muted">
            Suggested: {suggestedVendor.vendor_name} ({Math.round(suggestedVendor.confidence * 100)}%)
          </p>
        ) : null}
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <Select
          label="Map To Existing Vendor"
          options={vendorOptions}
          placeholder="Select vendor"
          value={selectedVendorId}
          onChange={(event) => setSelectedVendorId(event.target.value)}
        />
        <div className="flex items-end gap-2">
          <Button
            variant="secondary"
            className="w-full"
            disabled={!selectedVendorId || isSaving}
            onClick={() =>
              runAsync(async () => {
                if (!selectedVendorId || !onConfirmVendor) return;
                await onConfirmVendor(selectedVendorId);
              })
            }
          >
            Confirm Vendor
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input
          label="Create Vendor"
          value={newVendorName}
          onChange={(event) => setNewVendorName(event.target.value)}
          placeholder="Vendor name"
        />
        <div className="flex items-end">
          <Button
            variant="secondary"
            className="w-full md:w-auto"
            disabled={!newVendorName.trim() || isSaving}
            onClick={() =>
              runAsync(async () => {
                if (!onCreateVendor) return;
                await onCreateVendor({
                  vendorName: newVendorName.trim(),
                });
              })
            }
          >
            Create Vendor
          </Button>
        </div>
      </div>

      {canManageTrustThreshold ? (
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            label="Trust Threshold Override"
            value={trustThresholdInput}
            onChange={(event) => setTrustThresholdInput(event.target.value)}
            placeholder={`Global default: ${globalTrustThreshold}`}
            inputMode="numeric"
          />
          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full md:w-auto"
              disabled={!selectedVendorId || isSaving}
              onClick={() =>
                runAsync(async () => {
                  if (!onUpdateTrustThreshold || !selectedVendorId) return;
                  const numericValue = trustThresholdInput.trim()
                    ? Number.parseInt(trustThresholdInput.trim(), 10)
                    : null;
                  await onUpdateTrustThreshold(
                    selectedVendorId,
                    Number.isFinite(numericValue as number) ? numericValue : null,
                  );
                })
              }
            >
              Save Threshold
            </Button>
          </div>
        </div>
      ) : null}

      {parsedLineItems.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Line Item Mapping
          </h4>
          {parsedLineItems.map((line) => {
            const inventoryOptions = inventoryItems.map((item) => ({
              value: item.id,
              label: item.name,
            }));
            const value = lineItemMappings[line.description] ?? "";

            return (
              <div
                key={line.description}
                className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-[1fr_1fr_auto]"
              >
                <p className="text-sm">{line.description}</p>
                <Select
                  options={inventoryOptions}
                  placeholder="Inventory item"
                  value={value}
                  onChange={(event) =>
                    setLineItemMappings((current) => ({
                      ...current,
                      [line.description]: event.target.value,
                    }))
                  }
                />
                <Button
                  variant="secondary"
                  disabled={!selectedVendorId || !value || isSaving}
                  onClick={() =>
                    runAsync(async () => {
                      if (!onConfirmLineItemMapping || !selectedVendorId || !value) return;
                      await onConfirmLineItemMapping(selectedVendorId, line.description, value);
                    })
                  }
                >
                  Confirm
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default VendorMappingPanel;
