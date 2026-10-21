"use client";

import { useState } from "react";

type Operation = { id: string; name: string; symbol: string };
type RouteStep = { id: string; sequence: number; operation: Operation };
type ChildPart = {
  id: string;
  itemNo: number;
  partNo: string;
  description: string;
  side: "LEFT" | "RIGHT";
  sketchImageUrl: string | null;
  parentChildPartId: string | null;
  route: { steps: RouteStep[] } | null;
};

const ROW_HEIGHT = 64;
const STEP_WIDTH = 88;
const LABEL_WIDTH = 190;
const SKETCH_SIZE = 40;
const SYMBOL_SIZE = 16;

function Symbol({ symbol, cx, cy }: { symbol: string; cx: number; cy: number }) {
  const r = SYMBOL_SIZE / 2;
  switch (symbol) {
    case "INSPECTION":
      return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill="white" stroke="currentColor" />;
    case "STORAGE":
      return (
        <polygon
          points={`${cx - r},${cy - r} ${cx + r},${cy - r} ${cx},${cy + r}`}
          fill="white"
          stroke="currentColor"
        />
      );
    case "TRANSPORT":
      return <path d={`M ${cx - r} ${cy} L ${cx + r} ${cy} M ${cx + r - 5} ${cy - 5} L ${cx + r} ${cy} L ${cx + r - 5} ${cy + 5}`} stroke="currentColor" fill="none" strokeWidth={1.5} />;
    case "DELAY":
      return <path d={`M ${cx - r} ${cy - r} h ${r} a ${r} ${r} 0 0 1 0 ${r * 2} h -${r} Z`} fill="white" stroke="currentColor" />;
    default: // OPERATION
      return <circle cx={cx} cy={cy} r={r} fill="white" stroke="currentColor" />;
  }
}

function RouteChain({ steps, x, y, direction }: { steps: RouteStep[]; x: number; y: number; direction: 1 | -1 }) {
  return (
    <g>
      {steps.map((step, i) => {
        const cx = x + direction * (i * STEP_WIDTH + STEP_WIDTH / 2);
        return (
          <g key={step.id}>
            {i > 0 ? (
              <line
                x1={cx - direction * STEP_WIDTH}
                y1={y}
                x2={cx - direction * (SYMBOL_SIZE / 2 + 2)}
                y2={y}
                stroke="currentColor"
                strokeWidth={1}
              />
            ) : null}
            <Symbol symbol={step.operation.symbol} cx={cx} cy={y} />
            <text x={cx} y={y + SYMBOL_SIZE} fontSize={8} textAnchor="middle" className="fill-current">
              {step.operation.name.length > 14 ? `${step.operation.name.slice(0, 13)}…` : step.operation.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function PfcFlowChart({
  childParts,
  mainRoute,
}: {
  childParts: ChildPart[];
  mainRoute: { steps: RouteStep[] } | null;
}) {
  const [zoom, setZoom] = useState(1);

  const left = childParts.filter((c) => c.side === "LEFT");
  const right = childParts.filter((c) => c.side === "RIGHT");
  const maxRows = Math.max(left.length, right.length, 1);
  const maxSteps = Math.max(1, ...childParts.map((c) => c.route?.steps.length ?? 0));

  const laneWidth = LABEL_WIDTH + SKETCH_SIZE + maxSteps * STEP_WIDTH + 20;
  const width = laneWidth * 2 + 40;
  const rowsHeight = maxRows * ROW_HEIGHT + 20;
  const mainSteps = mainRoute?.steps ?? [];
  const mainHeight = mainSteps.length > 0 ? ROW_HEIGHT + 60 : 0;
  const height = rowsHeight + mainHeight + 20;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Zoom</span>
        {[0.75, 1, 1.5, 2].map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => setZoom(z)}
            className={`rounded-md border px-2 py-1 text-xs ${zoom === z ? "bg-foreground text-background" : ""}`}
          >
            {Math.round(z * 100)}%
          </button>
        ))}
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-md border bg-background">
        <svg
          width={width * zoom}
          height={height * zoom}
          viewBox={`0 0 ${width} ${height}`}
          className="text-foreground"
        >
          {left.map((cp, i) => {
            const y = 20 + i * ROW_HEIGHT + ROW_HEIGHT / 2;
            return (
              <g key={cp.id}>
                {cp.sketchImageUrl ? (
                  <image href={cp.sketchImageUrl} x={0} y={y - SKETCH_SIZE / 2} width={SKETCH_SIZE} height={SKETCH_SIZE} />
                ) : null}
                <text x={SKETCH_SIZE + 4} y={y - 4} fontSize={9} className="fill-current">
                  {cp.itemNo}. {cp.partNo}
                </text>
                <text x={SKETCH_SIZE + 4} y={y + 7} fontSize={8} className="fill-current opacity-70">
                  {cp.description.length > 22 ? `${cp.description.slice(0, 21)}…` : cp.description}
                </text>
                <RouteChain steps={cp.route?.steps ?? []} x={SKETCH_SIZE + LABEL_WIDTH} y={y} direction={1} />
              </g>
            );
          })}

          {right.map((cp, i) => {
            const y = 20 + i * ROW_HEIGHT + ROW_HEIGHT / 2;
            const rightEdge = width;
            return (
              <g key={cp.id}>
                {cp.sketchImageUrl ? (
                  <image
                    href={cp.sketchImageUrl}
                    x={rightEdge - SKETCH_SIZE}
                    y={y - SKETCH_SIZE / 2}
                    width={SKETCH_SIZE}
                    height={SKETCH_SIZE}
                  />
                ) : null}
                <text x={rightEdge - SKETCH_SIZE - 4} y={y - 4} fontSize={9} textAnchor="end" className="fill-current">
                  {cp.itemNo}. {cp.partNo}
                </text>
                <text x={rightEdge - SKETCH_SIZE - 4} y={y + 7} fontSize={8} textAnchor="end" className="fill-current opacity-70">
                  {cp.description.length > 22 ? `${cp.description.slice(0, 21)}…` : cp.description}
                </text>
                <RouteChain steps={cp.route?.steps ?? []} x={rightEdge - SKETCH_SIZE - LABEL_WIDTH} y={y} direction={-1} />
              </g>
            );
          })}

          {mainSteps.length > 0 ? (
            <g>
              <line x1={0} y1={rowsHeight + 10} x2={width} y2={rowsHeight + 10} stroke="currentColor" strokeDasharray="4 2" opacity={0.4} />
              <text x={width / 2} y={rowsHeight + 28} fontSize={11} fontWeight={600} textAnchor="middle" className="fill-current">
                Main Assembly
              </text>
              <RouteChain steps={mainSteps} x={40} y={rowsHeight + 60} direction={1} />
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
}
