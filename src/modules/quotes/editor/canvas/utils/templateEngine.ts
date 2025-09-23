// utils/templateEngine.ts

/**
 * 將文字中的 {{var}} 變數替換為 context 值
 * @param template 原始模板字串
 * @param context 變數上下文 (case, firm, sys)
 */
export function renderString(template: string, context: Record<string, any>): string {
  if (!template) return "";

  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const path = key.trim().split(".");
    let value: any = context;

    for (const p of path) {
      if (value && typeof value === "object" && p in value) {
        value = value[p];
      } else {
        value = "";
        break;
      }
    }

    // 🟦 系統時間特殊處理
    if (key === "sys.year") {
      // 民國年：西元 - 1911
      const year = new Date().getFullYear() - 1911;
      return year.toString();
    }
    if (key === "sys.month") {
      // 不補 0
      return (new Date().getMonth() + 1).toString();
    }
    if (key === "sys.day") {
      // 不補 0
      return new Date().getDate().toString();
    }

    return value != null ? String(value) : "";
  });
}
