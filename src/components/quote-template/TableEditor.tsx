import React, { useState } from 'react';
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  Minus,
  Merge,
  Split,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import type { TableBlock, VariableDef, CellMerge } from '../../types/quote-template';

interface Props {
  block: TableBlock;
  variables: VariableDef[];
  isPreview: boolean;
  isSelected: boolean;
  onUpdate: (updates: Partial<TableBlock>) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

interface CellSelection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export default function TableEditor({
  block,
  variables,
  isPreview,
  isSelected,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown
}: Props) {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [cellSelection, setCellSelection] = useState<CellSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const addRow = () => {
    const newRow = new Array(block.rows[0]?.length || 3).fill('');
    onUpdate({ rows: [...block.rows, newRow] });
  };

  const removeRow = () => {
    if (block.rows.length > 1) {
      onUpdate({ rows: block.rows.slice(0, -1) });
    }
  };

  const addColumn = () => {
    const newRows = block.rows.map(row => [...row, '']);
    const newColMeta = [...(block.colMeta || [])];
    const totalCols = block.rows[0].length + 1;
    const newWidth = 100 / totalCols;

    for (let i = 0; i < totalCols; i++) {
      if (!newColMeta[i]) {
        newColMeta[i] = { width: newWidth, align: 'left' };
      } else {
        newColMeta[i].width = newWidth;
      }
    }

    onUpdate({ rows: newRows, colMeta: newColMeta });
  };

  const removeColumn = () => {
    if (block.rows[0]?.length > 1) {
      const newRows = block.rows.map(row => row.slice(0, -1));
      const newColMeta = block.colMeta?.slice(0, -1);
      onUpdate({ rows: newRows, colMeta: newColMeta });
    }
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = block.rows.map((row, rIdx) =>
      rIdx === rowIndex
        ? row.map((cell, cIdx) => (cIdx === colIndex ? value : cell))
        : row
    );
    onUpdate({ rows: newRows });
  };

  const updateColumnAlign = (colIndex: number, align: 'left' | 'center' | 'right') => {
    const newColMeta = [...(block.colMeta || [])];
    if (!newColMeta[colIndex]) {
      newColMeta[colIndex] = { align };
    } else {
      newColMeta[colIndex] = { ...newColMeta[colIndex], align };
    }
    onUpdate({ colMeta: newColMeta });
  };

  const mergeCells = () => {
    if (!cellSelection) return;

    const { startRow, startCol, endRow, endCol } = cellSelection;

    const mergedValue = block.rows
      .slice(startRow, endRow + 1)
      .map(row => row.slice(startCol, endCol + 1).join(' '))
      .join(' ')
      .trim();

    const newRows = block.rows.map((row, rIdx) =>
      row.map((cell, cIdx) => {
        if (rIdx >= startRow && rIdx <= endRow && cIdx >= startCol && cIdx <= endCol) {
          if (rIdx === startRow && cIdx === startCol) {
            return mergedValue;
          }
          return '';
        }
        return cell;
      })
    );

    const newMerge: CellMerge = {
      r: startRow,
      c: startCol,
      rowspan: endRow - startRow + 1,
      colspan: endCol - startCol + 1
    };

    const newMerges = [...(block.merges || []), newMerge];

    onUpdate({ rows: newRows, merges: newMerges });
    setCellSelection(null);
  };

  const splitCells = () => {
    if (!selectedCell) return;

    const { row, col } = selectedCell;

    const mergeIndex = block.merges?.findIndex(
      m => m.r === row && m.c === col
    );

    if (mergeIndex !== undefined && mergeIndex !== -1) {
      const newMerges = block.merges?.filter((_, idx) => idx !== mergeIndex);
      onUpdate({ merges: newMerges });
    }
  };

  const getCellMerge = (row: number, col: number): CellMerge | null => {
    return block.merges?.find(m => m.r === row && m.c === col) || null;
  };

  const isCellMerged = (row: number, col: number): boolean => {
    return !!block.merges?.some(m => {
      return (
        row > m.r &&
        row < m.r + m.rowspan &&
        col >= m.c &&
        col < m.c + m.colspan
      ) || (
        row >= m.r &&
        row < m.r + m.rowspan &&
        col > m.c &&
        col < m.c + m.colspan
      );
    });
  };

  const handleMouseDown = (row: number, col: number) => {
    if (isPreview) return;
    setIsSelecting(true);
    setSelectedCell({ row, col });
    setCellSelection({ startRow: row, startCol: col, endRow: row, endCol: col });
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (!isSelecting || !cellSelection) return;

    setCellSelection({
      startRow: Math.min(cellSelection.startRow, row),
      startCol: Math.min(cellSelection.startCol, col),
      endRow: Math.max(cellSelection.startRow, row),
      endCol: Math.max(cellSelection.startCol, col)
    });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const isCellInSelection = (row: number, col: number): boolean => {
    if (!cellSelection) return false;
    return (
      row >= cellSelection.startRow &&
      row <= cellSelection.endRow &&
      col >= cellSelection.startCol &&
      col <= cellSelection.endCol
    );
  };

  const renderCellContent = (content: string, preview: boolean): string => {
    if (!preview) return content;

    let rendered = content;
    variables.forEach(v => {
      const regex = new RegExp(`\\{\\{${v.key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, v.label);
    });
    return rendered;
  };

  return (
    <div className="relative group" onMouseUp={handleMouseUp}>
      {isSelected && !isPreview && (
        <div className="absolute -right-12 top-0 flex flex-col gap-1 z-10">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              className="p-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              title="上移"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              className="p-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              title="下移"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1 bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {isSelected && !isPreview && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-1">
            <button
              onClick={addRow}
              className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-xs"
            >
              <Plus className="w-3 h-3" />
              列
            </button>
            <button
              onClick={removeRow}
              className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-xs"
              disabled={block.rows.length <= 1}
            >
              <Minus className="w-3 h-3" />
              列
            </button>
          </div>

          <div className="w-px h-6 bg-gray-300" />

          <div className="flex items-center gap-1">
            <button
              onClick={addColumn}
              className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-xs"
            >
              <Plus className="w-3 h-3" />
              欄
            </button>
            <button
              onClick={removeColumn}
              className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-xs"
              disabled={block.rows[0]?.length <= 1}
            >
              <Minus className="w-3 h-3" />
              欄
            </button>
          </div>

          {cellSelection && (
            <>
              <div className="w-px h-6 bg-gray-300" />
              <button
                onClick={mergeCells}
                className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-xs"
              >
                <Merge className="w-3 h-3" />
                合併
              </button>
            </>
          )}

          {selectedCell && getCellMerge(selectedCell.row, selectedCell.col) && (
            <button
              onClick={splitCells}
              className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors text-xs"
            >
              <Split className="w-3 h-3" />
              拆分
            </button>
          )}

          {selectedCell !== null && (
            <>
              <div className="w-px h-6 bg-gray-300" />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateColumnAlign(selectedCell.col, 'left')}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="靠左"
                >
                  <AlignLeft className="w-3 h-3" />
                </button>
                <button
                  onClick={() => updateColumnAlign(selectedCell.col, 'center')}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="置中"
                >
                  <AlignCenter className="w-3 h-3" />
                </button>
                <button
                  onClick={() => updateColumnAlign(selectedCell.col, 'right')}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="靠右"
                >
                  <AlignRight className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <table className="w-full border-collapse border border-gray-300">
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => {
                if (isCellMerged(rowIndex, colIndex)) {
                  return null;
                }

                const merge = getCellMerge(rowIndex, colIndex);
                const colMeta = block.colMeta?.[colIndex];
                const isInSelection = isCellInSelection(rowIndex, colIndex);

                return (
                  <td
                    key={colIndex}
                    rowSpan={merge?.rowspan || 1}
                    colSpan={merge?.colspan || 1}
                    className={`border border-gray-300 p-2 ${
                      isInSelection && !isPreview ? 'bg-blue-100' : ''
                    } ${!isPreview ? 'cursor-pointer' : ''}`}
                    style={{
                      width: colMeta?.width ? `${colMeta.width}%` : 'auto',
                      textAlign: colMeta?.align || 'left',
                      minWidth: '60px',
                      minHeight: '30px'
                    }}
                    onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                    onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                  >
                    <div
                      contentEditable={!isPreview}
                      suppressContentEditableWarning
                      onInput={(e) => updateCell(rowIndex, colIndex, e.currentTarget.textContent || '')}
                      dangerouslySetInnerHTML={{
                        __html: renderCellContent(cell, isPreview)
                      }}
                      className="outline-none min-h-[20px]"
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word'
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
