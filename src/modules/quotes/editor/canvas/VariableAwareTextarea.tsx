import React, { useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  style: React.CSSProperties;
  placeholder?: string;
  variableColors?: Record<string, string>;
}

export default function VariableAwareTextarea({
  value,
  onChange,
  style,
  placeholder,
  variableColors = {},
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
            const newValue =
              value.substring(0, varStart) + value.substring(varEnd);
            onChange(newValue);

            setTimeout(() => {
              textarea.setSelectionRange(varStart, varStart);
            }, 0);
            return;
          }
        }
      }
    }
  };

  const renderHighlightedText = () => {
    const parts = value.split(/(\{\{[^}]*\}\})/);
    return parts.map((part, index) => {
      if (part.match(/^\{\{.*\}\}$/)) {
        const key = part.replace(/[{}]/g, "");
        const color = variableColors?.[key] || "#dbeafe";
        return (
          <span
            key={index}
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
        style={{
          ...style,
          backgroundColor: "transparent",
          position: "relative",
          zIndex: 2,
        }}
        placeholder={placeholder}
      />
    </div>
  );
}
