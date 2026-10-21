"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SpcStudyResults } from "@/lib/actions/spc";

export function SpcCharts({
  subgroupSize,
  subgroupCount,
  usl,
  lsl,
  results,
}: {
  subgroupSize: number;
  subgroupCount: number;
  usl: number;
  lsl: number;
  results: SpcStudyResults & { complete: true };
}) {
  const subgroups: number[][] = Array.from({ length: subgroupCount }, (_, s) =>
    results.individuals.slice(s * subgroupSize, s * subgroupSize + subgroupSize),
  );
  const xBarData = subgroups.map((sg, i) => ({
    label: `${i + 1}`,
    mean: sg.reduce((a, b) => a + b, 0) / sg.length,
  }));
  const rData = subgroups.map((sg, i) => ({
    label: `${i + 1}`,
    range: Math.max(...sg) - Math.min(...sg),
  }));
  const individualsData = results.individuals.map((v, i) => ({ label: `${i + 1}`, value: v }));
  const histogramData = results.histogram.map((c) => ({
    label: `${c.from.toFixed(3)}–${c.to.toFixed(3)}`,
    frequency: c.frequency,
    outOfSpec: c.to <= lsl || c.from >= usl,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-md border p-2">
        <h4 className="mb-1 text-xs font-semibold">X̄ Chart</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={xBarData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} label={{ value: "Subgroup", fontSize: 10, position: "insideBottom", offset: -2 }} />
            <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip />
            <ReferenceLine y={results.xBarBar} stroke="#2563eb" label={{ value: "X̄̄", fontSize: 10 }} />
            <ReferenceLine y={results.xBarUcl} stroke="#999" strokeDasharray="4 4" label={{ value: "UCL", fontSize: 10 }} />
            <ReferenceLine y={results.xBarLcl} stroke="#999" strokeDasharray="4 4" label={{ value: "LCL", fontSize: 10 }} />
            <Line type="monotone" dataKey="mean" stroke="#16a34a" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-md border p-2">
        <h4 className="mb-1 text-xs font-semibold">R Chart</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={rData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} label={{ value: "Subgroup", fontSize: 10, position: "insideBottom", offset: -2 }} />
            <YAxis tick={{ fontSize: 10 }} domain={[0, "auto"]} />
            <Tooltip />
            <ReferenceLine y={results.rBar} stroke="#2563eb" label={{ value: "R̄", fontSize: 10 }} />
            <ReferenceLine y={results.rUcl} stroke="#999" strokeDasharray="4 4" label={{ value: "UCL", fontSize: 10 }} />
            {results.rLcl > 0 ? <ReferenceLine y={results.rLcl} stroke="#999" strokeDasharray="4 4" label={{ value: "LCL", fontSize: 10 }} /> : null}
            <Line type="monotone" dataKey="range" stroke="#dc2626" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-md border p-2">
        <h4 className="mb-1 text-xs font-semibold">Histogram</h4>
        <p className="mb-1 text-[10px] text-muted-foreground">USL = {usl}, LSL = {lsl} — a red bar would fall outside spec.</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={histogramData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="frequency">
              {histogramData.map((d, i) => (
                <Cell key={i} fill={d.outOfSpec ? "#dc2626" : "#2563eb"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-md border p-2">
        <h4 className="mb-1 text-xs font-semibold">Individuals Run Chart</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={individualsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} label={{ value: "Reading #", fontSize: 10, position: "insideBottom", offset: -2 }} />
            <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip />
            <ReferenceLine y={usl} stroke="#dc2626" label={{ value: "USL", fontSize: 10 }} />
            <ReferenceLine y={results.xBarUcl} stroke="#999" strokeDasharray="4 4" label={{ value: "UCL", fontSize: 10 }} />
            <ReferenceLine y={results.xBarBar} stroke="#2563eb" label={{ value: "Mean", fontSize: 10 }} />
            <ReferenceLine y={results.xBarLcl} stroke="#999" strokeDasharray="4 4" label={{ value: "LCL", fontSize: 10 }} />
            <ReferenceLine y={lsl} stroke="#dc2626" label={{ value: "LSL", fontSize: 10 }} />
            <Line type="monotone" dataKey="value" stroke="#16a34a" dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
