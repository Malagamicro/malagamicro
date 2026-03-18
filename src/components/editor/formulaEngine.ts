// ── Types ──────────────────────────────────────────
export type FileType = 'markdown' | 'spreadsheet' | 'text';
export type AiAction = 'write' | 'edit' | 'improve' | 'summarize';
export type ViewMode = 'edit' | 'preview' | 'split';

export interface ChatMessage { role: 'user' | 'assistant'; content: string; }
export interface SpreadsheetCell { value: string; formula?: string; }

// ── Formula Engine ─────────────────────────────────
export function colToIndex(col: string): number {
  let idx = 0;
  for (let i = 0; i < col.length; i++) idx = idx * 26 + (col.charCodeAt(i) - 64);
  return idx - 1;
}

export function indexToCol(idx: number): string {
  let s = '';
  idx++;
  while (idx > 0) { idx--; s = String.fromCharCode(65 + (idx % 26)) + s; idx = Math.floor(idx / 26); }
  return s;
}

function parseCellRef(ref: string): [number, number] | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  return [parseInt(m[2]) - 1, colToIndex(m[1])];
}

function getRangeValues(start: string, end: string, data: SpreadsheetCell[][]): string[] {
  const s = parseCellRef(start), e = parseCellRef(end);
  if (!s || !e) return [];
  const vals: string[] = [];
  for (let r = Math.min(s[0], e[0]); r <= Math.max(s[0], e[0]); r++)
    for (let c = Math.min(s[1], e[1]); c <= Math.max(s[1], e[1]); c++)
      vals.push(getCellDisplaySafe(data, r, c, new Set()));
  return vals;
}

function getRangeNumeric(start: string, end: string, data: SpreadsheetCell[][], visited: Set<string>): number[] {
  const s = parseCellRef(start), e = parseCellRef(end);
  if (!s || !e) return [];
  const vals: number[] = [];
  for (let r = Math.min(s[0], e[0]); r <= Math.max(s[0], e[0]); r++)
    for (let c = Math.min(s[1], e[1]); c <= Math.max(s[1], e[1]); c++) {
      const v = parseFloat(getCellDisplaySafe(data, r, c, visited));
      if (!isNaN(v)) vals.push(v);
    }
  return vals;
}

function getCellDisplaySafe(data: SpreadsheetCell[][], row: number, col: number, visited: Set<string>): string {
  const key = `${row},${col}`;
  if (visited.has(key)) return '#CIRC!';
  const cell = data[row]?.[col];
  if (!cell) return '';
  if (cell.formula) {
    visited.add(key);
    const result = evalFormula(cell.formula, data, visited);
    visited.delete(key);
    return result;
  }
  return cell.value;
}

export function getCellDisplay(data: SpreadsheetCell[][], row: number, col: number): string {
  return getCellDisplaySafe(data, row, col, new Set());
}

