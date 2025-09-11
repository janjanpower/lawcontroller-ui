import React from 'react';
import { CheckSquare, Square, Eye, Edit, Trash2, Download, Archive, FileText, User, Phone, Mail, MessageCircle, Calendar, Shield, UserCheck, UserX } from 'lucide-react';

interface BaseItem {
  id: string;
  [key: string]: any;
}

interface MobileCardAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: (item: BaseItem) => void;
  color?: string;
  show?: (item: BaseItem) => boolean;
}

interface MobileCardField {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  render?: (value: any, item: BaseItem) => React.ReactNode;
  show?: (item: BaseItem) => boolean;
}

interface MobileCardListProps {
  items: BaseItem[];
  selectedItems?: string[];
  selectedItem?: BaseItem | null;
  onSelectItem?: (item: BaseItem) => void;
  onToggleSelect?: (itemId: string) => void;
  showSelection?: boolean;
  title: (item: BaseItem) => string;
  subtitle?: (item: BaseItem) => string;
  badge?: (item: BaseItem) => { text: string; color: string } | null;
  fields: MobileCardField[];
  actions: MobileCardAction[];
  emptyMessage?: string;
}

export default function MobileCardList({
  items,
  selectedItems = [],
  selectedItem,
  onSelectItem,
  onToggleSelect,
  showSelection = false,
  title,
  subtitle,
  badge,
  fields,
  actions,
  emptyMessage = '暫無資料'
}: MobileCardListProps) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="text-sm">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={`bg-white rounded-lg border p-4 transition-all duration-200 ${
            selectedItem?.id === item.id ? 'border-[#334d6d] bg-blue-50 shadow-md' : 'border-gray-200 hover:shadow-sm'
          } ${selectedItems.includes(item.id) ? 'ring-2 ring-blue-200' : ''}`}
        >
          {/* 頂部：選擇框和主要資訊 */}
          <div className="flex items-start space-x-3 mb-3">
            {showSelection && onToggleSelect && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(item.id);
                }}
                className="mt-1 flex-shrink-0"
              >
                {selectedItems.includes(item.id) ? (
                  <CheckSquare className="w-5 h-5 text-[#334d6d]" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400" />
                )}
              </button>
            )}

            <div
              className="flex-1 cursor-pointer"
              onClick={() => onSelectItem?.(item)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900 text-base">{title(item)}</h3>
                {badge && badge(item) && (
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badge(item)!.color}`}>
                    {badge(item)!.text}
                  </span>
                )}
              </div>

              {subtitle && (
                <div className="text-sm text-gray-600 mb-2">{subtitle(item)}</div>
              )}

              <div className="space-y-1 text-sm text-gray-600">
                {fields.map((field) => {
                  if (field.show && !field.show(item)) return null;

                  const value = item[field.key];
                  if (!value && value !== 0) return null;

                  return (
                    <div key={field.key} className="flex items-center">
                      {field.icon && <field.icon className="w-3 h-3 mr-2 text-gray-400" />}
                      <span className="font-medium">{field.label}：</span>
                      <span>
                        {field.render ? field.render(value, item) : value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 底部：操作按鈕 */}
          <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
            {actions.map((action, index) => {
              if (action.show && !action.show(item)) return null;

              return (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick(item);
                  }}
                  className={`${action.color || 'text-[#334d6d] hover:text-[#3f5a7d]'} text-sm font-medium flex items-center space-x-1 transition-colors`}
                >
                  <action.icon className="w-4 h-4" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}