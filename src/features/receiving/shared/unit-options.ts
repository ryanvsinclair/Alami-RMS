import type { UnitType } from "@/lib/generated/prisma/client";

export interface ReceiveUnitOption {
  value: UnitType;
  label: string;
}

export const RECEIVE_UNIT_OPTIONS: ReceiveUnitOption[] = [
  { value: "each", label: "Each" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "g", label: "Grams (g)" },
  { value: "lb", label: "Pounds (lb)" },
  { value: "oz", label: "Ounces (oz)" },
  { value: "l", label: "Litres (L)" },
  { value: "ml", label: "Millilitres (ml)" },
  { value: "gal", label: "Gallons" },
  { value: "case_unit", label: "Case" },
  { value: "pack", label: "Pack" },
  { value: "box", label: "Box" },
  { value: "bag", label: "Bag" },
  { value: "dozen", label: "Dozen" },
];

export const RECEIVE_UNIT_OPTIONS_COMPACT: ReceiveUnitOption[] = [
  { value: "each", label: "Each" },
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "lb", label: "lb" },
  { value: "oz", label: "oz" },
  { value: "l", label: "L" },
  { value: "ml", label: "ml" },
  { value: "case_unit", label: "Case" },
  { value: "pack", label: "Pack" },
  { value: "box", label: "Box" },
  { value: "bag", label: "Bag" },
];
