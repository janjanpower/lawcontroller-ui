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
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <Tag className="w-4 h-4 text-[#334d6d]" />
          <h3 className="text-sm font-semibold text-gray-900">變數</h3>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#334d6d] focus:border-[#334d6d]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredVariables.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">
              {searchQuery ? '找不到符合的變數' : '載入中...'}
            </p>
          </div>
        ) : (
          categories.map(([categoryName, vars]) => (
            <div key={categoryName} className="mb-3">
              <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                <h4 className="text-xs font-semibold text-gray-600">
                  {categoryName}
                </h4>
              </div>
              <div className="p-2 space-y-1.5">
                {vars.map((variable) => {
                  const usage = variableUsage.get(variable.key) || 0;
                  const maxUsage = variable.maxUsage;
                  const canInsert = !maxUsage || usage < maxUsage;

                  return (
                    <div
                      key={variable.key}
                      className={`rounded border transition-all ${
                        canInsert
                          ? 'border-gray-200 bg-white hover:border-[#334d6d] hover:shadow-sm'
                          : 'border-gray-200 bg-gray-50 opacity-50'
                      }`}
                    >
                      <div className="p-2">
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate">
                              {variable.label}
                            </div>
                            <div className="text-[10px] font-mono text-gray-500 mt-0.5">
                              {`{{${variable.key}}}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          {maxUsage && (
                            <div className="text-[10px] text-gray-500">
                              {usage} / {maxUsage}
                            </div>
                          )}
                          <button
                            onClick={() => canInsert && onInsertVariable(variable.key)}
                            disabled={!canInsert}
                            className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                              canInsert
                                ? 'bg-[#334d6d] text-white hover:bg-[#3f5a7d]'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
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
