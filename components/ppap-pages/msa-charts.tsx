"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { averageChartPoints, controlChartConstants, rangeChartPoints, type GrrReadings, type GrrResult } from "@/lib/calc/grr";

const LINE_COLORS = ["#2563eb", "#dc2626", "#16a34a"];

function pivotByPart<T extends { partLabel: string; appraiserIndex: number }>(
  points: T[],
  partLabels: string[],
  appraiserNames: string[],
  valueKey: (p: T) => number,
): Record<string, string | number>[] {
  return partLabels.map((label) => {
    const row: Record<string, string | number> = { part: label };
    points
      .filter((p) => p.partLabel === label)
      .forEach((p) => {
        row[appraiserNames[p.appraiserIndex] ?? `Appraiser ${String.fromCharCode(65 + p.appraiserIndex)}`] = valueKey(p);
      });
    return row;
  });
}

export function MsaCharts({
  readings,
  result,
  partLabels,
  appraiserNames,
  trials,
}: {
  readings: GrrReadings;
  result: GrrResult;
  partLabels: string[];
  appraiserNames: string[];
  trials: number;
}) {
  const names = appraiserNames.map((n, i) => n || `Appraiser ${String.fromCharCode(65 + i)}`);
  const { a2, d4 } = controlChartConstants(trials);

  const avgPoints = averageChartPoints(readings, partLabels);
  const avgData = pivotByPart(avgPoints, partLabels, names, (p) => p.average);
  const grandAverage = result.appraiserGrandAverage.reduce((s, v) => s + v, 0) / result.appraiserGrandAverage.length;
  const avgUcl = grandAverage + a2 * result.rBar;
  const avgLcl = grandAverage - a2 * result.rBar;

  const rangePoints = rangeChartPoints(readings, partLabels);
  const rangeData = pivotByPart(rangePoints, partLabels, names, (p) => p.range);
  const rangeUcl = d4 * result.rBar;

  const biasData = partLabels.map((label, partIndex) => {
    const row: Record<string, string | number> = { part: label };
    for (let a = 0; a < readings.length; a++) {
      const avg = readings[a][partIndex].reduce((s, v) => s + v, 0) / readings[a][partIndex].length;
      row[names[a]] = avg - result.partAverage[partIndex];
    }
    return row;
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-md border p-2">
        <h4 className="mb-1 text-xs font-semibold">Averages by Appraiser</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={avgData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="part" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <ReferenceLine y={avgUcl} stroke="#999" strokeDasharray="4 4" label={{ value: "UCL", fontSize: 10 }} />
            <ReferenceLine y={avgLcl} stroke="#999" strokeDasharray="4 4" label={{ value: "LCL", fontSize: 10 }} />
            {names.map((name, i) => (
              <Line key={name} type="monotone" dataKey={name} stroke={LINE_COLORS[i % LINE_COLORS.length]} dot={{ r: 2 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-md border p-2">
        <h4 className="mb-1 text-xs font-semibold">Range by Appraiser</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={rangeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="part" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} domain={[0, "auto"]} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <ReferenceLine y={rangeUcl} stroke="#999" strokeDasharray="4 4" label={{ value: "UCL", fontSize: 10 }} />
            {names.map((name, i) => (
              <Line key={name} type="monotone" dataKey={name} stroke={LINE_COLORS[i % LINE_COLORS.length]} dot={{ r: 2 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-md border p-2 lg:col-span-2">
        <h4 className="mb-1 text-xs font-semibold">Bias &amp; Consistency (per-appraiser deviation from the part average)</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={biasData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="part" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <ReferenceLine y={0} stroke="#999" />
            {names.map((name, i) => (
              <Line key={name} type="monotone" dataKey={name} stroke={LINE_COLORS[i % LINE_COLORS.length]} dot={{ r: 2 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