// Tokenizer for expression parser
type Token = { type: 'num'; val: number } | { type: 'str'; val: string } | { type: 'ref'; val: string }
  | { type: 'range'; val: string } | { type: 'op'; val: string } | { type: 'fn'; val: string }
  | { type: 'paren'; val: string } | { type: 'comma'; val?: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === ' ') { i++; continue; }
    if (ch === '(') { tokens.push({ type: 'paren', val: '(' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'paren', val: ')' }); i++; continue; }
    if (ch === ',') { tokens.push({ type: 'comma' }); i++; continue; }
    if (ch === '"') {
      let s = ''; i++;
      while (i < expr.length && expr[i] !== '"') { s += expr[i]; i++; }
      i++; tokens.push({ type: 'str', val: s }); continue;
    }
    if ('+-'.includes(ch) && (tokens.length === 0 || tokens[tokens.length-1].type === 'op' || (tokens[tokens.length-1].type === 'paren' && tokens[tokens.length-1].val === '('))) {
      // unary +/-
      let num = ch; i++;
      while (i < expr.length && /[\d.]/.test(expr[i])) { num += expr[i]; i++; }
      tokens.push({ type: 'num', val: parseFloat(num) }); continue;
    }
    if ('+-*/<>=!'.includes(ch)) {
      let op = ch; i++;
      if (i < expr.length && (expr[i] === '=' || expr[i] === '>')) { op += expr[i]; i++; }
      tokens.push({ type: 'op', val: op }); continue;
    }
    if (/\d/.test(ch)) {
      let num = ''; while (i < expr.length && /[\d.]/.test(expr[i])) { num += expr[i]; i++; }
      // Check if followed by % 
      if (i < expr.length && expr[i] === '%') { i++; tokens.push({ type: 'num', val: parseFloat(num) / 100 }); }
      else tokens.push({ type: 'num', val: parseFloat(num) });
      continue;
    }
    if (/[A-Z]/.test(ch)) {
      let id = ''; while (i < expr.length && /[A-Z0-9_]/.test(expr[i])) { id += expr[i]; i++; }
      // Check if it's a range like A1:B5
      if (i < expr.length && expr[i] === ':') {
        i++; let end = '';
        while (i < expr.length && /[A-Z0-9]/.test(expr[i])) { end += expr[i]; i++; }
        tokens.push({ type: 'range', val: `${id}:${end}` }); continue;
      }
      // Check if it's a function (followed by paren)
      if (i < expr.length && expr[i] === '(' && !/^\d/.test(id.replace(/[A-Z]+/, ''))) {
        const isRef = /^[A-Z]+\d+$/.test(id);
        if (!isRef) { tokens.push({ type: 'fn', val: id }); continue; }
      }
      // Cell reference or function name
      if (/^[A-Z]+\d+$/.test(id)) tokens.push({ type: 'ref', val: id });
      else tokens.push({ type: 'fn', val: id });
      continue;
    }
    i++; // skip unknown
  }
  return tokens;
}

// Recursive descent parser for arithmetic with cell refs and nested functions
function evalTokens(tokens: Token[], pos: { i: number }, data: SpreadsheetCell[][], visited: Set<string>): number | string {
  const result = parseAddSub(tokens, pos, data, visited);
  return result;
}

function parseAddSub(tokens: Token[], pos: { i: number }, data: SpreadsheetCell[][], visited: Set<string>): number | string {
  let left = parseMulDiv(tokens, pos, data, visited);
  if (typeof left === 'string') return left;
  while (pos.i < tokens.length && tokens[pos.i]?.type === 'op' && (tokens[pos.i].val === '+' || tokens[pos.i].val === '-')) {
    const op = tokens[pos.i].val; pos.i++;
    const right = parseMulDiv(tokens, pos, data, visited);
    if (typeof right === 'string') return right;
    left = op === '+' ? left + right : left - right;
  }
  return left;
}

function parseMulDiv(tokens: Token[], pos: { i: number }, data: SpreadsheetCell[][], visited: Set<string>): number | string {
  let left = parsePower(tokens, pos, data, visited);
  if (typeof left === 'string') return left;
  while (pos.i < tokens.length && tokens[pos.i]?.type === 'op' && (tokens[pos.i].val === '*' || tokens[pos.i].val === '/')) {
    const op = tokens[pos.i].val; pos.i++;
    const right = parsePower(tokens, pos, data, visited);
    if (typeof right === 'string') return right;
    if (op === '/') { if (right === 0) return '#DIV/0!' as string; left = left / right; }
    else left = left * right;
  }
  return left;
}

function parsePower(tokens: Token[], pos: { i: number }, data: SpreadsheetCell[][], visited: Set<string>): number | string {
  let base = parseUnary(tokens, pos, data, visited);
  if (typeof base === 'string') return base;
  while (pos.i < tokens.length && tokens[pos.i]?.type === 'op' && tokens[pos.i].val === '^') {
    pos.i++;
    const exp = parseUnary(tokens, pos, data, visited);
    if (typeof exp === 'string') return exp;
    base = Math.pow(base, exp);
  }
  return base;
}

