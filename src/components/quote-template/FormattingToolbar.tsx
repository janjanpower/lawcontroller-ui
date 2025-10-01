import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type
} from 'lucide-react';
import type { ParagraphBlock } from '../../types/quote-template';

interface Props {
  block: ParagraphBlock;
  onUpdate: (updates: Partial<ParagraphBlock>) => void;
}

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36];

export default function FormattingToolbar({ block, onUpdate }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-1">
        <button
          onClick={() => onUpdate({ bold: !block.bold })}
          className={`p-2 rounded transition-colors ${
            block.bold ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-700'
          }`}
          title="粗體"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => onUpdate({ italic: !block.italic })}
          className={`p-2 rounded transition-colors ${
            block.italic ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-700'
          }`}
          title="斜體"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => onUpdate({ underline: !block.underline })}
          className={`p-2 rounded transition-colors ${
            block.underline ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-700'
          }`}
          title="底線"
        >
          <Underline className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-gray-300" />

      <div className="flex items-center gap-1">
        <button
          onClick={() => onUpdate({ align: 'left' })}
          className={`p-2 rounded transition-colors ${
            (block.align || 'left') === 'left' ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-700'
          }`}
          title="靠左對齊"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onUpdate({ align: 'center' })}
          className={`p-2 rounded transition-colors ${
            block.align === 'center' ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-700'
          }`}
          title="置中對齊"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => onUpdate({ align: 'right' })}
          className={`p-2 rounded transition-colors ${
            block.align === 'right' ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-700'
          }`}
          title="靠右對齊"
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onUpdate({ align: 'justify' })}
          className={`p-2 rounded transition-colors ${
            block.align === 'justify' ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-700'
          }`}
          title="左右對齊"
        >
          <AlignJustify className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-gray-300" />

      <div className="flex items-center gap-2">
        <Type className="w-4 h-4 text-gray-600" />
        <select
          value={block.fontSize || 12}
          onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })}
          className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#3498db] focus:border-transparent"
        >
          {FONT_SIZES.map(size => (
            <option key={size} value={size}>
              {size}pt
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
