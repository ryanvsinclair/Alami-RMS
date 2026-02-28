"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface TableQrModalProps {
  tableNumber: string;
  scanUrl: string;
  onClose: () => void;
}

export function TableQrModal({ tableNumber, scanUrl, onClose }: TableQrModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState("");

  // QR canvas size — large enough for crisp printing
  const QR_SIZE = 360;
  const PADDING = 24;
  const LABEL_HEIGHT = 52;
  const TOTAL_HEIGHT = QR_SIZE + PADDING * 2 + LABEL_HEIGHT;
  const TOTAL_WIDTH = QR_SIZE + PADDING * 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use a higher pixel ratio for crisp PNG export
    const ratio = 2;
    canvas.width = TOTAL_WIDTH * ratio;
    canvas.height = TOTAL_HEIGHT * ratio;
    canvas.style.width = `${TOTAL_WIDTH}px`;
    canvas.style.height = `${TOTAL_HEIGHT}px`;
    ctx.scale(ratio, ratio);

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.roundRect(0, 0, TOTAL_WIDTH, TOTAL_HEIGHT, 12);
    ctx.fill();

    // Draw QR into a temp canvas then composite
    const tempCanvas = document.createElement("canvas");
    QRCode.toCanvas(
      tempCanvas,
      scanUrl,
      {
        width: QR_SIZE,
        margin: 0,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "H",
      },
      (err) => {
        if (err) {
          setError("Failed to generate QR code");
          return;
        }
        ctx.drawImage(tempCanvas, PADDING, PADDING, QR_SIZE, QR_SIZE);

        // Table label
        ctx.fillStyle = "#111827";
        ctx.font = `bold ${18}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(tableNumber, TOTAL_WIDTH / 2, QR_SIZE + PADDING + 28);

        // Subtle URL hint
        ctx.fillStyle = "#6b7280";
        ctx.font = `${11}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
        const shortUrl = scanUrl.replace(/^https?:\/\//, "");
        ctx.fillText(shortUrl, TOTAL_WIDTH / 2, QR_SIZE + PADDING + 46, TOTAL_WIDTH - PADDING);

        setRendered(true);
      },
    );
  }, [scanUrl, tableNumber, QR_SIZE, PADDING, LABEL_HEIGHT, TOTAL_HEIGHT, TOTAL_WIDTH]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    const safeName = tableNumber.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    link.download = `qr-${safeName}.png`;
    link.href = canvas.toDataURL("image/png", 1.0);
    link.click();
  }

  function handlePrint() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png", 1.0);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR – ${tableNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: #fff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            img { max-width: 320px; width: 100%; }
            @media print {
              body { min-height: unset; padding: 32px; }
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="QR code for ${tableNumber}" />
          <script>
            window.onload = function() { window.print(); };
          <\/script>
        </body>
      </html>
    `);
    win.document.close();
  }

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleBackdrop}
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">QR Code</p>
            <p className="mt-0.5 text-lg font-bold text-foreground">{tableNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-foreground/10 hover:text-foreground"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Canvas */}
        <div className="flex items-center justify-center rounded-2xl border border-border bg-white p-3">
          {error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : (
            <canvas ref={canvasRef} className="rounded-lg" />
          )}
        </div>

        {/* Scan URL */}
        <div className="rounded-xl border border-border bg-foreground/[0.03] px-3 py-2">
          <p className="break-all text-xs text-muted">{scanUrl}</p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!rendered}
            className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-border bg-foreground/[0.04] text-sm font-semibold text-foreground transition-colors hover:bg-foreground/[0.08] disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!rendered}
            className="flex h-10 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-white shadow-[0_4px_12px_rgba(0,127,255,0.28)] transition-colors hover:bg-primary-hover disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
            </svg>
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
