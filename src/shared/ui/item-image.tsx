"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export type ItemImageSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS_BY_VARIANT: Record<Exclude<ItemImageSize, "xl">, string> = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-20 w-20",
};

const SIZE_PX_BY_VARIANT: Record<ItemImageSize, number> = {
  sm: 32,
  md: 48,
  lg: 80,
  xl: 512,
};

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (words.length === 0) return "?";
  return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

function CategoryGlyph({ category }: { category: string }) {
  const normalized = category.toLowerCase();
  if (normalized.includes("produce") || normalized.includes("fruit") || normalized.includes("vegetable")) {
    return (
      <svg aria-hidden className="h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none">
        <path d="M12 21c4-1 7-4.5 7-9.5V5.5l-7 3-7-3v6C5 16.5 8 20 12 21Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (normalized.includes("drink") || normalized.includes("beverage")) {
    return (
      <svg aria-hidden className="h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none">
        <path d="M7 4h10l-1 6h-8L7 4Zm1 6h8v8a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-8Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg aria-hidden className="h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="7" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ItemImage({
  src,
  name,
  category,
  size,
  className = "",
}: {
  src: string | null | undefined;
  name: string;
  category?: string | null;
  size: ItemImageSize;
  className?: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const hasSource = Boolean(src?.trim());
  const initials = useMemo(() => getInitials(name), [name]);
  const sizeClass = size === "xl" ? "w-full aspect-square" : SIZE_CLASS_BY_VARIANT[size];
  const pixelSize = SIZE_PX_BY_VARIANT[size];

  return (
    <div
      className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-xl border border-[var(--surface-card-border)] bg-[var(--surface-card-bg)] ${className}`}
      aria-label={`${name} image`}
    >
      {hasSource ? (
        <Image
          src={src!}
          alt={`${name} image`}
          width={pixelSize}
          height={pixelSize}
          unoptimized
          className={`h-full w-full object-cover transition-opacity duration-200 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setIsLoaded(true)}
        />
      ) : category ? (
        <div className="flex h-full w-full items-center justify-center">
          <CategoryGlyph category={category} />
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted">
          {initials}
        </div>
      )}
    </div>
  );
}
