export function PrintHeader({
  supplierName,
  title,
  subtitle,
  docNo,
  issueDate,
  revision,
  revisionDate,
}: {
  supplierName: string;
  title: string;
  subtitle: string;
  docNo?: string | null;
  issueDate?: string;
  revision?: string;
  revisionDate?: string;
}) {
  return (
    <table className="w-full border-collapse border border-black text-xs">
      <tbody>
        <tr>
          <td className="w-1/4 border border-black p-2 align-middle font-semibold" rowSpan={2}>
            {supplierName}
          </td>
          <td className="border border-black p-2 text-center font-semibold">{title}</td>
          <td className="w-1/4 border border-black p-2 align-middle" rowSpan={2}>
            {docNo ? <div>Doc. No.: {docNo}</div> : null}
            {issueDate ? <div>Issue Date: {issueDate}</div> : null}
            {revision ? (
              <div>
                Rev. No &amp; Date: {revision}
                {revisionDate ? ` & ${revisionDate}` : ""}
              </div>
            ) : null}
          </td>
        </tr>
        <tr>
          <td className="border border-black p-2 text-center font-semibold">{subtitle}</td>
        </tr>
      </tbody>
    </table>
  );
}
