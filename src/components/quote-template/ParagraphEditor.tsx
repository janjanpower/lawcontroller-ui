import React, { useRef, useEffect, useState } from 'react';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { ParagraphBlock, VariableDef, InlineElement, VarInline } from '../../types/quote-template';

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
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (!editorRef.current || isPreview) return;

    const selection = window.getSelection();
    const currentCursorPos = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0).startOffset
      : 0;

    const rendered = renderInlines(block.inlines, isPreview);

    if (editorRef.current.innerHTML !== rendered) {
      editorRef.current.innerHTML = rendered;

      try {
        if (selection && editorRef.current.firstChild) {
          const range = document.createRange();
          const textNode = editorRef.current.firstChild;
          const maxOffset = textNode.textContent?.length || 0;
          const safeOffset = Math.min(currentCursorPos, maxOffset);

          range.setStart(textNode, safeOffset);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch (e) {
        console.warn('Failed to restore cursor position:', e);
      }
    }
  }, [block.inlines, isPreview, variables]);

  const getChipColor = (varKey: string): string => {
    const variable = variables.find(v => v.key === varKey);

    if (varKey.startsWith('case_') || varKey.startsWith('court_')) {
      return '#3498db';
    } else if (varKey.startsWith('client_') || varKey.startsWith('party_')) {
      return '#2ecc71';
    } else if (varKey.startsWith('firm_') || varKey.startsWith('lawyer_')) {
      return '#9b59b6';
    }
    return '#e74c3c';
  };

  const renderInlines = (inlines: InlineElement[], preview: boolean): string => {
    return inlines.map(inline => {
      if (inline.type === 'text') {
        return inline.html;
      } else {
        const variable = variables.find(v => v.key === inline.key);
        const label = variable?.label || inline.label;
        const color = getChipColor(inline.key);

        if (preview) {
          return `<span class="variable-value">${label}</span>`;
        } else {
          return `<span class="variable-chip" data-key="${inline.key}" data-color="${color}" style="background-color: ${color};" contenteditable="false">${label}</span>`;
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
          const lastInline = inlines[inlines.length - 1];
          if (lastInline && lastInline.type === 'text') {
            lastInline.html += text;
          } else {
            inlines.push({ type: 'text', html: text });
          }
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

  const handleBeforeInput = (e: React.CompositionEvent<HTMLDivElement> | any) => {
    if (e.type === 'compositionstart') {
      isComposingRef.current = true;
    } else if (e.type === 'compositionend') {
      isComposingRef.current = false;
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (isComposingRef.current) return;

    const newHtml = e.currentTarget.innerHTML;
    const newInlines = parseHtmlToInlines(newHtml);
    onUpdate({ inlines: newInlines });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection();
      if (!selection || !editorRef.current) return;

      const range = selection.getRangeAt(0);
      const container = range.startContainer;

      let chipToDelete: HTMLElement | null = null;

      if (e.key === 'Backspace') {
        if (container.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
          const prevSibling = container.previousSibling;
          if (prevSibling && (prevSibling as HTMLElement).classList?.contains('variable-chip')) {
            chipToDelete = prevSibling as HTMLElement;
          }
        } else if ((container as HTMLElement).classList?.contains('variable-chip')) {
          chipToDelete = container as HTMLElement;
        } else if (container.parentElement?.classList?.contains('variable-chip')) {
          chipToDelete = container.parentElement;
        }
      } else if (e.key === 'Delete') {
        if (container.nodeType === Node.TEXT_NODE) {
          const nextSibling = container.nextSibling;
          if (nextSibling && (nextSibling as HTMLElement).classList?.contains('variable-chip')) {
            chipToDelete = nextSibling as HTMLElement;
          }
        }
      }

      if (chipToDelete) {
        e.preventDefault();
        const key = chipToDelete.getAttribute('data-key');
        if (key) {
          const newInlines = block.inlines.filter(inline =>
            !(inline.type === 'var' && inline.key === key)
          );
          onUpdate({ inlines: newInlines });
        }
      }
    }
  };

  const textStyle: React.CSSProperties = {
    textAlign: block.align || 'left',
    fontWeight: block.bold ? 'bold' : 'normal',
    fontStyle: block.italic ? 'italic' : 'normal',
    textDecoration: block.underline ? 'underline' : 'none',
    fontSize: block.fontSize ? `${block.fontSize}pt` : '12pt',
    lineHeight: 1.6,
    padding: '12px 0',
    minHeight: '40px',
    outline: 'none',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word'
  };

  return (
    <div className="relative group">
      {isSelected && !isPreview && (
        <div className="absolute -right-2 top-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors shadow-sm"
              title="上移"
            >
              <ChevronUp className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors shadow-sm"
              title="下移"
            >
              <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 bg-white border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors shadow-sm"
            title="刪除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable={!isPreview}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleBeforeInput}
        onCompositionEnd={handleBeforeInput}
        suppressContentEditableWarning
        style={textStyle}
        className={`${!isPreview ? 'cursor-text hover:bg-gray-50 px-2 rounded transition-colors' : ''}`}
      />

      <style>{`
        .variable-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          margin: 0 3px;
          border-radius: 14px;
          font-size: 11px;
          font-weight: 600;
          cursor: default;
          user-select: none;
          color: white;
          vertical-align: middle;
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        }

        .variable-value {
          color: #2c3e50;
          font-weight: 600;
          padding: 0 2px;
        }
      `}</style>
    </div>
  );
}
