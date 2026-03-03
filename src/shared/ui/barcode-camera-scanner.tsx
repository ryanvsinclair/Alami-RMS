"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { Card } from "./card";

type BarcodeDetectorFormat =
  | "aztec"
  | "code_128"
  | "code_39"
  | "code_93"
  | "codabar"
  | "data_matrix"
  | "ean_13"
  | "ean_8"
  | "itf"
  | "pdf417"
  | "qr_code"
  | "upc_a"
  | "upc_e";

type BarcodeDetectorResult = {
  rawValue?: string;
};

type BarcodeDetectorInstance = {
  detect: (image: ImageBitmapSource) => Promise<BarcodeDetectorResult[]>;
};

type BarcodeDetectorCtor = {
  new (options?: { formats?: BarcodeDetectorFormat[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<BarcodeDetectorFormat[]>;
};

type WindowWithBarcodeDetector = Window & {
  BarcodeDetector?: BarcodeDetectorCtor;
};

const DEFAULT_FORMATS: BarcodeDetectorFormat[] = [
  "upc_a",
  "upc_e",
  "ean_13",
  "ean_8",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "itf",
];

interface BarcodeCameraScannerProps {
  onDetected: (barcode: string) => void;
  disabled?: boolean;
  triggerLabel?: string;
  formats?: BarcodeDetectorFormat[];
  helperText?: string;
  cancelLabel?: string;
}

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const detector = (window as WindowWithBarcodeDetector).BarcodeDetector;
  return detector ?? null;
}

export function BarcodeCameraScanner({
  onDetected,
  disabled = false,
  triggerLabel = "Use Camera Scanner",
  formats,
  helperText = "Point your camera at a UPC/EAN barcode. The scanner will auto-fill once detected.",
  cancelLabel = "Cancel Camera Scanner",
}: BarcodeCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const scanTimeoutRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const lastDetectedRef = useRef<string>("");

  const [scannerOpen, setScannerOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  function stopScanner() {
    activeRef.current = false;

    if (scanTimeoutRef.current != null && typeof window !== "undefined") {
      window.clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    detectorRef.current = null;

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  async function scanFrame() {
    if (!activeRef.current) return;

    const detector = detectorRef.current;
    const video = videoRef.current;

    if (!detector || !video) return;

    try {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const results = await detector.detect(video);
        const rawValue = results[0]?.rawValue?.trim();
        if (rawValue && rawValue !== lastDetectedRef.current) {
          lastDetectedRef.current = rawValue;
          onDetected(rawValue);
          setScannerOpen(false);
          stopScanner();
          return;
        }
      }
    } catch {
      // Fail open and keep scanning.
    }

    if (activeRef.current && typeof window !== "undefined") {
      scanTimeoutRef.current = window.setTimeout(() => {
        void scanFrame();
      }, 140);
    }
  }

  async function startScanner() {
    if (disabled || starting) return;

    setError("");
    setStarting(true);
    lastDetectedRef.current = "";

    try {
      const detectorCtor = getBarcodeDetectorCtor();
      if (!detectorCtor) {
        throw new Error(
          "Camera scanning is not supported in this browser. Continue with typed or hardware scanner input.",
        );
      }

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is unavailable on this device.");
      }

      const supportedFormats = detectorCtor.getSupportedFormats
        ? await detectorCtor.getSupportedFormats()
        : null;

      const requestedFormats = formats && formats.length > 0 ? formats : DEFAULT_FORMATS;
      const detectorFormats = supportedFormats
        ? requestedFormats.filter((format) => supportedFormats.includes(format))
        : requestedFormats;

      detectorRef.current = new detectorCtor(
        detectorFormats.length > 0 ? { formats: detectorFormats } : undefined,
      );

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
        },
      });
      streamRef.current = stream;
      setScannerOpen(true);

      await new Promise<void>((resolve) => {
        if (typeof window !== "undefined") {
          window.requestAnimationFrame(() => resolve());
        } else {
          resolve();
        }
      });

      const video = videoRef.current;
      if (!video) {
        throw new Error("Scanner preview failed to initialize.");
      }

      video.srcObject = stream;
      await video.play();

      activeRef.current = true;
      void scanFrame();
    } catch (err) {
      setScannerOpen(false);
      stopScanner();
      setError(err instanceof Error ? err.message : "Failed to start camera scanner.");
    } finally {
      setStarting(false);
    }
  }

  function closeScanner() {
    setScannerOpen(false);
    stopScanner();
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        onClick={() => void startScanner()}
        disabled={disabled}
        loading={starting}
        className="w-full"
      >
        {triggerLabel}
      </Button>

      {scannerOpen && (
        <Card className="space-y-3 border-primary/25 bg-primary/[0.04]">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-black/40">
            <video
              ref={videoRef}
              muted
              playsInline
              className="h-56 w-full object-cover"
              aria-label="Live camera scanner preview"
            />
            <div className="pointer-events-none absolute inset-0 border-2 border-primary/30" />
          </div>
          <p className="text-xs text-muted">
            {helperText}
          </p>
          <Button type="button" variant="ghost" onClick={closeScanner} className="w-full">
            {cancelLabel}
          </Button>
        </Card>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
