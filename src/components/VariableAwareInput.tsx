import React, { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';

interface VariableTag {
  key: string;
  color: string;
  start: number;
  end: number;
}

interface VariableAwareInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function VariableAwareInput({
  value,
  onChange,
  placeholder,
  className = '',
  style = {}
}: VariableAwareInputProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedTag, setSelectedTag] = useState<VariableTag | null>(null);
  const [colorPickerPosition, setColorPickerPosition] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 解析變數標籤（支援顏色格式：{{variable|color:#FF0000}}）
  const parseVariableTags = (text: string): VariableTag[] => {
    const tags: VariableTag[] = [];
    const regex = /\{\{([^}|]+)(?:\|color:(#[0-9A-Fa-f]{6}))?\}\}/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      tags.push({
        key: match[1],
        color: match[2] || '#ADD8E6', // 預設淡藍色
        start: match.index,
        end: match.index + match[0].length
      });
    }

    return tags;
  };

  // 處理點擊事件
  const handleClick = (e: React.MouseEvent) => {
    if (!inputRef.current) return;

    const rect = inputRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const input = inputRef.current;
    
    // 估算點擊位置對應的字符索引
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.font = getComputedStyle(input).font;
    let charIndex = 0;
    let currentWidth = 0;

    for (let i = 0; i < value.length; i++) {
      const charWidth = ctx.measureText(value[i]).width;
      if (currentWidth + charWidth / 2 > clickX) {
        charIndex = i;
        break;
      }
      currentWidth += charWidth;
      charIndex = i + 1;
    }

    // 檢查是否點擊在變數標籤上
    const tags = parseVariableTags(value);
    const clickedTag = tags.find(tag => charIndex >= tag.start && charIndex < tag.end);

    if (clickedTag) {
      setSelectedTag(clickedTag);
      setColorPickerPosition({ x: e.clientX, y: e.clientY });
      setShowColorPicker(true);
    }
  };

  // 處理顏色變更
  const handleColorChange = (newColor: string) => {
    if (!selectedTag) return;

    const oldTagText = value.substring(selectedTag.start, selectedTag.end);
    const newTagText = `{{${selectedTag.key}|color:${newColor}}}`;
    
    const newValue = value.substring(0, selectedTag.start) + newTagText + value.substring(selectedTag.end);
    onChange(newValue);
    setShowColorPicker(false);
    setSelectedTag(null);
  };

  // 處理鍵盤事件（整個標籤刪除）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;

    const input = inputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart || 0;
    const tags = parseVariableTags(value);

    // 檢查游標是否在標籤邊界
    const tagAtCursor = tags.find(tag => {
      if (e.key === 'Backspace') {
        return cursorPos === tag.end;
      } else {
        return cursorPos === tag.start;
      }
    });

    if (tagAtCursor) {
      e.preventDefault();
      const newValue = value.substring(0, tagAtCursor.start) + value.substring(tagAtCursor.end);
      onChange(newValue);
      
      // 設置新的游標位置
      setTimeout(() => {
        if (input) {
          input.setSelectionRange(tagAtCursor.start, tagAtCursor.start);
        }
      }, 0);
    }
  };

  // 渲染帶有彩色標籤的覆蓋層
  const renderOverlay = () => {
    const tags = parseVariableTags(value);
    if (tags.length === 0) return null;

    return (
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          font: inputRef.current ? getComputedStyle(inputRef.current).font : 'inherit',
          padding: inputRef.current ? getComputedStyle(inputRef.current).padding : '0',
          border: 'transparent',
          background: 'transparent',
          color: 'transparent',
          whiteSpace: 'pre',
          overflow: 'hidden'
        }}
      >
        {value.split('').map((char, index) => {
          const tag = tags.find(t => index >= t.start && index < t.end);
          if (tag && index === tag.start) {
            const tagText = value.substring(tag.start, tag.end);
            return (
              <span
                key={index}
                style={{
                  backgroundColor: tag.color,
                  color: '#000',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  margin: '0 1px',
                  fontSize: '0.85em',
                  fontWeight: '500'
                }}
              >
                {tagText}
              </span>
            );
          } else if (tag) {
            return null; // 已經在標籤開始處渲染了
          } else {
            return <span key={index} style={{ color: 'transparent' }}>{char}</span>;
          }
        })}
      </div>
    );
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        placeholder={placeholder}
        className={`relative z-10 bg-transparent ${className}`}
        style={style}
      />
      {renderOverlay()}
      
      {/* 顏色選擇器彈出框 */}
      {showColorPicker && selectedTag && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setShowColorPicker(false)}
          />
          <div
            className="fixed z-30 bg-white border border-gray-300 rounded-lg shadow-lg p-3"
            style={{
              left: colorPickerPosition.x,
              top: colorPickerPosition.y + 10
            }}
          >
            <div className="flex items-center space-x-2">
              <Palette className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium">標籤顏色</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {[
                '#ADD8E6', '#FFB6C1', '#98FB98', '#F0E68C', '#DDA0DD',
                '#87CEEB', '#F5DEB3', '#FFA07A', '#20B2AA', '#9370DB'
              ].map(color => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="mt-2">
              <input
                type="color"
                value={selectedTag.color}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-full h-8 rounded border border-gray-300"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}