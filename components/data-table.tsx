export function DataTable({
  columns,
  rows,
  rowKeys
}: {
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  rowKeys?: string[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead className="bg-field">
          <tr>
            {columns.map((column, index) => (
              <th key={`${column}-${index}`} className="px-4 py-3 text-sm font-black text-ink">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, index) => (
            <tr key={rowKeys?.[index] ?? `row-${index}`} className="hover:bg-field/55">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-sm text-ink/78">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
