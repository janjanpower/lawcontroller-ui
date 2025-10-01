import React, { useMemo } from 'react';
import { Search, Tag, Plus } from 'lucide-react';
import type { VariableDef } from '../../types/quote-template';

interface Props {
  variables: VariableDef[];
  variableUsage: Map<string, number>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onInsertVariable: (varKey: string) => void;
}

export default function VariablePanel({
  variables,
  variableUsage,
  searchQuery,
  onSearchChange,
  onInsertVariable
}: Props) {
  const filteredVariables = useMemo(() => {
    if (!searchQuery.trim()) return variables;

    const query = searchQuery.toLowerCase();
    return variables.filter(
      v => v.label.toLowerCase().includes(query) || v.key.toLowerCase().includes(query)
    );
  }, [variables, searchQuery]);

  const categories = useMemo(() => {
    const cats: { [key: string]: VariableDef[] } = {
      案件資訊: [],
      當事人資訊: [],
      事務所資訊: [],
      其他: []
    };

    filteredVariables.forEach(variable => {
      if (variable.key.startsWith('case_') || variable.key.startsWith('court_')) {
        cats['案件資訊'].push(variable);
      } else if (variable.key.startsWith('client_') || variable.key.startsWith('party_')) {
        cats['當事人資訊'].push(variable);
      } else if (variable.key.startsWith('firm_') || variable.key.startsWith('lawyer_')) {
        cats['事務所資訊'].push(variable);
      } else {
        cats['其他'].push(variable);
      }
    });

    return Object.entries(cats).filter(([_, vars]) => vars.length > 0);
  }, [filteredVariables]);

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-5 h-5 text-[#334d6d]" />
          <h3 className="font-semibold text-gray-900">變數標籤</h3>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋變數..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3498db] focus:border-transparent"
          />
        </div>

        <p className="text-xs text-gray-500 mt-2">
          點擊插入變數到選中的段落
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredVariables.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {searchQuery ? '找不到符合的變數' : '載入變數中...'}
            </p>
          </div>
        ) : (
          categories.map(([categoryName, vars]) => (
            <div key={categoryName} className="mb-4">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {categoryName}
                </h4>
              </div>
              <div className="p-3 space-y-2">
                {vars.map((variable) => {
                  const usage = variableUsage.get(variable.key) || 0;
                  const maxUsage = variable.maxUsage;
                  const canInsert = !maxUsage || usage < maxUsage;

                  return (
                    <div
                      key={variable.key}
                      className={`rounded-lg border transition-all ${
                        canInsert
                          ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                          : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                    >
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {variable.label}
                            </div>
                            <div className="text-xs font-mono text-gray-600 mt-1">
                              {`{{${variable.key}}}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          {maxUsage && (
                            <div className="text-xs text-gray-500">
                              已使用 {usage} / {maxUsage}
                            </div>
                          )}
                          <button
                            onClick={() => canInsert && onInsertVariable(variable.key)}
                            disabled={!canInsert}
                            className={`ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                              canInsert
                                ? 'bg-[#3498db] text-white hover:bg-[#2980b9]'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                            插入
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
