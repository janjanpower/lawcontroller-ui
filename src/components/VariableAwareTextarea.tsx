import React, { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';

interface VariableTag {
  key: string;
  color: string;
  start: number;
  end: number;
}

interface VariableAwareTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  rows?: number;
}

export default function VariableAwareTextarea({
  value,
  onChange,
  placeholder,
  className = '',
  style = {},
  rows = 4
}: VariableAwareTextareaProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedTag, setSelectedTag] = useState<VariableTag | null>(null);
  const [colorPickerPosition, setColorPickerPosition] = useState({ x: 0, y: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  // 計算點擊位置對應的字符索引
  const getCharIndexFromClick = (e: React.MouseEvent): number => {
    if (!textareaRef.current) return 0;

    const textarea = textareaRef.current;
    const rect = textarea.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // 創建臨時元素來測量文字
    const div = document.createElement('div');
    div.style.cssText = getComputedStyle(textarea).cssText;
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.height = 'auto';
    div.style.width = textarea.clientWidth + 'px';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    document.body.appendChild(div);

    const lines = value.split('\n');
    let totalChars = 0;
    let targetLine = 0;

    // 找到點擊的行
    for (let i = 0; i < lines.length; i++) {
      div.textContent = lines.slice(0, i + 1).join('\n');
      if (div.offsetHeight > clickY) {
        targetLine = i;
        break;
      }
      if (i < lines.length - 1) totalChars += lines[i].length + 1; // +1 for \n
    }

    // 在目標行中找到點擊的字符
    const lineText = lines[targetLine] || '';
    div.textContent = '';
    
    for (let i = 0; i <= lineText.length; i++) {
      div.textContent = lineText.substring(0, i);
      if (div.offsetWidth > clickX) {
        document.body.removeChild(div);
        return totalChars + Math.max(0, i - 1);
      }
    }

    document.body.removeChild(div);
    return totalChars + lineText.length;
  };

  // 處理點擊事件
  const handleClick = (e: React.MouseEvent) => {
    const charIndex = getCharIndexFromClick(e);
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

    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart || 0;
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
        if (textarea) {
          textarea.setSelectionRange(tagAtCursor.start, tagAtCursor.start);
        }
      }, 0);
    }
  };

  // 渲染帶有彩色標籤的覆蓋層
  const renderOverlay = () => {
    const tags = parseVariableTags(value);
    if (tags.length === 0) return null;

    // 將文字分割成片段，標記哪些是變數標籤
    const segments: Array<{ text: string; isTag: boolean; tag?: VariableTag }> = [];
    let lastIndex = 0;

    tags.forEach(tag => {
      // 添加標籤前的普通文字
      if (tag.start > lastIndex) {
        segments.push({
          text: value.substring(lastIndex, tag.start),
          isTag: false
        });
      }
      
      // 添加標籤
      segments.push({
        text: value.substring(tag.start, tag.end),
        isTag: true,
        tag
      });
      
      lastIndex = tag.end;
    });

    // 添加最後的普通文字
    if (lastIndex < value.length) {
      segments.push({
        text: value.substring(lastIndex),
        isTag: false
      });
    }

    return (
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words"
        style={{
          font: textareaRef.current ? getComputedStyle(textareaRef.current).font : 'inherit',
          padding: textareaRef.current ? getComputedStyle(textareaRef.current).padding : '0',
          lineHeight: textareaRef.current ? getComputedStyle(textareaRef.current).lineHeight : 'inherit',
          color: 'transparent',
          overflow: 'hidden'
        }}
      >
        {segments.map((segment, index) => (
          <span key={index}>
            {segment.isTag && segment.tag ? (
              <span
                style={{
                  backgroundColor: segment.tag.color,
                  color: '#000',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  margin: '0 1px',
                  fontSize: '0.85em',
                  fontWeight: '500',
                  display: 'inline-block'
                }}
              >
                {segment.text}
              </span>
            ) : (
              <span style={{ color: 'transparent' }}>{segment.text}</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        placeholder={placeholder}
        rows={rows}
        className={`relative z-10 bg-transparent resize-none ${className}`}
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
              left: Math.min(colorPickerPosition.x, window.innerWidth - 200),
              top: Math.min(colorPickerPosition.y + 10, window.innerHeight - 150)
            }}
          >
            <div className="flex items-center space-x-2 mb-2">
              <Palette className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium">標籤顏色</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
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
            <input
              type="color"
              value={selectedTag.color}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-full h-8 rounded border border-gray-300"
            />
          </div>
        </>
      )}
    </div>
  );
}