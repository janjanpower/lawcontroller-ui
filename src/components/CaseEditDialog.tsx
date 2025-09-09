import { useEffect, useMemo, useState } from 'react';

export type CaseEditFormData = {
  case_type?: string;
  case_reason?: string;
  case_number?: string;
  court?: string;
  division?: string;
  progress?: string;
  progress_date?: string; // YYYY-MM-DD
  is_closed?: boolean;
};

interface CaseEditDialogProps {
  isOpen: boolean;
  initial?: Partial<CaseEditFormData> & { id?: string; client_id?: string };
  onClose: () => void;
  onSave: (data: CaseEditFormData) => Promise<boolean> | boolean;
}

export default function CaseEditDialog({
  isOpen,
  initial,
  onClose,
  onSave,
}: CaseEditDialogProps) {
  const [form, setForm] = useState<CaseEditFormData>({
    case_type: '',
    case_reason: '',
    case_number: '',
    court: '',
    division: '',
    progress: '',
    progress_date: '',
    is_closed: false,
  });

  // 開窗或 initial 改變時帶入資料
  useEffect(() => {
    if (isOpen) {
      setForm({
        case_type: initial?.case_type ?? '',
        case_reason: initial?.case_reason ?? '',
        case_number: initial?.case_number ?? '',
        court: initial?.court ?? '',
        division: initial?.division ?? '',
        progress: initial?.progress ?? '',
        progress_date: (initial?.progress_date ?? '')?.slice(0, 10),
        is_closed: Boolean(initial?.is_closed),
      });
    }
  }, [isOpen, initial]);

  const canSave = useMemo(() => {
    // 你可以依需求加上必填欄位檢核
    return true;
  }, [form]);

  const handleChange = (k: keyof CaseEditFormData, v: string | boolean) => {
    setForm(prev => ({ ...prev, [k]: v as any }));
  };

  const handleSubmit = async () => {
    if (!canSave) return;
    const ok = await onSave(form);
    if (ok) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-2xl bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">編輯案件</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">案件類型</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.case_type ?? ''}
              onChange={e => handleChange('case_type', e.target.value)}
              placeholder="例如：民事 / 刑事 / 行政"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">案由</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.case_reason ?? ''}
              onChange={e => handleChange('case_reason', e.target.value)}
              placeholder="案由"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">字號 / 案號</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.case_number ?? ''}
              onChange={e => handleChange('case_number', e.target.value)}
              placeholder="例如：112年度重訴字第123號"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">法院</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.court ?? ''}
              onChange={e => handleChange('court', e.target.value)}
              placeholder="例如：高雄地方法院"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">庭別</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.division ?? ''}
              onChange={e => handleChange('division', e.target.value)}
              placeholder="例如：民事一庭"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">進度</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.progress ?? ''}
              onChange={e => handleChange('progress', e.target.value)}
              placeholder="例如：已起訴 / 開庭中 / 判決"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">進度日期</label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2"
              value={form.progress_date ?? ''}
              onChange={e => handleChange('progress_date', e.target.value)}
            />
          </div>

          <label className="inline-flex items-center space-x-2 mt-2">
            <input
              type="checkbox"
              checked={!!form.is_closed}
              onChange={e => handleChange('is_closed', e.target.checked)}
            />
            <span className="text-sm text-gray-700">結案</span>
          </label>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSave}
            className={`px-4 py-2 rounded-lg text-white ${canSave ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed'}`}
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
