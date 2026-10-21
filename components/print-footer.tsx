import { formatDateIndia } from "@/lib/format";

export function PrintFooter({
  entries,
}: {
  entries: { label: string; name: string | null; date: Date | null }[];
}) {
  return (
    <table className="mt-4 w-full border-collapse border border-black text-xs">
      <tbody>
        <tr>
          {entries.map((e) => (
            <td key={e.label} className="border border-black p-2 align-top">
              <div className="font-semibold">{e.label}:</div>
              <div>{e.name ?? "—"}</div>
              <div>{e.date ? formatDateIndia(e.date) : ""}</div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
