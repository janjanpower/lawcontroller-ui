import React, { useEffect, useMemo, useState } from "react";
import { FileText, Download } from "lucide-react";
import { getFirmCodeOrThrow } from "../utils/api";

type FileItem = {
  id: string;
  folder_id: string;
  name: string;
  size_bytes?: number;
  content_type?: string;
  storage_url?: string;
  created_at?: string;
};

type FolderItem = {
  id: string;
  folder_name: string;   // 例如「起訴」、「判決」…
  folder_type: string;   // stage | default
};

interface Props {
  caseId: string;
}

export default function CaseProgressFiles({ caseId }: Props) {
  const [loading, setLoading] = useState(true);
  const [stageFiles, setStageFiles] = useState<FileItem[]>([]);
  const [stageFolders, setStageFolders] = useState<FolderItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const firmCode = getFirmCodeOrThrow();
        const res = await fetch(`/api/cases/${caseId}/files?firm_code=${encodeURIComponent(firmCode)}`);
        const data = await res.json();

        // 後端回傳：{ pleadings:[], info:[], progress:[], stage:[], folders:[] }
        const folders: FolderItem[] = (data.folders || [])
          .filter((f: any) => f.folder_type === "stage")
          .map((f: any) => ({
            id: f.id,
            folder_name: f.folder_name,
            folder_type: f.folder_type,
          }));

        setStageFolders(folders);
        setStageFiles(data.stage || []);
      } catch (e: any) {
        setError(e?.message || "載入失敗");
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId]);

  // 依 stage 資料夾分組（只顯示「有檔案的階段」）
  const grouped = useMemo(() => {
    const byId: Record<string, FileItem[]> = {};
    stageFiles.forEach((f) => {
      byId[f.folder_id] = byId[f.folder_id] || [];
      byId[f.folder_id].push(f);
    });

    // 把有檔案的階段取出並排序（可自訂排序邏輯）
    const result = stageFolders
      .filter((sf) => byId[sf.id]?.length)
      .map((sf) => ({ folderId: sf.id, name: sf.folder_name, files: byId[sf.id] }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

    return result;
  }, [stageFiles, stageFolders]);

  const handleDownload = async (fileId: string) => {
    try {
      // 優先用 /url（需 firm_code）
      const firmCode = getFirmCodeOrThrow();
      const res = await fetch(`/api/files/${fileId}/url?firm_code=${encodeURIComponent(firmCode)}`);
      let data;
      if (res.ok) {
        data = await res.json();
        const href = data.url || data.download_url || data.storage_url;
        if (href) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
      }
      // 備用：/download（若你有開）
      const fallback = await fetch(`/api/files/${fileId}/download`);
      if (fallback.ok) {
        const d = await fallback.json();
        const href = d.download_url || d.url || d.storage_url;
        if (href) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
      }
      alert("取得下載連結失敗");
    } catch (e) {
      console.error("下載失敗", e);
      alert("下載失敗");
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">載入中…</div>;
  }
  if (error) {
    return <div className="text-sm text-red-600">錯誤：{error}</div>;
  }
  if (!grouped.length) {
    return <div className="text-sm text-gray-500">目前沒有階段檔案</div>;
  }

  return (
    <div className="space-y-6">
      {grouped.map((stage) => (
        <div key={stage.folderId} className="border rounded-lg">
          {/* ✅ 只有純文字標題，沒有資料夾 Icon */}
          <div className="px-3 py-2 border-b bg-gray-50 text-sm font-semibold text-gray-700">
            {stage.name}
          </div>
          <ul className="p-2 space-y-2">
            {stage.files.map((f) => (
              <li key={f.id} className="flex items-center justify-between bg-white rounded-md px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-800">{f.name}</span>
                </div>
                <button
                  onClick={() => handleDownload(f.id)}
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <Download className="w-4 h-4" />
                  下載
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
