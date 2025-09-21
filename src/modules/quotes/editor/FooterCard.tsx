import React from "react";

export default function FooterCard({
  content,
  onChange,
}: {
  content: any;
  onChange: (c: any) => void;
}) {
  return (
    <div className="text-sm text-gray-600 space-y-2">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={content.showPageNumbers || false}
          onChange={(e) =>
            onChange({ ...content, showPageNumbers: e.target.checked })
          }
        />
        顯示頁碼
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={content.showFirmInfo || false}
          onChange={(e) =>
            onChange({ ...content, showFirmInfo: e.target.checked })
          }
        />
        顯示事務所名稱
      </label>
    </div>
  );
}
