import React from "react";
import VariableAwareTextarea from "../../../components/VariableAwareTextarea";

export default function TextCard({
  content,
  onChange,
}: {
  content: any;
  onChange: (c: any) => void;
}) {
  return (
    <VariableAwareTextarea
      className="w-full border rounded p-2"
      value={content.text || ""}
      onChange={(e) => onChange({ ...content, text: e.target.value })}
      placeholder="輸入文字..."
      rows={4}
    />
  );
}
