import { cropLayout, ZONE_COLOURS, type Crop, type ZoneAnnotation } from "@/lib/calc/csr";

/**
 * A zone-map picture: the (optionally cropped) image with the drawn zones
 * over it. No hooks, so the print route and the client editor share it.
 * Shapes are SVG in a 0-1 viewBox stretched over the picture; labels are
 * HTML so they don't stretch with it.
 */
export function ZonePicture({
  imageUrl,
  alt,
  width,
  height,
  crop,
  annotations,
  children,
}: {
  imageUrl: string;
  alt: string;
  width: number | null;
  height: number | null;
  crop: Crop | null;
  annotations: ZoneAnnotation[];
  /** Extra overlay (the editor's in-progress shape and pointer layer). */
  children?: React.ReactNode;
}) {
  const layout = cropLayout(crop, width, height);
  return (
    <div className="relative w-full overflow-hidden" style={layout.aspectRatio ? { aspectRatio: String(layout.aspectRatio) } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        draggable={false}
        className={layout.aspectRatio ? "absolute max-w-none select-none" : "block w-full select-none"}
        style={
          layout.aspectRatio
            ? { width: `${layout.img.widthPct}%`, height: `${layout.img.heightPct}%`, left: `${layout.img.leftPct}%`, top: `${layout.img.topPct}%` }
            : undefined
        }
      />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
        {annotations.map((a, i) =>
          a.kind === "rect" ? (
            <rect key={i} x={a.x} y={a.y} width={a.w} height={a.h} fill={ZONE_COLOURS[a.zone]} fillOpacity={0.25} stroke={ZONE_COLOURS[a.zone]} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          ) : (
            <polygon key={i} points={a.points.map((p) => p.join(",")).join(" ")} fill={ZONE_COLOURS[a.zone]} fillOpacity={0.25} stroke={ZONE_COLOURS[a.zone]} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          ),
        )}
      </svg>
      {annotations.map((a, i) => {
        const [x, y] = a.kind === "rect" ? [a.x, a.y] : [Math.min(...a.points.map((p) => p[0])), Math.min(...a.points.map((p) => p[1]))];
        return (
          <span
            key={`label-${i}`}
            className="pointer-events-none absolute rounded px-1 text-[10px] font-semibold text-white shadow"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, backgroundColor: ZONE_COLOURS[a.zone] }}
            data-testid="zone-label"
          >
            {a.zone}
            {a.label ? ` — ${a.label}` : ""}
          </span>
        );
      })}
      {children}
    </div>
  );
}
