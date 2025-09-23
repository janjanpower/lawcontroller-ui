import React, { useState, useCallback, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Plus, Type, Table, Save, Download } from 'lucide-react';
import type { QuoteCanvasSchema, CanvasBlock, TextBlock, TableBlock } from './schema';
import TextCard from '../TextCard';
import TableCard from '../TableCard';
import { apiFetch, getFirmCodeOrThrow } from '../../../../utils/api';
import type { VariableDef } from './variables';

interface QuoteCanvasProps {
  value: QuoteCanvasSchema;
  onChange: (schema: QuoteCanvasSchema) => void;
  onExport: (schema: QuoteCanvasSchema) => void;
  onSaveTemplate: () => void;
  onRemoveTemplate: () => void;
  caseId: string;
}

export default function QuoteCanvas({
  value,
  onChange,
  onExport,
  onSaveTemplate,
  onRemoveTemplate,
  caseId
}: QuoteCanvasProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [variables, setVariables] = useState<VariableDef[]>([]);
  const [showVariables, setShowVariables] = useState(false);

  // 載入案件變數
  useEffect(() => {
    const loadVariables = async () => {
      try {
        const firmCode = getFirmCodeOrThrow();
        const res = await apiFetch(`/api/cases/${caseId}/variables?firm_code=${firmCode}`);
        if (res.ok) {
          const data = await res.json();
          setVariables(data || []);
        }
      } catch (err) {
        console.error("載入變數失敗", err);
      }
    };

    if (caseId) {
      loadVariables();
    }
  }, [caseId]);

  const addBlock = useCallback((type: 'text' | 'table') => {
    const newBlock: CanvasBlock = {
      id: Date.now().toString(),
      type,
      x: 50,
      y: 50,
      w: type === 'text' ? 300 : 400,
      h: type === 'text' ? 100 : 200,
      z: Math.max(...value.blocks.map(b => b.z || 0), 0) + 1,
      ...(type === 'text' 
        ? { text: '', fontSize: 14, color: '#000000' } as Partial<TextBlock>
        : { rows: [['', '', ''], ['', '', ''], ['', '', '']], showBorders: true } as Partial<TableBlock>
      )
    };

    onChange({
      ...value,
      blocks: [...value.blocks, newBlock]
    });
    setSelectedBlockId(newBlock.id);
  }, [value, onChange]);

  const updateBlock = useCallback((id: string, updates: Partial<CanvasBlock>) => {
    onChange({
      ...value,
      blocks: value.blocks.map(block => 
        block.id === id ? { ...block, ...updates } : block
      )
    });
  }, [value, onChange]);

  const deleteBlock = useCallback((id: string) => {
    onChange({
      ...value,
      blocks: value.blocks.filter(block => block.id !== id)
    });
    if (selectedBlockId === id) {
      setSelectedBlockId(null);
    }
  }, [value, onChange, selectedBlockId]);

  const selectBlock = useCallback((id: string) => {
    setSelectedBlockId(id);
    // 將選中的區塊置於最前
    const maxZ = Math.max(...value.blocks.map(b => b.z || 0), 0);
    updateBlock(id, { z: maxZ + 1 });
  }, [updateBlock, value.blocks]);

  const insertVariable = useCallback((varKey: string) => {
    if (!selectedBlockId) return;
    
    const block = value.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;

    const varTag = `{{${varKey}|color:#ADD8E6}}`;

    if (block.type === 'text') {
      const textBlock = block as TextBlock;
      updateBlock(selectedBlockId, {
        text: (textBlock.text || '') + varTag
      });
    }
  }, [selectedBlockId, value.blocks, updateBlock]);

  return (
    <div className="flex h-full">
      {/* 左側工具面板 */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
        {/* 新增元素 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">新增元素</h3>
          <div className="space-y-2">
            <button
              onClick={() => addBlock('text')}
              className="w-full flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Type className="w-4 h-4" />
              <span>文字區塊</span>
            </button>
            <button
              onClick={() => addBlock('table')}
              className="w-full flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Table className="w-4 h-4" />
              <span>表格</span>
            </button>
          </div>
        </div>

        {/* 變數插入 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">變數標籤</h3>
            <button
              onClick={() => setShowVariables(!showVariables)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {showVariables ? '收起' : '展開'}
            </button>
          </div>
          
          {showVariables && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {variables.map((v) => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  disabled={!selectedBlockId}
                  className="w-full text-left px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="font-mono text-blue-600">
                    {`{{${v.key}}}`}
                  </div>
                  <div className="text-gray-600">
                    {v.label}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 操作按鈕 */}
        <div className="space-y-2">
          <button
            onClick={onSaveTemplate}
            className="w-full flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>儲存模板</span>
          </button>
          <button
            onClick={() => onExport(value)}
            className="w-full flex items-center space-x-2 px-3 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d] transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>匯出 PDF</span>
          </button>
        </div>
      </div>

      {/* 右側畫布 */}
      <div className="flex-1 relative overflow-auto bg-white">
        {/* 網格背景 */}
        {value.showGrid && (
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
              `,
              backgroundSize: `${value.gridSize || 10}px ${value.gridSize || 10}px`
            }}
          />
        )}

        {/* 頁面邊界 */}
        <div
          className="absolute border-2 border-gray-400 bg-white shadow-lg"
          style={{
            left: value.page.margin,
            top: value.page.margin,
            width: value.page.width,
            height: value.page.height
          }}
        >
          {/* 渲染所有區塊 */}
          {value.blocks.map((block) => (
            <Rnd
              key={block.id}
              size={{ width: block.w, height: block.h || 100 }}
              position={{ x: block.x, y: block.y }}
              onDragStop={(e, d) => {
                updateBlock(block.id, { x: d.x, y: d.y });
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                updateBlock(block.id, {
                  w: parseInt(ref.style.width),
                  h: parseInt(ref.style.height),
                  x: position.x,
                  y: position.y
                });
              }}
              onClick={() => selectBlock(block.id)}
              className={`${selectedBlockId === block.id ? 'ring-2 ring-blue-500' : ''}`}
              style={{
                zIndex: selectedBlockId === block.id ? 9999 : (block.z || 0)
              }}
              bounds="parent"
              grid={[value.gridSize || 10, value.gridSize || 10]}
            >
              <div className="w-full h-full border border-gray-300 bg-white rounded shadow-sm overflow-hidden">
                {block.type === 'text' && (
                  <TextCard
                    content={block}
                    onChange={(updates) => updateBlock(block.id, updates)}
                  />
                )}
                {block.type === 'table' && (
                  <TableCard
                    content={block}
                    onChange={(updates) => updateBlock(block.id, updates)}
                  />
                )}
              </div>

              {/* 選中時的工具列 */}
              {selectedBlockId === block.id && (
                <div
                  className="absolute -top-8 left-0 bg-white border border-gray-300 rounded shadow-lg px-2 py-1 flex items-center space-x-1"
                  style={{ zIndex: 10000 }}
                >
                  <span className="text-xs text-gray-600">
                    {block.type === 'text' ? '文字' : '表格'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBlock(block.id);
                    }}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    刪除
                  </button>
                </div>
              )}
            </Rnd>
          ))}
        </div>
      </div>
    </div>
  );
}