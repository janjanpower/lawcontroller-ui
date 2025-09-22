import type { VariableDef } from "../canvas/variables";

interface Props {
  onInsert: (value: string) => void;
}

export default function VariableInserter({ onInsert }: Props) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {ALL_VARS.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => onInsert(`{{${v.key}}}`)}
          className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
