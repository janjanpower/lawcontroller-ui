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
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded border border-gray-200">
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onUpdate({ bold: !block.bold })}
          className={`p-1.5 rounded transition-colors ${
            block.bold ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-600'
          }`}
          title="粗體"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdate({ italic: !block.italic })}
          className={`p-1.5 rounded transition-colors ${
            block.italic ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-600'
          }`}
          title="斜體"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdate({ underline: !block.underline })}
          className={`p-1.5 rounded transition-colors ${
            block.underline ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-600'
          }`}
          title="底線"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-5 bg-gray-300" />

      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onUpdate({ align: 'left' })}
          className={`p-1.5 rounded transition-colors ${
            (block.align || 'left') === 'left' ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-600'
          }`}
          title="靠左對齊"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdate({ align: 'center' })}
          className={`p-1.5 rounded transition-colors ${
            block.align === 'center' ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-600'
          }`}
          title="置中對齊"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdate({ align: 'right' })}
          className={`p-1.5 rounded transition-colors ${
            block.align === 'right' ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-600'
          }`}
          title="靠右對齊"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdate({ align: 'justify' })}
          className={`p-1.5 rounded transition-colors ${
            block.align === 'justify' ? 'bg-[#334d6d] text-white' : 'hover:bg-gray-200 text-gray-600'
          }`}
          title="左右對齊"
        >
          <AlignJustify className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-5 bg-gray-300" />

      <div className="flex items-center gap-1.5">
        <Type className="w-3.5 h-3.5 text-gray-500" />
        <select
          value={block.fontSize || 12}
          onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })}
          className="px-2 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#334d6d] focus:border-[#334d6d]"
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