function parseUnary(tokens: Token[], pos: { i: number }, data: SpreadsheetCell[][], visited: Set<string>): number | string {
  if (pos.i < tokens.length && tokens[pos.i]?.type === 'op' && tokens[pos.i].val === '-') {
    pos.i++;
    const v = parseAtom(tokens, pos, data, visited);
    return typeof v === 'string' ? v : -v;
  }
  if (pos.i < tokens.length && tokens[pos.i]?.type === 'op' && tokens[pos.i].val === '+') { pos.i++; }
  return parseAtom(tokens, pos, data, visited);
}

function collectFnArgs(tokens: Token[], pos: { i: number }, data: SpreadsheetCell[][], visited: Set<string>): (number | string | number[])[] {
  const args: (number | string | number[])[] = [];
  if (pos.i < tokens.length && tokens[pos.i]?.type === 'paren' && tokens[pos.i].val === ')') { pos.i++; return args; }
  while (pos.i < tokens.length) {
    // Check if next is a range
    if (tokens[pos.i]?.type === 'range') {
      const [s, e] = String(tokens[pos.i].val).split(':');
      const nums = getRangeNumeric(s, e, data, visited);
      args.push(nums);
      pos.i++;
    } else {
      const v = evalTokens(tokens, pos, data, visited);
      args.push(typeof v === 'string' ? v : v);
    }
    if (pos.i < tokens.length && tokens[pos.i]?.type === 'comma') { pos.i++; continue; }
    break;
  }
  if (pos.i < tokens.length && tokens[pos.i]?.type === 'paren' && tokens[pos.i].val === ')') pos.i++;
  return args;
}

function flatNums(args: (number | string | number[])[]): number[] {
  return args.flatMap(a => Array.isArray(a) ? a : typeof a === 'number' ? [a] : []);
}

