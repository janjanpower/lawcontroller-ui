// src/components/StageEditDialog.tsx
import { useEffect, useMemo, useState } from 'react';

export type StageFormData = {
  stageName: string;
  date: string;   // YYYY-MM-DD
  time?: string;  // HH:MM (optional)
  note?: string;
};

interface StageEditDialogProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  initial?: Partial<StageFormData>;
  suggestions?: string[]; // 階段名稱建議（可自由輸入）
  onClose: () => void;
  onSave: (data: StageFormData) => Promise<boolean> | boolean;
}

const DEFAULT_SUGGESTIONS = ['委任','起訴','開庭','判決','上訴','執行','結案'];

export default function StageEditDialog({
  isOpen,
  mode,
  initial,
  suggestions,
  onClose,
  onSave,
}: StageEditDialogProps) {
  const [stageName, setStageName] = useState(initial?.stageName ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [time, setTime] = useState(initial?.time ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const tips = useMemo(
    () => (suggestions && suggestions.length ? suggestions : DEFAULT_SUGGESTIONS),
    [suggestions]
  );

  useEffect(() => {
    if (isOpen) {
      setStageName(initial?.stageName ?? '');
      setDate(initial?.date ?? '');
      setTime(initial?.time ?? '');
      setNote(initial?.note ?? '');
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const validate = (): string | null => {
    if (!stageName.trim()) return '請輸入階段名稱';
    if (!date.trim()) return '請選擇日期';
    // 簡單檢查 YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '日期格式錯誤（YYYY-MM-DD）';
    if (time && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) return '時間格式錯誤（HH:MM）';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      alert(err);
      return;
    }
    const ok = await onSave({
      stageName: stageName.trim(),
      date: date.trim(),
      time: time.trim() || undefined,
      note: note.trim() || undefined,
    });
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="bg-[#334d6d] text-white px-5 py-3 rounded-t-xl">
          <h2 className="text-lg font-semibold">
            {mode === 'add' ? '新增進度階段' : '編輯進度階段'}
          </h2>
        </div>

        <div className="p-5 space-y-4">
          {/* 階段名稱 */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">階段名稱</label>
            <input
              list="stage-suggestions"
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              placeholder="例如：開庭 / 判決 / 上訴…（可自由輸入）"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#334d6d]"
            />
            <datalist id="stage-suggestions">
              {tips.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* 日期 */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#334d6d]"
            />
          </div>

          {/* 時間（可選） */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              時間 <span className="text-gray-400 text-xs">（選填，格式 HH:MM）</span>
            </label>
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="14:30"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#334d6d]"
            />
          </div>

          {/* 備註（可選） */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">備註</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="補充事項或說明（選填）"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#334d6d]"
            />
          </div>
        </div>

        <div className="px-5 py-4 flex justify-end space-x-2 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-[#27ae60] hover:bg-[#229954] text-white"
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
