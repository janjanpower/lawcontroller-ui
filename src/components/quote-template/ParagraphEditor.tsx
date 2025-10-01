import React, { useRef, useEffect, useState } from 'react';
import { Trash2, ChevronUp, ChevronDown, X } from 'lucide-react';
import type { ParagraphBlock, VariableDef, InlineElement } from '../../types/quote-template';

interface Props {
  block: ParagraphBlock;
  variables: VariableDef[];
  isPreview: boolean;
  isSelected: boolean;
  onUpdate: (updates: Partial<ParagraphBlock>) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export default function ParagraphEditor({
  block,
  variables,
  isPreview,
  isSelected,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState('');

  useEffect(() => {
    const rendered = renderInlines(block.inlines, isPreview);
    setHtml(rendered);
  }, [block.inlines, isPreview, variables]);

  const renderInlines = (inlines: InlineElement[], preview: boolean): string => {
    return inlines.map(inline => {
      if (inline.type === 'text') {
        return inline.html;
      } else {
        const variable = variables.find(v => v.key === inline.key);
        const label = variable?.label || inline.label;

        if (preview) {
          return `<span class="variable-value">${label}</span>`;
        } else {
          return `<span class="variable-chip" data-key="${inline.key}" contenteditable="false">${label}</span>`;
        }
      }
    }).join('');
  };

  const parseHtmlToInlines = (htmlString: string): InlineElement[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const inlines: InlineElement[] = [];

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text) {
          inlines.push({ type: 'text', html: text });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;

        if (element.classList.contains('variable-chip')) {
          const key = element.getAttribute('data-key');
          const label = element.textContent || '';
          if (key) {
            inlines.push({ type: 'var', key, label });
          }
        } else {
          Array.from(node.childNodes).forEach(processNode);
        }
      }
    };

    Array.from(doc.body.childNodes).forEach(processNode);

    return inlines.length > 0 ? inlines : [{ type: 'text', html: '' }];
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newHtml = e.currentTarget.innerHTML;
    const newInlines = parseHtmlToInlines(newHtml);
    onUpdate({ inlines: newInlines });
  };

  const handleRemoveVariable = (varKey: string) => {
    const newInlines = block.inlines.filter(inline =>
      !(inline.type === 'var' && inline.key === varKey)
    );
    onUpdate({ inlines: newInlines });
  };

  const textStyle: React.CSSProperties = {
    textAlign: block.align || 'left',
    fontWeight: block.bold ? 'bold' : 'normal',
    fontStyle: block.italic ? 'italic' : 'normal',
    textDecoration: block.underline ? 'underline' : 'none',
    fontSize: block.fontSize ? `${block.fontSize}pt` : '12pt',
    lineHeight: 1.5,
    padding: '8px 0',
    minHeight: '40px',
    outline: 'none',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word'
  };

  return (
    <div className="relative group">
      {isSelected && !isPreview && (
        <div className="absolute -right-12 top-0 flex flex-col gap-1">
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

      <div
        ref={editorRef}
        contentEditable={!isPreview}
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: html }}
        suppressContentEditableWarning
        style={textStyle}
        className={`${!isPreview ? 'cursor-text' : ''}`}
      />

      <style>{`
        .variable-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          margin: 0 2px;
          background: #3498db;
          color: white;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          cursor: default;
          user-select: none;
        }

        .variable-value {
          color: #2c3e50;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
