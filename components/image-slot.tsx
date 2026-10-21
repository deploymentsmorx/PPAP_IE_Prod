"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export type ImageSlotImage = { id: string; url: string; name: string };

/**
 * Shared multi-photo area (the sheets' "Image Ref." boxes): thumbnails that
 * open full size, plus upload / delete when not locked. The owner passes
 * the upload/delete calls (usually server actions bound to the row), so
 * this stays storage-agnostic.
 */
export function ImageSlot({
  label,
  images,
  locked,
  onUpload,
  onDelete,
}: {
  label: string;
  images: ImageSlotImage[];
  locked: boolean;
  onUpload: (formData: FormData) => Promise<void>;
  onDelete: (imageId: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    run(async () => {
      await onUpload(formData);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="space-y-2" data-testid="image-slot">
      <div className="flex flex-wrap gap-2">
        {images.map((img) => (
          <span key={img.id} className="relative">
            <a href={img.url} target="_blank" rel="noreferrer" title={img.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`${label} — ${img.name}`} className="h-20 w-20 rounded border object-cover" />
            </a>
            {!locked ? (
              <button
                type="button"
                aria-label={`Delete photo ${img.name}`}
                className="absolute -right-1 -top-1 rounded-full bg-background px-1 text-xs leading-none text-destructive shadow"
                disabled={isPending}
                onClick={() => run(() => onDelete(img.id))}
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
        {images.length === 0 ? <span className="text-xs text-muted-foreground">No photos yet.</span> : null}
      </div>
      {!locked ? (
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="file" accept="image/*" aria-label={`${label} photo`} className="text-xs" />
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleUpload}>
            {isPending ? "Uploading..." : "Upload photo"}
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
