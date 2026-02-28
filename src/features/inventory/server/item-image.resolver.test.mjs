import assert from "node:assert/strict";
import test from "node:test";

import {
  extractCanonicalPluCodeFromBarcode,
  resolveItemImageUrl,
} from "./item-image.resolver.core.ts";

test("resolveItemImageUrl returns own image when inventory image exists", () => {
  const result = resolveItemImageUrl({
    inventoryItemImageUrl: "https://images.example.com/own.jpg",
    pluCode: 4131,
    produceImageUrl: "https://images.example.com/produce.jpg",
    barcodeNormalized: "012345678905",
    barcodeImageUrl: "https://images.example.com/barcode.jpg",
  });

  assert.deepEqual(result, {
    source: "own",
    imageUrl: "https://images.example.com/own.jpg",
  });
});

test("resolveItemImageUrl returns produce image when no own image and produce image exists", () => {
  const result = resolveItemImageUrl({
    inventoryItemImageUrl: null,
    pluCode: 4131,
    produceImageUrl: "https://images.example.com/produce.jpg",
    barcodeNormalized: "012345678905",
    barcodeImageUrl: "https://images.example.com/barcode.jpg",
  });

  assert.deepEqual(result, {
    source: "produce",
    imageUrl: "https://images.example.com/produce.jpg",
  });
});

test("resolveItemImageUrl returns barcode image when own/produce are unavailable", () => {
  const result = resolveItemImageUrl({
    inventoryItemImageUrl: null,
    pluCode: null,
    produceImageUrl: null,
    barcodeNormalized: "012345678905",
    barcodeImageUrl: "https://images.example.com/barcode.jpg",
  });

  assert.deepEqual(result, {
    source: "barcode",
    imageUrl: "https://images.example.com/barcode.jpg",
  });
});

test("resolveItemImageUrl returns none when no image candidate exists", () => {
  const result = resolveItemImageUrl({
    inventoryItemImageUrl: null,
    pluCode: null,
    produceImageUrl: null,
    barcodeNormalized: null,
    barcodeImageUrl: null,
  });

  assert.deepEqual(result, {
    source: "none",
    imageUrl: null,
  });
});

test("resolveItemImageUrl preserves own-image priority over produce image", () => {
  const result = resolveItemImageUrl({
    inventoryItemImageUrl: "https://images.example.com/own.jpg",
    pluCode: 4131,
    produceImageUrl: "https://images.example.com/produce.jpg",
  });

  assert.deepEqual(result, {
    source: "own",
    imageUrl: "https://images.example.com/own.jpg",
  });
});

test("extractCanonicalPluCodeFromBarcode normalizes 9-prefix PLU barcodes", () => {
  assert.equal(extractCanonicalPluCodeFromBarcode("94131"), 4131);
  assert.equal(extractCanonicalPluCodeFromBarcode("4131"), 4131);
  assert.equal(extractCanonicalPluCodeFromBarcode("012345678905"), null);
});
