import React, { useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  onFocus?: () => void;
  variableColors?: Record<string, string>;
}

export default function VariableAwareInput({
  value,
  onChange,
  className,
  placeholder,
  onFocus,
  variableColors = {},
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const input = inputRef.current;
    if (!input) return;

    if (e.key === "Backspace" || e.key === "Delete") {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;

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
              input.setSelectionRange(varStart, varStart);
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
        className="absolute inset-0 pointer-events-none flex items-center"
        style={{
          color: "transparent",
          whiteSpace: "nowrap",
          overflow: "hidden",
          zIndex: 1,
          fontSize: "inherit",
          fontFamily: "inherit",
          padding: "2px 4px",
        }}
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
        style={{
          backgroundColor: "transparent",
          position: "relative",
          zIndex: 2,
        }}
      />
    </div>
  );
}