function evalFunction(name: string, tokens: Token[], pos: { i: number }, data: SpreadsheetCell[][], visited: Set<string>): number | string {
  // pos.i should be right after '('
  const fn = name.toUpperCase();

  // Special handling for functions that need raw range access
  if (['VLOOKUP', 'BUSCARV', 'COUNTIF', 'CONTAR.SI', 'CONTARSI', 'SUMIF', 'SUMAR.SI', 'SUMARSI'].includes(fn)) {
    return evalSpecialFn(fn, tokens, pos, data, visited);
  }

  const args = collectFnArgs(tokens, pos, data, visited);
  const nums = flatNums(args);

  switch (fn) {
    case 'SUM': case 'SUMA': return nums.reduce((a, b) => a + b, 0);
    case 'AVERAGE': case 'PROMEDIO': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    case 'COUNT': case 'CONTAR': return nums.length;
    case 'COUNTA': case 'CONTARA': return args.flat().filter(v => v !== '' && v !== 0).length;
    case 'MIN': return nums.length ? Math.min(...nums) : 0;
    case 'MAX': return nums.length ? Math.max(...nums) : 0;
    case 'ABS': return nums.length ? Math.abs(nums[0]) : 0;
    case 'SQRT': case 'RAIZ': return nums.length ? Math.sqrt(nums[0]) : 0;
    case 'ROUND': case 'REDONDEAR': {
      const val = typeof args[0] === 'number' ? args[0] : 0;
      const dec = typeof args[1] === 'number' ? args[1] : 0;
      return Number(val.toFixed(dec));
    }
    case 'ROUNDUP': case 'REDONDEAR.MAS': {
      const val = typeof args[0] === 'number' ? args[0] : 0;
      const dec = typeof args[1] === 'number' ? args[1] : 0;
      const factor = Math.pow(10, dec);
      return Math.ceil(val * factor) / factor;
    }
    case 'ROUNDDOWN': case 'REDONDEAR.MENOS': {
      const val = typeof args[0] === 'number' ? args[0] : 0;
      const dec = typeof args[1] === 'number' ? args[1] : 0;
      const factor = Math.pow(10, dec);
      return Math.floor(val * factor) / factor;
    }
    case 'POWER': case 'POTENCIA': return typeof args[0] === 'number' && typeof args[1] === 'number' ? Math.pow(args[0], args[1]) : 0;
    case 'MOD': case 'RESIDUO': return typeof args[0] === 'number' && typeof args[1] === 'number' && args[1] !== 0 ? args[0] % args[1] : '#DIV/0!';
    case 'INT': case 'ENTERO': return nums.length ? Math.floor(nums[0]) : 0;
    case 'CEILING': case 'MULTIPLO.SUPERIOR': return typeof args[0] === 'number' && typeof args[1] === 'number' && args[1] !== 0 ? Math.ceil(args[0] / args[1]) * args[1] : 0;
    case 'FLOOR': case 'MULTIPLO.INFERIOR': return typeof args[0] === 'number' && typeof args[1] === 'number' && args[1] !== 0 ? Math.floor(args[0] / args[1]) * args[1] : 0;
    case 'LN': return nums.length ? Math.log(nums[0]) : 0;
    case 'LOG': case 'LOG10': return nums.length ? Math.log10(nums[0]) : 0;
    case 'PI': return Math.PI;
    case 'RAND': case 'ALEATORIO': return Math.random();
    case 'CONCATENATE': case 'CONCATENAR': case 'CONCAT':
      return args.map(a => Array.isArray(a) ? a.join('') : String(a)).join('');
    case 'IF': case 'SI': {
      const cond = typeof args[0] === 'number' ? args[0] !== 0 : Boolean(args[0]);
      return cond ? (args[1] ?? 0) as number | string : (args[2] ?? 0) as number | string;
    }
    case 'AND': case 'Y': return flatNums(args).every(v => v !== 0) ? 1 : 0;
    case 'OR': case 'O': return flatNums(args).some(v => v !== 0) ? 1 : 0;
    case 'NOT': case 'NO': return nums.length && nums[0] === 0 ? 1 : 0;
    case 'IFERROR': case 'SI.ERROR': {
      const val = args[0];
      if (typeof val === 'string' && val.startsWith('#')) return (args[1] ?? 0) as number | string;
      return (val ?? 0) as number | string;
    }
    default: return '#NAME?';
  }
}

