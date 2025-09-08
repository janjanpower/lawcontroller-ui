// src/components/FolderTree.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, Plus, Link } from "lucide-react";

type NodeType = "folder" | "file";

interface FileNode {
  id: string;
  name: string;
  type: "file";
  size?: number;
  modified?: string;
  s3_key?: string;
}

interface FolderNode {
  id: string;
  name: string;
  type: "folder";
  path: string;
  children?: (FolderNode | FileNode)[];
  _loaded?: boolean;
  _open?: boolean;
}

interface FolderTreeProps {
  apiBase?: string;   // default: "/api"
  firmCode: string;
  caseId: string;
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function FolderTree({ apiBase = "/api", firmCode, caseId }: FolderTreeProps) {
  const [root, setRoot] = useState<FolderNode | null>(null);
  const queryFirm = useMemo(() => `firm_code=${encodeURIComponent(firmCode)}`, [firmCode]);

  useEffect(() => {
    (async () => {
      const url = `${apiBase}/files/tree?${queryFirm}&case_id=${encodeURIComponent(caseId)}`;
      const data = await getJSON<FolderNode>(url);
      setRoot({ ...data, _open: true, _loaded: true });
    })().catch((e) => console.error("load tree error:", e));
  }, [apiBase, queryFirm, caseId]);

  const toggle = async (node: FolderNode) => {
    const willOpen = !node._open;
    node._open = willOpen;

    if (willOpen && !node._loaded) {
      const url = `${apiBase}/files/children?${queryFirm}&case_id=${encodeURIComponent(caseId)}&parent_path=${encodeURIComponent(node.path)}`;
      const data = await getJSON<{ folders: FolderNode[]; files: FileNode[] }>(url);
      node.children = [
        ...data.folders.map((f) => ({ ...f, _open: false, _loaded: false })),
        ...data.files,
      ];
      node._loaded = true;
    }
    setRoot((prev) => (prev ? { ...prev } : prev));
  };

  const handleUpload = async (node: FolderNode) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      const fd = new FormData();
      fd.append("case_id", caseId);
      fd.append("folder_path", node.path);
      fd.append("file", file);

      const res = await fetch(`${apiBase}/files/upload?${queryFirm}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        alert("上傳失敗：" + (await res.text()));
        return;
      }
      // reload current node content, keep open
      node._loaded = false;
      node._open = true;
      await toggle(node); // this will open->load
      if (!node._open) await toggle(node); // keep open
    };
    input.click();
  };

  const handleOpenFile = async (file: FileNode) => {
    if (!file.s3_key) return;
    const res = await getJSON<{ url: string }>(`${apiBase}/files/presign?${queryFirm}&s3_key=${encodeURIComponent(file.s3_key)}`);
    window.open(res.url, "_blank");
  };

  if (!root) return <div className="text-sm text-gray-500 p-2">載入資料夾中…</div>;

  return (
    <div className="text-sm">
      <TreeNode node={root} onToggle={toggle} onUpload={handleUpload} onOpenFile={handleOpenFile} />
    </div>
  );
}

function TreeNode({
  node,
  onToggle,
  onUpload,
  onOpenFile,
  level = 0,
}: {
  node: FolderNode | FileNode;
  onToggle: (n: FolderNode) => Promise<void> | void;
  onUpload: (n: FolderNode) => Promise<void> | void;
  onOpenFile: (f: FileNode) => Promise<void> | void;
  level?: number;
}) {
  const isFolder = node.type === "folder";
  return (
    <div>
      <div
        className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-default"
        style={{ paddingLeft: level * 12 + 8 }}
        onDoubleClick={() => isFolder && onToggle(node as FolderNode)}
      >
        {isFolder ? (
          <button onClick={() => onToggle(node as FolderNode)}>
            {(node as FolderNode)._open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4 h-4" />
        )}

        {isFolder ? (
          (node as FolderNode)._open ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />
        ) : (
          <File className="w-4 h-4" />
        )}

        <span
          className={`truncate ${node.type === "file" ? "text-blue-700 hover:underline cursor-pointer" : ""}`}
          onClick={() => {
            if (node.type === "file") onOpenFile(node as FileNode);
          }}
          title={node.name}
        >
          {node.name}
        </span>

        {isFolder && (
          <button
            className="ml-auto text-xs flex items-center gap-1 hover:underline"
            onClick={() => onUpload(node as FolderNode)}
            title="上傳到這個資料夾"
          >
            <Plus className="w-3 h-3" /> 上傳
          </button>
        )}
      </div>

      {isFolder && (node as FolderNode)._open && (node as FolderNode).children && (
        <div className="mt-1">
          {(node as FolderNode).children!.map((child) => (
            <TreeNode
              key={`${child.type}-${"id" in child ? child.id : child.name}`}
              node={child}
              onToggle={onToggle}
              onUpload={onUpload}
              onOpenFile={onOpenFile}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
