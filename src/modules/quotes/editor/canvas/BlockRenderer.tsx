import React, { useRef } from "react";
import { CanvasBlock, TextBlock, TableBlock } from "./schema";
import { renderString } from "../../../../utils/templateEngine";

// 🟦 Text 區塊：變數可自訂顏色
export function VariableAwareTextarea({
  value,
  onChange,
  style,
  placeholder,
  variableColors = {},
}: {
  value: string;
  onChange: (value: string) => void;
  style: React.CSSProperties;
  placeholder?: string;
  variableColors?: Record<string, string>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 刪除變數標籤整塊
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (e.key === "Backspace" || e.key === "Delete") {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (start === end) {
        const beforeCursor = value.substring(0, start);
        const afterCursor = value.substring(start);
        const varMatch = beforeCursor.match(/\{\{[^}]*$/);

        if (varMatch) {
          const varStart = start - varMatch[0].length;
          const varEndMatch = afterCursor.match(/^[^}]*\}\}/);

          if (varEndMatch) {
            const varEnd = start + varEndMatch[0].length;
            e.preventDefault();

            const newValue = value.substring(0, varStart) + value.substring(varEnd);
            onChange(newValue);

            setTimeout(() => {
              textarea.setSelectionRange(varStart, varStart);
            }, 0);
          }
        }
      }
    }
  };

  // 渲染變數標籤
  const renderHighlightedText = () => {
    const parts = value.split(/(\{\{[^}]*\}\})/);
    return parts.map((part, i) => {
      if (/^\{\{.*\}\}$/.test(part)) {
        const key = part.replace(/[{}]/g, "");
        const color = variableColors?.[key] || "#dbeafe";
        return (
          <span
            key={i}
            className="border rounded px-1 mx-0.5"
            style={{ backgroundColor: color, borderColor: color }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="relative w-full h-full">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          ...style,
          color: "transparent",
          whiteSpace: "pre-wrap",
          overflow: "hidden",
          zIndex: 1,
        }}
      >
        {renderHighlightedText()}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{ ...style, backgroundColor: "transparent", position: "relative", zIndex: 2 }}
        placeholder={placeholder}
      />
    </div>
  );
}

// 🟩 Table 區塊：單格變數顯示
export function VariableAwareInput({
  value,
  onChange,
  className,
  placeholder,
  onFocus,
  variableColors = {},
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  onFocus?: () => void;
  variableColors?: Record<string, string>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const input = inputRef.current;
    if (!input) return;
    if (e.key === "Backspace" || e.key === "Delete") {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;

      if (start === end) {
        const before = value.substring(0, start);
        const after = value.substring(start);
        const varMatch = before.match(/\{\{[^}]*$/);

        if (varMatch) {
          const varStart = start - varMatch[0].length;
          const varEndMatch = after.match(/^[^}]*\}\}/);
          if (varEndMatch) {
            const varEnd = start + varEndMatch[0].length;
            e.preventDefault();
            const newValue = value.substring(0, varStart) + value.substring(varEnd);
            onChange(newValue);
            setTimeout(() => input.setSelectionRange(varStart, varStart), 0);
          }
        }
      }
    }
  };

  const renderHighlightedText = () => {
    const parts = value.split(/(\{\{[^}]*\}\})/);
    return parts.map((part, i) => {
      if (/^\{\{.*\}\}$/.test(part)) {
        const key = part.replace(/[{}]/g, "");
        const color = variableColors?.[key] || "#dbeafe";
        return (
          <span
            key={i}
            className="border rounded px-1 mx-0.5"
            style={{ backgroundColor: color, borderColor: color }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="relative w-full h-full">
      <div
        className="absolute inset-0 pointer-events-none flex items-center"
        style={{ color: "transparent", whiteSpace: "nowrap", overflow: "hidden", zIndex: 1 }}
      >
        {renderHighlightedText()}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        className={className}
        placeholder={placeholder}
        style={{ backgroundColor: "transparent", position: "relative", zIndex: 2 }}
      />
    </div>
  );
}

// 🟨 主 BlockRenderer
export default function BlockRenderer({
  block,
  previewMode,
  caseContext,
  onUpdate,
}: {
  block: CanvasBlock;
  previewMode: boolean;
  caseContext: any;
  onUpdate: (patch: Partial<CanvasBlock>) => void;
}) {
  if (block.type === "text") {
    const textBlock = block as TextBlock;
    if (previewMode) {
      return (
        <div
          style={{
            fontSize: textBlock.fontSize,
            fontWeight: textBlock.bold ? "bold" : "normal",
            fontStyle: textBlock.italic ? "italic" : "normal",
            textDecoration: textBlock.underline ? "underline" : "none",
            textAlign: textBlock.align,
            color: textBlock.color,
            backgroundColor: textBlock.backgroundColor || "transparent",
            whiteSpace: "pre-wrap",
          }}
        >
          {renderString(textBlock.text, caseContext)}
        </div>
      );
    }
    return (
      <VariableAwareTextarea
        value={textBlock.text}
        onChange={(t) => onUpdate({ text: t })}
        style={{
          fontSize: textBlock.fontSize,
          fontWeight: textBlock.bold ? "bold" : "normal",
          fontStyle: textBlock.italic ? "italic" : "normal",
          textDecoration: textBlock.underline ? "underline" : "none",
          textAlign: textBlock.align,
          color: textBlock.color,
        }}
        placeholder="輸入文字..."
        variableColors={textBlock.variableColors}
      />
    );
  }

  if (block.type === "table") {
    const tableBlock = block as TableBlock;
    return (
      <table className="w-full h-full border border-gray-300 text-xs">
        <thead>
          <tr>
            {tableBlock.headers.map((h, i) => (
              <th key={i} className="border p-1 bg-gray-100">
                {previewMode ? renderString(h, caseContext) : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableBlock.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border p-1">
                  {previewMode ? renderString(cell, caseContext) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return null;
}
