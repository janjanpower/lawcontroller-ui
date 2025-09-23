// src/utils/templateEngine.ts
// Lightweight template renderer with filters + safe-ish formula eval.

type Dict = Record<string, any>;

const getByPath = (obj: Dict, path: string) =>
  path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const filters = {
  upper: (v: any) => (v == null ? '' : String(v).toUpperCase()),
  lower: (v: any) => (v == null ? '' : String(v).toLowerCase()),
  currency: (v: any, currency = 'TWD') => {
    const n = typeof v === 'string' ? Number(v.replace(/[^\d.-]/g, '')) : Number(v);
    return new Intl.NumberFormat('zh-TW', { style: 'currency', currency, minimumFractionDigits: 0 }).format(isFinite(n) ? n : 0);
  },
  date: (v: any, fmt = 'YYYY-MM-DD') => {
    const d = v ? new Date(v) : new Date();
    const pad = (x: number) => String(x).padStart(2, '0');
    const map: Record<string,string> = {
      'YYYY': String(d.getFullYear()),
      'MM': pad(d.getMonth() + 1),
      'DD': pad(d.getDate()),
    };
    return fmt.replace(/YYYY|MM|DD/g, (t) => map[t]);
  },
};

export function renderString(tpl: string, ctx: Dict): string {
  // {{ path | filter('arg') | filter2 }}
  return tpl.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expr: string) => {
    const parts = expr.split('|').map(s => s.trim());
    let value: any = null;

    // path / literal
    const first = parts.shift()!;
    if (/^['"]/.test(first)) {
      value = first.replace(/^['"]|['"]$/g, '');
    } else if (first === 'now') {
      value = new Date().toISOString();
    } else if (first === 'sys.day') {
      value = String(new Date().getDate());
    } else {
      value = getByPath(ctx, first);
    }

    // apply filters
    for (const part of parts) {
      const m = /^(\w+)(?:\((.*)\))?$/.exec(part);
      if (!m) continue;
      const [, fname, rawArgs] = m;
      const fn = (filters as any)[fname];
      if (!fn) continue;

      const args: any[] = [];
      if (rawArgs?.trim()) {
        // parse simple comma separated string/numeric args
        rawArgs.split(',').forEach(a => {
          const s = a.trim();
          if (/^['"]/.test(s)) args.push(s.replace(/^['"]|['"]$/g, ''));
          else if (!isNaN(Number(s))) args.push(Number(s));
          else args.push(s);
        });
      }
      value = fn(value, ...args);
    }
    return value == null ? '' : String(value);
  });
}

// very small expression evaluator supporting + - * / () and identifiers from scope
export function evalExpr(expr: string, scope: Dict): number {
  // sanitize: allow numbers, ops, dots, identifiers, spaces
  if (!/^[\d\s+*\-\/().,\w]+$/.test(expr)) throw new Error('Bad expression');
  // create a function limited by scope keys
  const keys = Object.keys(scope);
  const vals = Object.values(scope);
  // eslint-disable-next-line no-new-func
  const fn = new Function(...keys, `return (${expr});`);
  const res = fn(...vals);
  return Number(res) || 0;
}

// helper: compute table row with formulas
export function computeRow(row: Dict, columns: Array<{ key: string; formula?: string }>) {
  const scope = { ...row };
  const out: Dict = { ...row };
  for (const col of columns) {
    if (col.formula) {
      try { out[col.key] = evalExpr(col.formula, scope); }
      catch { out[col.key] = 0; }
    }
  }
  return out;
}
