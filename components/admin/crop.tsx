"use client";

import { useEffect, useRef, useState } from "react";
import { uploadImage } from "@/components/admin/api";

export function PhotoPicker({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex h-12 items-center justify-center rounded-full bg-bark text-sm font-medium text-cream">
          Kamera
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const next = event.target.files?.[0];
              if (next) setFile(next);
              event.target.value = "";
            }}
          />
        </label>
        <label className="flex h-12 items-center justify-center rounded-full border border-line bg-paper text-sm font-medium">
          Bilder
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const next = event.target.files?.[0];
              if (next) setFile(next);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="mt-2 text-sm text-muted">Ta ett foto eller välj en bild. Du kan flytta och zooma innan den sparas.</p>
      {error && <p className="mt-2 text-sm text-red-900">{error}</p>}
      {file && (
        <CropDialog
          file={file}
          onCancel={() => setFile(null)}
          onDone={async (blob) => {
            setError("");
            try {
              const url = await uploadImage(new File([blob], "bild.jpg", { type: "image/jpeg" }));
              onUploaded(url);
              setFile(null);
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Bilden kunde inte sparas.");
            }
          }}
        />
      )}
    </div>
  );
}

function CropDialog({ file, onDone, onCancel }: { file: File; onDone: (blob: Blob) => Promise<void>; onCancel: () => void }) {
  const [url] = useState(() => URL.createObjectURL(file));
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  async function confirmCrop() {
    const image = imgRef.current;
    if (!image) return;
    setBusy(true);
    const view = 320;
    const base = Math.max(view / image.naturalWidth, view / image.naturalHeight);
    const scale = base * zoom;
    const drawnW = image.naturalWidth * scale;
    const drawnH = image.naturalHeight * scale;
    const sx = ((drawnW - view) / 2 - offset.x) * (image.naturalWidth / drawnW);
    const sy = ((drawnH - view) / 2 - offset.y) * (image.naturalHeight / drawnH);
    const sourceSize = view * (image.naturalWidth / drawnW);
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1200;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, 1200, 1200);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (blob) await onDone(blob);
    setBusy(false);
  }

  return (
    <div className="mt-3 rounded-3xl bg-paper p-3">
      <p className="text-sm font-medium">Beskär bilden</p>
      <div
        className="relative mx-auto mt-3 h-64 w-64 touch-none overflow-hidden rounded-2xl bg-cream-2"
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setOffset({
            x: drag.current.ox + event.clientX - drag.current.x,
            y: drag.current.oy + event.clientY - drag.current.y,
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <img
          ref={imgRef}
          src={url}
          alt="Förhandsvisning"
          draggable={false}
          className="absolute left-1/2 top-1/2 max-w-none select-none"
          style={{
            width: `${100 * zoom}%`,
            height: `${100 * zoom}%`,
            objectFit: "cover",
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          }}
        />
      </div>
      <label className="mt-3 block text-sm">
        Zoom
        <input className="mt-1 w-full" type="range" min={1} max={3} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="h-12 rounded-full border border-line" onClick={onCancel}>Avbryt</button>
        <button type="button" className="gold-btn h-12 rounded-full" disabled={busy} onClick={confirmCrop}>{busy ? "Sparar…" : "Använd bilden"}</button>
      </div>
    </div>
  );
}
