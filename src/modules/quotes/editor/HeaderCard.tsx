import React from "react";

export default function HeaderCard({
  content,
  onChange,
}: {
  content: any;
  onChange: (c: any) => void;
}) {
  return (
    <div>
      <input
        type="text"
        className="w-full text-xl font-bold border-b"
        value={content.text || ""}
        onChange={(e) => onChange({ ...content, text: e.target.value })}
        placeholder="輸入標題..."
      />
    </div>
  );
}
