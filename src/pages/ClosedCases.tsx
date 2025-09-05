// src/pages/ClosedCases.tsx
export default function ClosedCases() {
  // TODO: 你可以沿用案件列表 Table，只是預設過濾 status=closed 或 stage 包含「已結案」
  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold text-[#334d6d] mb-4">結案案件</h1>
      {/* 放你的案件列表元件，帶預設過濾條件 */}
      {/* <CaseTable defaultFilter={{ closed: true }} /> */}
    </div>
  );
}
