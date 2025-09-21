import React from "react";

interface Row {
  item?: string;
  qty?: number;
  price?: number;
}

export default function TableCard({
  content,
  onChange,
}: {
  content: { rows?: Row[] };
  onChange: (c: any) => void;
}) {
  const rows = content.rows || [];

  const updateRow = (i: number, row: Row) => {
    const newRows = [...rows];
    newRows[i] = row;
    onChange({ ...content, rows: newRows });
  };

  const addRow = () => onChange({ ...content, rows: [...rows, {}] });

  const total = rows.reduce(
    (sum, r) => sum + (Number(r.qty) || 0) * (Number(r.price) || 0),
    0
  );

  return (
    <div>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-1">項目</th>
            <th className="border p-1 w-20">數量</th>
            <th className="border p-1 w-28">單價</th>
            <th className="border p-1 w-28">小計</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="border p-1">
                <input
                  className="w-full"
                  value={r.item || ""}
                  onChange={(e) => updateRow(i, { ...r, item: e.target.value })}
                />
              </td>
              <td className="border p-1">
                <input
                  type="number"
                  className="w-full"
                  value={r.qty || ""}
                  onChange={(e) =>
                    updateRow(i, { ...r, qty: Number(e.target.value) })
                  }
                />
              </td>
              <td className="border p-1">
                <input
                  type="number"
                  className="w-full"
                  value={r.price || ""}
                  onChange={(e) =>
                    updateRow(i, { ...r, price: Number(e.target.value) })
                  }
                />
              </td>
              <td className="border p-1 text-right">
                {(r.qty || 0) * (r.price || 0)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="border p-1 text-right" colSpan={3}>
              總計
            </td>
            <td className="border p-1 text-right">{total}</td>
          </tr>
        </tfoot>
      </table>
      <button
        className="mt-2 px-3 py-1 bg-gray-200 rounded"
        onClick={addRow}
      >
        + 新增列
      </button>
    </div>
  );
}