function evalSpecialFn(fn: string, tokens: Token[], pos: { i: number }, data: SpreadsheetCell[][], visited: Set<string>): number | string {
  // Collect raw tokens until closing paren, splitting by comma at depth 0
  const rawArgs: Token[][] = [[]];
  let depth = 0;
  while (pos.i < tokens.length) {
    const t = tokens[pos.i];
    if (t.type === 'paren' && t.val === '(') { depth++; rawArgs[rawArgs.length - 1].push(t); pos.i++; }
    else if (t.type === 'paren' && t.val === ')') {
      if (depth === 0) { pos.i++; break; }
      depth--; rawArgs[rawArgs.length - 1].push(t); pos.i++;
    }
    else if (t.type === 'comma' && depth === 0) { rawArgs.push([]); pos.i++; }
    else { rawArgs[rawArgs.length - 1].push(t); pos.i++; }
  }

  if (fn === 'VLOOKUP' || fn === 'BUSCARV') {
    // VLOOKUP(searchVal, range, colIndex, [exactMatch])
    const searchVal = rawArgs[0] ? evalTokens(rawArgs[0], { i: 0 }, data, visited) : '';
    const rangeToken = rawArgs[1]?.find(t => t.type === 'range');
    const colIdx = rawArgs[2] ? evalTokens(rawArgs[2], { i: 0 }, data, visited) : 1;
    if (!rangeToken || typeof colIdx !== 'number') return '#VALUE!';
    const [rs, re] = rangeToken.val.split(':');
    const s = parseCellRef(rs), e = parseCellRef(re);
    if (!s || !e) return '#REF!';
    for (let r = s[0]; r <= e[0]; r++) {
      const cellVal = getCellDisplaySafe(data, r, s[1], visited);
      const numSearch = typeof searchVal === 'number' ? searchVal : parseFloat(String(searchVal));
      const numCell = parseFloat(cellVal);
      const match = (!isNaN(numSearch) && !isNaN(numCell)) ? numSearch === numCell : String(searchVal).toUpperCase() === cellVal.toUpperCase();
      if (match) {
        const targetCol = s[1] + Math.round(colIdx) - 1;
        return parseFloat(getCellDisplaySafe(data, r, targetCol, visited)) || getCellDisplaySafe(data, r, targetCol, visited) as any;
      }
    }
    return '#N/A';
  }

  if (fn === 'COUNTIF' || fn === 'CONTAR.SI' || fn === 'CONTARSI') {
    const rangeToken = rawArgs[0]?.find(t => t.type === 'range');
    const criteria = rawArgs[1] ? evalTokens(rawArgs[1], { i: 0 }, data, visited) : '';
    if (!rangeToken) return '#VALUE!';
    return countIf(rangeToken.val, criteria, data, visited);
  }

  if (fn === 'SUMIF' || fn === 'SUMAR.SI' || fn === 'SUMARSI') {
    const rangeToken = rawArgs[0]?.find(t => t.type === 'range');
    const criteria = rawArgs[1] ? evalTokens(rawArgs[1], { i: 0 }, data, visited) : '';
    const sumRangeToken = rawArgs[2]?.find(t => t.type === 'range');
    if (!rangeToken) return '#VALUE!';
    return sumIf(rangeToken.val, criteria, sumRangeToken?.val, data, visited);
  }

  return '#NAME?';
}

function matchesCriteria(cellVal: string, criteria: number | string): boolean {
  const c = String(criteria).trim();
  const num = parseFloat(cellVal);
  // Operator criteria: ">5", "<=10", "<>0"
  const opMatch = c.match(/^(>=|<=|<>|>|<|=)\s*(.+)$/);
  if (opMatch) {
    const cmpVal = parseFloat(opMatch[2]);
    if (isNaN(num) || isNaN(cmpVal)) return false;
    switch (opMatch[1]) {
      case '>': return num > cmpVal;
      case '<': return num < cmpVal;
      case '>=': return num >= cmpVal;
      case '<=': return num <= cmpVal;
      case '=': return num === cmpVal;
      case '<>': return num !== cmpVal;
    }
  }
  // Exact match (case insensitive)
  const cNum = parseFloat(c);
  if (!isNaN(cNum) && !isNaN(num)) return num === cNum;
  return cellVal.toUpperCase() === c.toUpperCase();
}

function countIf(range: string, criteria: number | string, data: SpreadsheetCell[][], visited: Set<string>): number {
  const [rs, re] = range.split(':');
  const s = parseCellRef(rs), e = parseCellRef(re);
  if (!s || !e) return 0;
  let count = 0;
  for (let r = s[0]; r <= e[0]; r++)
    for (let c = s[1]; c <= e[1]; c++)
      if (matchesCriteria(getCellDisplaySafe(data, r, c, visited), criteria)) count++;
  return count;
}

function sumIf(range: string, criteria: number | string, sumRange: string | undefined, data: SpreadsheetCell[][], visited: Set<string>): number {
  const [rs, re] = range.split(':');
  const s = parseCellRef(rs), e = parseCellRef(re);
  if (!s || !e) return 0;
  const sr = sumRange ? parseCellRef(sumRange.split(':')[0]) : s;
  let total = 0;
  for (let r = s[0]; r <= e[0]; r++)
    for (let c = s[1]; c <= e[1]; c++) {
      if (matchesCriteria(getCellDisplaySafe(data, r, c, visited), criteria)) {
        const sumR = sr ? r - s[0] + sr[0] : r;
        const sumC = sr ? c - s[1] + sr[1] : c;
        const v = parseFloat(getCellDisplaySafe(data, sumR, sumC, visited));
        if (!isNaN(v)) total += v;
      }
    }
  return total;
}

