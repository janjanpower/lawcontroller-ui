import React, { useState, useEffect } from 'react';
import { X, FileText, Eye, Download, Search, Plus, Type, Table as TableIcon } from 'lucide-react';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';
import type {
  QuoteTemplateSchema,
  Block,
  ParagraphBlock,
  TableBlock,
  VariableDef,
  VariableUsage
} from '../types/quote-template';
import VariablePanel from './quote-template/VariablePanel';
import ParagraphEditor from './quote-template/ParagraphEditor';
import TableEditor from './quote-template/TableEditor';
import FormattingToolbar from './quote-template/FormattingToolbar';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
}

export default function QuoteTemplateDialog({ isOpen, onClose, caseId }: Props) {
  const [schema, setSchema] = useState<QuoteTemplateSchema>({
    version: 1,
    blocks: []
  });
  const [variables, setVariables] = useState<VariableDef[]>([]);
  const [variableUsage, setVariableUsage] = useState<Map<string, number>>(new Map());
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadVariables();
    }
  }, [isOpen, caseId]);

  const loadVariables = async () => {
    try {
      const firmCode = getFirmCodeOrThrow();
      const res = await apiFetch(`/api/quotes/vars?case_id=${caseId}&firm_code=${firmCode}`);
      if (res.ok) {
        const data = await res.json();
        setVariables(data || []);
      }
    } catch (error) {
      console.error('載入變數失敗:', error);
    }
  };

  const countVariableUsage = () => {
    const usage = new Map<string, number>();

    schema.blocks.forEach(block => {
      if (block.type === 'paragraph') {
        block.inlines.forEach(inline => {
          if (inline.type === 'var') {
            const current = usage.get(inline.key) || 0;
            usage.set(inline.key, current + 1);
          }
        });
      } else if (block.type === 'table') {
        block.rows.forEach(row => {
          row.forEach(cell => {
            const matches = cell.match(/\{\{(\w+)\}\}/g) || [];
            matches.forEach(match => {
              const key = match.replace(/\{\{|\}\}/g, '');
              const current = usage.get(key) || 0;
              usage.set(key, current + 1);
            });
          });
        });
      }
    });

    setVariableUsage(usage);
  };

  useEffect(() => {
    countVariableUsage();
  }, [schema]);

  const canInsertVariable = (varKey: string): boolean => {
    const variable = variables.find(v => v.key === varKey);
    if (!variable || !variable.maxUsage) return true;

    const currentUsage = variableUsage.get(varKey) || 0;
    return currentUsage < variable.maxUsage;
  };

  const addParagraphBlock = () => {
    const newBlock: ParagraphBlock = {
      id: `para-${Date.now()}`,
      type: 'paragraph',
      inlines: [{ type: 'text', html: '請輸入內容...' }],
      align: 'left'
    };
    setSchema(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock]
    }));
    setSelectedBlockId(newBlock.id);
  };

  const addTableBlock = () => {
    const newBlock: TableBlock = {
      id: `table-${Date.now()}`,
      type: 'table',
      rows: [
        ['欄位1', '欄位2', '欄位3'],
        ['', '', ''],
        ['', '', '']
      ],
      colMeta: [
        { width: 33.33, align: 'left' },
        { width: 33.33, align: 'left' },
        { width: 33.34, align: 'left' }
      ]
    };
    setSchema(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock]
    }));
    setSelectedBlockId(newBlock.id);
  };

  const updateBlock = (blockId: string, updates: Partial<Block>) => {
    setSchema(prev => ({
      ...prev,
      blocks: prev.blocks.map(block =>
        block.id === blockId ? { ...block, ...updates } : block
      )
    }));
  };

  const deleteBlock = (blockId: string) => {
    setSchema(prev => ({
      ...prev,
      blocks: prev.blocks.filter(block => block.id !== blockId)
    }));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    setSchema(prev => {
      const blocks = [...prev.blocks];
      const index = blocks.findIndex(b => b.id === blockId);
      if (index === -1) return prev;

      if (direction === 'up' && index > 0) {
        [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
      } else if (direction === 'down' && index < blocks.length - 1) {
        [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
      }

      return { ...prev, blocks };
    });
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const firmCode = getFirmCodeOrThrow();

      const res = await apiFetch(`/api/quotes/render-pdf?firm_code=${firmCode}`, {
        method: 'POST',
        body: JSON.stringify({
          case_id: caseId,
          schema_json: schema
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.detail || '匯出失敗');
        return;
      }

      const blob = await res.blob();
      if (blob.type !== 'application/pdf') {
        const text = await blob.text();
        alert('匯出失敗：' + text);
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `報價單_${caseId}_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);

      alert('匯出成功');
    } catch (error: any) {
      alert('匯出失敗：' + (error.message || '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    setIsPreview(!isPreview);
  };

  const selectedBlock = schema.blocks.find(b => b.id === selectedBlockId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#334d6d] to-[#3f5a7d] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            報價單模板編輯器
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-all p-2 hover:bg-white/10 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <VariablePanel
            variables={variables}
            variableUsage={variableUsage}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onInsertVariable={(varKey) => {
              if (!canInsertVariable(varKey)) {
                alert('此變數已達使用上限');
                return;
              }
              if (selectedBlockId && selectedBlock?.type === 'paragraph') {
                const variable = variables.find(v => v.key === varKey);
                if (!variable) return;

                const block = selectedBlock as ParagraphBlock;
                updateBlock(selectedBlockId, {
                  inlines: [
                    ...block.inlines,
                    { type: 'var', key: varKey, label: variable.label }
                  ]
                });
              }
            }}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-gray-200 p-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={addParagraphBlock}
                    className="flex items-center gap-2 px-3 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d] transition-colors text-sm"
                  >
                    <Type className="w-4 h-4" />
                    新增段落
                  </button>
                  <button
                    onClick={addTableBlock}
                    className="flex items-center gap-2 px-3 py-2 bg-[#3498db] text-white rounded-md hover:bg-[#2980b9] transition-colors text-sm"
                  >
                    <TableIcon className="w-4 h-4" />
                    新增表格
                  </button>
                </div>

                {selectedBlock && selectedBlock.type === 'paragraph' && (
                  <FormattingToolbar
                    block={selectedBlock}
                    onUpdate={(updates) => updateBlock(selectedBlockId!, updates)}
                  />
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreview}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm ${
                      isPreview
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    {isPreview ? '編輯' : '預覽'}
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d] transition-colors text-sm disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {loading ? '匯出中...' : '匯出 PDF'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 p-8">
              <div className="max-w-[210mm] mx-auto bg-white shadow-lg p-[20mm] min-h-[297mm]">
                {schema.blocks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <FileText className="w-16 h-16 mb-4" />
                    <p className="text-lg">點擊上方按鈕開始建立報價單</p>
                  </div>
                ) : (
                  schema.blocks.map((block, index) => (
                    <div
                      key={block.id}
                      className={`mb-4 ${
                        selectedBlockId === block.id && !isPreview
                          ? 'ring-2 ring-[#3498db] rounded-lg'
                          : ''
                      }`}
                      onClick={() => !isPreview && setSelectedBlockId(block.id)}
                    >
                      {block.type === 'paragraph' ? (
                        <ParagraphEditor
                          block={block}
                          variables={variables}
                          isPreview={isPreview}
                          isSelected={selectedBlockId === block.id}
                          onUpdate={(updates) => updateBlock(block.id, updates)}
                          onDelete={() => deleteBlock(block.id)}
                          onMoveUp={index > 0 ? () => moveBlock(block.id, 'up') : undefined}
                          onMoveDown={index < schema.blocks.length - 1 ? () => moveBlock(block.id, 'down') : undefined}
                        />
                      ) : (
                        <TableEditor
                          block={block}
                          variables={variables}
                          isPreview={isPreview}
                          isSelected={selectedBlockId === block.id}
                          onUpdate={(updates) => updateBlock(block.id, updates)}
                          onDelete={() => deleteBlock(block.id)}
                          onMoveUp={index > 0 ? () => moveBlock(block.id, 'up') : undefined}
                          onMoveDown={index < schema.blocks.length - 1 ? () => moveBlock(block.id, 'down') : undefined}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
