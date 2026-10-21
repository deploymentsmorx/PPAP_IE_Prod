"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveZoneMapView, deleteZoneMapView } from "@/lib/actions/csr";
import { rectFromDrag, ZONE_COLOURS, ZONE_LABELS, type Crop, type Zone, type ZoneAnnotation } from "@/lib/calc/csr";
import { ZonePicture } from "@/components/csr/zone-picture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type View = {
  id: string;
  imageUrl: string;
  imageName: string;
  imageWidth: number | null;
  imageHeight: number | null;
  crop: Crop | null;
  caption: string | null;
  annotations: ZoneAnnotation[];
};

/**
 * Draw zones over one picture: drag for a rectangle, or click points and
 * "Finish polygon" for a polygon. Coordinates are stored as fractions of
 * the (cropped) picture, so they survive any display size.
 */
export function ZoneMapEditor({ view, ppapElementId, locked }: { view: View; ppapElementId: string; locked: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [annotations, setAnnotations] = useState<ZoneAnnotation[]>(view.annotations);
  const [caption, setCaption] = useState(view.caption ?? "");
  const [zone, setZone] = useState<Zone>("A");
  const [label, setLabel] = useState("");
  const [tool, setTool] = useState<"rect" | "polygon">("rect");
  const [drag, setDrag] = useState<{ start: [number, number]; end: [number, number] } | null>(null);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  function frac(e: React.PointerEvent): [number, number] {
    const box = layerRef.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)), Math.min(1, Math.max(0, (e.clientY - box.top) / box.height))];
  }

  function add(a: ZoneAnnotation) {
    setAnnotations((prev) => [...prev, a]);
    setDirty(true);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (locked) return;
    const p = frac(e);
    if (tool === "rect") {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({ start: p, end: p });
    } else {
      setPoints((prev) => [...prev, p]);
    }
  }

  function onPointerUp() {
    if (tool !== "rect" || !drag) return;
    const r = rectFromDrag(drag.start, drag.end);
    setDrag(null);
    if (r.w > 0.01 && r.h > 0.01) add({ kind: "rect", zone, label: label || undefined, ...r });
  }

  function finishPolygon() {
    if (points.length >= 3) add({ kind: "polygon", zone, label: label || undefined, points });
    setPoints([]);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        await saveZoneMapView(view.id, ppapElementId, { caption, annotations });
        setDirty(false);
        setMessage("Saved.");
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Could not save.");
      }
    });
  }

  const preview: ZoneAnnotation[] = [
    ...annotations,
    ...(drag ? [{ kind: "rect" as const, zone, label: label || undefined, ...rectFromDrag(drag.start, drag.end) }] : []),
  ];

  return (
    <div className="space-y-2 rounded-md border p-2" data-testid="zone-view">
      <Input
        aria-label="Caption"
        value={caption}
        disabled={locked}
        onChange={(e) => {
          setCaption(e.target.value);
          setDirty(true);
        }}
        placeholder="Caption, e.g. Visible Area - A"
        className="h-8 font-medium"
      />
      <ZonePicture imageUrl={view.imageUrl} alt={view.caption ?? view.imageName} width={view.imageWidth} height={view.imageHeight} crop={view.crop} annotations={preview}>
        {points.length > 0 ? (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
            <polyline points={points.map((p) => p.join(",")).join(" ")} fill="none" stroke={ZONE_COLOURS[zone]} strokeWidth={2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : null}
        {!locked ? (
          <div
            ref={layerRef}
            data-testid="zone-draw-layer"
            className="absolute inset-0 cursor-crosshair touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={(e) => drag && setDrag({ ...drag, end: frac(e) })}
            onPointerUp={onPointerUp}
          />
        ) : null}
      </ZonePicture>

      {!locked ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select aria-label="Zone" value={zone} onChange={(e) => setZone(e.target.value as Zone)} className="h-8 rounded-md border bg-transparent px-2 text-sm" style={{ color: ZONE_COLOURS[zone] }}>
            {(Object.keys(ZONE_LABELS) as Zone[]).map((z) => (
              <option key={z} value={z}>
                {ZONE_LABELS[z]}
              </option>
            ))}
          </select>
          <select aria-label="Tool" value={tool} onChange={(e) => { setTool(e.target.value as "rect" | "polygon"); setPoints([]); }} className="h-8 rounded-md border bg-transparent px-2 text-sm">
            <option value="rect">Rectangle (drag)</option>
            <option value="polygon">Polygon (click points)</option>
          </select>
          <Input aria-label="Zone label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="h-8 w-44" />
          {tool === "polygon" ? (
            <Button type="button" size="sm" variant="outline" disabled={points.length < 3} onClick={finishPolygon}>
              Finish polygon ({points.length})
            </Button>
          ) : null}
          <Button type="button" size="sm" disabled={isPending || !dirty} onClick={save}>
            {isPending ? "Saving..." : "Save zones"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={isPending}
            onClick={() => {
              if (!confirm("Remove this picture from the page?")) return;
              startTransition(async () => {
                await deleteZoneMapView(view.id, ppapElementId);
                router.refresh();
              });
            }}
          >
            Remove picture
          </Button>
          {message ? <span className="text-muted-foreground">{message}</span> : null}
        </div>
      ) : null}

      {annotations.length > 0 ? (
        <ul className="flex flex-wrap gap-1 text-xs">
          {annotations.map((a, i) => (
            <li key={i} className="flex items-center gap-1 rounded border px-1" style={{ borderColor: ZONE_COLOURS[a.zone] }}>
              <span style={{ color: ZONE_COLOURS[a.zone] }}>■</span>
              {a.zone} {a.kind}
              {a.label ? ` — ${a.label}` : ""}
              {!locked ? (
                <button
                  type="button"
                  aria-label={`Delete zone ${i + 1}`}
                  className="text-destructive"
                  onClick={() => {
                    setAnnotations((prev) => prev.filter((_, j) => j !== i));
                    setDirty(true);
                  }}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
