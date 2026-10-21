"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addZoneMapPage, deleteZoneMapPage, addZoneMapView } from "@/lib/actions/csr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddZoneMapPageButton({ ppapElementId }: { ppapElementId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await addZoneMapPage(ppapElementId);
          router.refresh();
        })
      }
    >
      + Add zone-map page
    </Button>
  );
}

/** Upload a picture (one "view") onto a page, plus delete-page. */
export function ZoneMapPageControls({ pageId, ppapElementId, pageNo }: { pageId: string; ppapElementId: string; pageNo: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" aria-label={`Page ${pageNo} picture`} className="text-xs" />
      <Input aria-label={`Page ${pageNo} new picture caption`} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption, e.g. Visible Area - A" className="h-8 w-56" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          const file = fileRef.current?.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.append("file", file);
          fd.append("caption", caption);
          setError(null);
          startTransition(async () => {
            try {
              await addZoneMapView(pageId, ppapElementId, fd);
              if (fileRef.current) fileRef.current.value = "";
              setCaption("");
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Upload failed.");
            }
          });
        }}
      >
        Add picture
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-destructive"
        disabled={isPending}
        onClick={() => {
          if (!confirm(`Delete zone-map page ${pageNo} and its pictures?`)) return;
          startTransition(async () => {
            await deleteZoneMapPage(pageId, ppapElementId);
            router.refresh();
          });
        }}
      >
        Delete page
      </Button>
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </div>
  );
}
