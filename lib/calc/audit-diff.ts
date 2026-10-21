/**
 * Field-level before/after diff for the audit-log viewer. Timestamps that
 * change on every write (updatedAt) are ignored; nested objects/arrays are
 * compared by their JSON.
 */

export type FieldChange = { field: string; before: string; after: string };

const IGNORED = new Set(["updatedAt", "createdAt"]);

function show(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

export function auditDiff(before: unknown, after: unknown): FieldChange[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const fields = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((f) => !IGNORED.has(f));
  const changes: FieldChange[] = [];
  for (const f of fields) {
    if (JSON.stringify(b[f] ?? null) !== JSON.stringify(a[f] ?? null)) changes.push({ field: f, before: show(b[f]), after: show(a[f]) });
  }
  return changes;
}
