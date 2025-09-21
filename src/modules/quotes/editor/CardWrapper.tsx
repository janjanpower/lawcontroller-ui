import React, { PropsWithChildren, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function CardWrapper({
  id,
  children,
}: PropsWithChildren<{ id: string }>) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg bg-white shadow p-3"
    >
      <div className="flex justify-between items-center">
        <div {...attributes} {...listeners} className="cursor-grab text-sm">
          ⠿
        </div>
        <button
          className="text-xs text-blue-600"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? "展開" : "收合"}
        </button>
      </div>
      {!collapsed && <div className="mt-2">{children}</div>}
    </div>
  );
}
