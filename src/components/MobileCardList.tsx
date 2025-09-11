import React from 'react';

interface MobileCardListProps<T> {
  items: T[];
  renderCard: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onItemClick?: (item: T) => void;
  selectedItemId?: string | null;
  className?: string;
  searchTerm?: string;
  totalCount?: number;
}

export default function MobileCardList<T>({
  items,
  renderCard,
  keyExtractor,
  emptyMessage = '暫無資料',
  emptyIcon,
  onItemClick,
  selectedItemId,
  className = '',
  searchTerm,
  totalCount
}: MobileCardListProps<T>) {
  return (
    <div className={`lg:hidden p-4 space-y-4 ${className}`}>
      {/* 搜尋結果統計 */}
      {searchTerm && totalCount !== undefined && (
        <div className="text-sm text-green-600 mb-2">
          找到 {items.length}/{totalCount} 筆資料
        </div>
      )}

      {/* 卡片列表 */}
      {items.length > 0 ? (
        items.map((item, index) => {
          const itemKey = keyExtractor(item);
          const isSelected = selectedItemId === itemKey;
          
          return (
            <div
              key={itemKey}
              className={`bg-white rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer ${
                isSelected 
                  ? 'border-[#334d6d] bg-blue-50 shadow-lg' 
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
              onClick={() => onItemClick?.(item)}
            >
              {renderCard(item, index)}
            </div>
          );
        })
      ) : (
        <div className="text-center py-12">
          {emptyIcon && (
            <div className="w-12 h-12 text-gray-300 mx-auto mb-4">
              {emptyIcon}
            </div>
          )}
          <p className="text-gray-500">
            {searchTerm ? `找不到符合條件的${emptyMessage}` : emptyMessage}
          </p>
        </div>
      )}
    </div>
  );
}