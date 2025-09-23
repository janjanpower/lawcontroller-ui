import React, { useState } from "react";
import { ChevronDown, ChevronUp, Tag } from "lucide-react";
import type { VariableDef } from "./variables";

interface Props {
  vars: VariableDef[];
  onInsert: (varKey: string) => void;
  compact?: boolean;
  maxVisible?: number;
}

export default function VariableInserter({ 
  vars, 
  onInsert, 
  compact = false, 
  maxVisible = 6 
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredVars = vars.filter(v => 
    v.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayVars = expanded ? filteredVars : filteredVars.slice(0, maxVisible);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {displayVars.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onInsert(v.key)}
            className="px-2 py-1 text-xs rounded bg-blue-100 hover:bg-blue-200 text-blue-800 transition-colors"
            title={`插入 {{${v.key}}}`}
          >
            {v.label}
          </button>
        ))}
        {filteredVars.length > maxVisible && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">插入變數</span>
      </div>
      
      {vars.length > 8 && (
        <input
          type="text"
          placeholder="搜尋變數..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
        />
      )}
      
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {displayVars.map((v) => (
          <button
            key={v.key}
            onClick={() => onInsert(v.key)}
            className="w-full text-left px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors group"
          >
            <div className="font-mono text-blue-600 group-hover:text-blue-800">
              {{`${v.key}`}}
            </div>
            <div className="text-gray-600 group-hover:text-gray-800">
              {v.label}
            </div>
          </button>
        ))}
      </div>
      
      {filteredVars.length > maxVisible && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              收起
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              顯示更多 ({filteredVars.length - maxVisible})
            </>
          )}
        </button>
      )}
    </div>
  );
}
