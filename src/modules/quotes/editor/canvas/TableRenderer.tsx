import React, { useRef } from "react";
import { CanvasBlock, TableBlock } from "./schema";
import { renderString } from "../../../../utils/templateEngine";
import VariableAwareInput from "./VariableAwareInput";

interface Props {
  tableBlock: TableBlock;
  previewMode: boolean;
  selectedCellId: string | null;
  selectedCells: string[];
  caseContext: any;
  onUpdate: (patch: Partial<CanvasBlock>) => void;
  onCellSelect: (cellId: string, isMultiSelect?: boolean) => void;
  mergedCells: any[];
  variableColors?: Record<string, string>;
}

export default function TableRenderer({
  tableBlock,
  previewMode,
  selectedCellId,
  selectedCells,
  caseContext,
  onUpdate,
  onCellSelect,
  mergedCells,
  variableColors = {},
}: Props) {
  const tableRef = useRef<HTMLTableElement>(null);

  const isCellMerged = (rowIndex: number, colIndex: number) => {
    return mergedCells.some(
      (merge) =>
        rowIndex >= merge.startRow &&
        rowIndex <= merge.endRow &&
        colIndex >= merge.startCol &&
        colIndex <= merge.endCol &&
        !(rowIndex === merge.startRow && colIndex === merge.startCol)
    );
  };

  const getCellSpan = (rowIndex: number, colIndex: number) => {
    const merge = mergedCells.find(
      (m) => m.startRow === rowIndex && m.startCol === colIndex
    );
    return merge
      ? {
          rowSpan: merge.endRow - merge.startRow + 1,
          colSpan: merge.endCol - merge.startCol + 1,
        }
      : { rowSpan: 1, colSpan: 1 };
  };

  return (
    <table
      ref={tableRef}
      className="w-full h-full text-xs relative"
      style={{
        borderCollapse: "collapse",
        border: tableBlock.showBorders !== false ? "1px solid #d1d5db" : "none",
      }}
    >
      <thead>
        <tr>
          {tableBlock.headers.map((header, i) => (
            <th
              key={i}
              className={`${
                tableBlock.showBorders !== false
                  ? "border border-gray-300"
                  : ""
              } p-1 relative`}
              style={{
                fontWeight: tableBlock.headerStyle?.bold ? "bold" : "normal",
                backgroundColor:
                  tableBlock.headerStyle?.backgroundColor || "#f3f4f6",
                textAlign: tableBlock.headerStyle?.textAlign || "left",
                minWidth: "60px",
              }}
            >
              {previewMode ? (
                renderString(header, caseContext)
              ) : (
                <VariableAwareInput
                  value={header}
                  onChange={(newValue) => {
                    const newHeaders = [...tableBlock.headers];
                    newHeaders[i] = newValue;
                    onUpdate({ headers: newHeaders });
                  }}
                  className="w-full bg-transparent text-center font-semibold border-none outline-none"
                  placeholder={`欄位 ${i + 1}`}
                  variableColors={variableColors}
                />
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tableBlock.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, colIndex) => {
              if (isCellMerged(rowIndex, colIndex)) {
                return null;
              }

              const span = getCellSpan(rowIndex, colIndex);
              const cellId = `${rowIndex}-${colIndex}`;
              const isSelected = selectedCells.includes(cellId);

              return (
                <td
                  key={colIndex}
                  className={`${
                    tableBlock.showBorders !== false
                      ? "border border-gray-300"
                      : ""
                  } p-1 ${isSelected ? "bg-blue-100" : ""}`}
                  style={{
                    textAlign: tableBlock.cellStyle?.textAlign || "left",
                    padding: tableBlock.cellStyle?.padding || 4,
                  }}
                  rowSpan={span.rowSpan}
                  colSpan={span.colSpan}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!previewMode) {
                      const isMultiSelect = e.ctrlKey || e.metaKey;
                      onCellSelect(cellId, isMultiSelect);
                    }
                  }}
                >
                  {previewMode ? (
                    renderString(cell, caseContext)
                  ) : (
                    <VariableAwareInput
                      value={cell}
                      onChange={(newValue) => {
                        const newRows = [...tableBlock.rows];
                        newRows[rowIndex][colIndex] = newValue;
                        onUpdate({ rows: newRows });
                      }}
                      className="w-full bg-transparent text-center border-none outline-none"
                      placeholder=""
                      onFocus={() => onCellSelect(cellId)}
                      variableColors={variableColors}
                    />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