// Comparison in IF: handle >, <, >=, <=, =, <> operators at expression level
function parseComparison(tokens: Token[], pos: { i: number }, data: SpreadsheetCell[][], visited: Set<string>): number | string {
  const left = parseAddSub(tokens, pos, data, visited);
  if (pos.i < tokens.length && tokens[pos.i]?.type === 'op' && ['>', '<', '>=', '<=', '=', '<>', '!='].includes(String(tokens[pos.i].val))) {
    const op = tokens[pos.i].val; pos.i++;
    const right = parseAddSub(tokens, pos, data, visited);
    if (typeof left === 'string' || typeof right === 'string') {
      const l = String(left), r = String(right);
      switch (op) { case '=': return l === r ? 1 : 0; case '<>': case '!=': return l !== r ? 1 : 0; default: return 0; }
    }
    switch (op) {
      case '>': return left > right ? 1 : 0;
      case '<': return left < right ? 1 : 0;
      case '>=': return left >= right ? 1 : 0;
      case '<=': return left <= right ? 1 : 0;
      case '=': return left === right ? 1 : 0;
      case '<>': case '!=': return left !== right ? 1 : 0;
    }
  }
  return left;
}

function parseAtom(tokens: Token[], pos: { i: number }, data: SpreadsheetCell[][], visited: Set<string>): number | string {
  if (pos.i >= tokens.length) return 0;
  const t = tokens[pos.i];
  if (t.type === 'num') { pos.i++; return t.val; }
  if (t.type === 'str') { pos.i++; return t.val; }
  if (t.type === 'ref') {
    pos.i++;
    const ref = parseCellRef(t.val);
    if (!ref) return '#REF!';
    const v = getCellDisplaySafe(data, ref[0], ref[1], visited);
    const n = parseFloat(v);
    return isNaN(n) ? (v || 0) : n;
  }
  if (t.type === 'range') {
    pos.i++;
    const [s, e] = t.val.split(':');
    const nums = getRangeNumeric(s, e, data, visited);
    return nums.reduce((a, b) => a + b, 0); // default: sum ranges in arithmetic context
  }
  if (t.type === 'fn') {
    const fname = t.val; pos.i++;
    if (pos.i < tokens.length && tokens[pos.i]?.type === 'paren' && tokens[pos.i].val === '(') {
      pos.i++;
      return evalFunction(fname, tokens, pos, data, visited);
    }
    return '#NAME?';
  }
  if (t.type === 'paren' && t.val === '(') {
    pos.i++;
    const v = parseComparison(tokens, pos, data, visited);
    if (pos.i < tokens.length && tokens[pos.i]?.type === 'paren' && tokens[pos.i].val === ')') pos.i++;
    return v;
  }
  pos.i++;
  return 0;
}

function evalFormula(formula: string, data: SpreadsheetCell[][], visited: Set<string> = new Set()): string {
  try {
    const tokens = tokenize(formula.toUpperCase().trim());
    if (tokens.length === 0) return '';
    const result = parseComparison(tokens, { i: 0 }, data, visited);
    if (typeof result === 'number') {
      if (!isFinite(result)) return '#DIV/0!';
      return Number.isInteger(result) ? String(result) : String(Math.round(result * 1e10) / 1e10);
    }
    return String(result);
  } catch {
    return '#ERROR!';
  }
}

// Keep backward compat wrapper
export function evaluateFormula(formula: string, data: SpreadsheetCell[][]): string {
  return evalFormula(formula, data);
}
