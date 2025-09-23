import React from "react";
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Palette, Merge, Split, Ungroup } from "lucide-react";
import VariableAwareInput from "../../../components/VariableAwareInput";

interface Row {
  item?: string;
  qty?: number;
  price?: number;
}

interface CellSelection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export default function TableCard({
  content,
  onChange,
}: {
  content: { 
    rows?: string[][];
    mergedCells?: Array<{
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
    }>;
    cellStyle?: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      color?: string;
      backgroundColor?: string;
      textAlign?: "left" | "center" | "right";
      fontSize?: number;
    };
  };
  onChange: (c: any) => void;
}) {
  const [selectedCells, setSelectedCells] = React.useState<CellSelection | null>(null);
  const [cellStyle, setCellStyle] = React.useState(content.cellStyle || {});
  
  const rows = content.rows || [['', '', ''], ['', '', ''], ['', '', '']]; // 預設3x3表格
  const mergedCells = content.mergedCells || [];

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...rows];
    if (!newRows[rowIndex]) {
      newRows[rowIndex] = [];
    }
    newRows[rowIndex][colIndex] = value;
    onChange({ ...content, rows: newRows });
  };

  const addRow = () => {
    const newRows = [...rows];
    const colCount = Math.max(...rows.map(row => row.length), 3);
    newRows.push(new Array(colCount).fill(''));
    onChange({ ...content, rows: newRows });
  };

  const addColumn = () => {
    const newRows = rows.map(row => [...row, '']);
    onChange({ ...content, rows: newRows });
  };

  const mergeCells = () => {
    if (!selectedCells) return;
    
    const newMergedCells = [...mergedCells];
    
    // 檢查是否與現有合併區域重疊，如果是則擴展
    const overlapping = newMergedCells.findIndex(merged => 
      !(selectedCells.endRow < merged.startRow || 
        selectedCells.startRow > merged.endRow ||
        selectedCells.endCol < merged.startCol || 
        selectedCells.startCol > merged.endCol)
    );
    
    if (overlapping !== -1) {
      // 擴展現有合併區域
      const existing = newMergedCells[overlapping];
      newMergedCells[overlapping] = {
        startRow: Math.min(existing.startRow, selectedCells.startRow),
        startCol: Math.min(existing.startCol, selectedCells.startCol),
        endRow: Math.max(existing.endRow, selectedCells.endRow),
        endCol: Math.max(existing.endCol, selectedCells.endCol)
      };
    } else {
      // 新增合併區域
      newMergedCells.push(selectedCells);
    }
    
    onChange({ ...content, mergedCells: newMergedCells });
  };

  const splitAllMerges = () => {
    onChange({ ...content, mergedCells: [] });
  };

  const splitSelectedMerge = () => {
    if (!selectedCells) return;
    
    const newMergedCells = mergedCells.filter(merged => 
      !(selectedCells.startRow >= merged.startRow && 
        selectedCells.endRow <= merged.endRow &&
        selectedCells.startCol >= merged.startCol && 
        selectedCells.endCol <= merged.endCol)
    );
    
    onChange({ ...content, mergedCells: newMergedCells });
  };

  const updateCellStyle = (styleUpdate: Partial<typeof cellStyle>) => {
    const newStyle = { ...cellStyle, ...styleUpdate };
    setCellStyle(newStyle);
    onChange({ ...content, cellStyle: newStyle });
  };

  const isCellMerged = (rowIndex: number, colIndex: number) => {
    return mergedCells.some(merged => 
      rowIndex >= merged.startRow && rowIndex <= merged.endRow &&
      colIndex >= merged.startCol && colIndex <= merged.endCol &&
      !(rowIndex === merged.startRow && colIndex === merged.startCol)
    );
  };

  const getMergedCellSpan = (rowIndex: number, colIndex: number) => {
    const merged = mergedCells.find(m => 
      rowIndex === m.startRow && colIndex === m.startCol
    );
    
    if (merged) {
      return {
        rowSpan: merged.endRow - merged.startRow + 1,
        colSpan: merged.endCol - merged.startCol + 1
      };
    }
    
    return { rowSpan: 1, colSpan: 1 };
  };

  return (
    <div>
      {/* 工具列 */}
      <div className="flex items-center space-x-2 mb-2 p-2 bg-gray-50 rounded border">
        {/* 文字格式工具 */}
        <div className="flex items-center space-x-1 border-r pr-2">
          <button
            onClick={() => updateCellStyle({ bold: !cellStyle.bold })}
            className={`p-1 rounded ${cellStyle.bold ? 'bg-blue-200' : 'hover:bg-gray-200'}`}
            title="粗體"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => updateCellStyle({ italic: !cellStyle.italic })}
            className={`p-1 rounded ${cellStyle.italic ? 'bg-blue-200' : 'hover:bg-gray-200'}`}
            title="斜體"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => updateCellStyle({ underline: !cellStyle.underline })}
            className={`p-1 rounded ${cellStyle.underline ? 'bg-blue-200' : 'hover:bg-gray-200'}`}
            title="底線"
          >
            <Underline className="w-4 h-4" />
          </button>
        </div>

        {/* 對齊工具 */}
        <div className="flex items-center space-x-1 border-r pr-2">
          <button
            onClick={() => updateCellStyle({ textAlign: 'left' })}
            className={`p-1 rounded ${cellStyle.textAlign === 'left' ? 'bg-blue-200' : 'hover:bg-gray-200'}`}
            title="靠左對齊"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => updateCellStyle({ textAlign: 'center' })}
            className={`p-1 rounded ${cellStyle.textAlign === 'center' ? 'bg-blue-200' : 'hover:bg-gray-200'}`}
            title="置中對齊"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            onClick={() => updateCellStyle({ textAlign: 'right' })}
            className={`p-1 rounded ${cellStyle.textAlign === 'right' ? 'bg-blue-200' : 'hover:bg-gray-200'}`}
            title="靠右對齊"
          >
            <AlignRight className="w-4 h-4" />
          </button>
        </div>

        {/* 顏色工具 */}
        <div className="flex items-center space-x-1 border-r pr-2">
          <input
            type="color"
            value={cellStyle.color || '#000000'}
            onChange={(e) => updateCellStyle({ color: e.target.value })}
            className="w-6 h-6 rounded border"
            title="文字顏色"
          />
          <input
            type="color"
            value={cellStyle.backgroundColor || '#ffffff'}
            onChange={(e) => updateCellStyle({ backgroundColor: e.target.value })}
            className="w-6 h-6 rounded border"
            title="背景顏色"
          />
        </div>

        {/* 合併儲存格工具 */}
        <div className="flex items-center space-x-1">
          <button
            onClick={mergeCells}
            disabled={!selectedCells}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
            title="合併儲存格"
          >
            <Merge className="w-4 h-4" />
          </button>
          <button
            onClick={splitAllMerges}
            className="p-1 rounded hover:bg-gray-200"
            title="拆分所有合併"
          >
            <Split className="w-4 h-4" />
          </button>
          <button
            onClick={splitSelectedMerge}
            disabled={!selectedCells}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
            title="拆分選中合併"
          >
            <Ungroup className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 表格 */}
      <table className="w-full border">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => {
                if (isCellMerged(rowIndex, colIndex)) {
                  return null; // 被合併的儲存格不渲染
                }
                
                const span = getMergedCellSpan(rowIndex, colIndex);
                
                return (
                  <td
                    key={colIndex}
                    className="border p-1 relative"
                    rowSpan={span.rowSpan}
                    colSpan={span.colSpan}
                    onClick={() => setSelectedCells({
                      startRow: rowIndex,
                      startCol: colIndex,
                      endRow: rowIndex,
                      endCol: colIndex
                    })}
                    style={{
                      backgroundColor: selectedCells?.startRow === rowIndex && selectedCells?.startCol === colIndex 
                        ? '#e3f2fd' : 'transparent',
                      fontWeight: cellStyle.bold ? 'bold' : 'normal',
                      fontStyle: cellStyle.italic ? 'italic' : 'normal',
                      textDecoration: cellStyle.underline ? 'underline' : 'none',
                      color: cellStyle.color,
                      textAlign: cellStyle.textAlign || 'left'
                    }}
                  >
                    <VariableAwareInput
                      value={cell || ""}
                      onChange={(value) => updateCell(rowIndex, colIndex, value)}
                      className="w-full border-none outline-none bg-transparent"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* 新增行列按鈕 */}
      <div className="mt-2 flex space-x-2">
        <button
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          onClick={addRow}
        >
          + 新增列
        </button>
        <button
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          onClick={addColumn}
        >
          + 新增欄
        </button>
      </div>
    </div>
  );
}