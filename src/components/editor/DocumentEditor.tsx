import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText, Save, Download, Sparkles, Send, Loader2, X,
  Bold, Italic, Heading1, Heading2, List, ListOrdered,
  Minus, Quote, Code, Trash2,
  PanelRightOpen, PanelRightClose, Cloud, ArrowLeft,
  FileDown, Plus, Table, FileSpreadsheet, StickyNote,
  Upload, Share2, Eye, EyeOff, Columns2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import jsPDF from 'jspdf';

// ── Types ──────────────────────────────────────────
type FileType = 'markdown' | 'spreadsheet' | 'text';
type AiAction = 'write' | 'edit' | 'improve' | 'summarize';
type ViewMode = 'edit' | 'preview' | 'split';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }
interface SpreadsheetCell { value: string; formula?: string; }

interface DocumentEditorProps {
  initialContent?: string;
  initialTitle?: string;
  onSaveToCloud?: (title: string, content: string) => Promise<void>;
  showBackButton?: boolean;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

// ── Formula Engine ─────────────────────────────────
function colToIndex(col: string): number {
  let idx = 0;
  for (let i = 0; i < col.length; i++) idx = idx * 26 + (col.charCodeAt(i) - 64);
  return idx - 1;
}

function indexToCol(idx: number): string {
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

function getCellDisplay(data: SpreadsheetCell[][], row: number, col: number): string {
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
function evaluateFormula(formula: string, data: SpreadsheetCell[][]): string {
  return evalFormula(formula, data);
}

// ── Spreadsheet Component ──────────────────────────
function SpreadsheetEditor({ data, onChange }: { data: SpreadsheetCell[][]; onChange: (d: SpreadsheetCell[][]) => void }) {
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [editingCell, setEditingCell] = useState<[number, number] | null>(null);
  const [editValue, setEditValue] = useState('');
  const formulaBarRef = useRef<HTMLInputElement>(null);

  const updateCell = (row: number, col: number, rawValue: string) => {
    const isFormula = rawValue.startsWith('=');
    const newData = data.map((r, ri) => r.map((c, ci) => {
      if (ri === row && ci === col) {
        return isFormula
          ? { value: '', formula: rawValue.slice(1) }
          : { value: rawValue, formula: undefined };
      }
      return c;
    }));
    onChange(newData);
  };

  const commitEdit = () => {
    if (editingCell) {
      updateCell(editingCell[0], editingCell[1], editValue);
      setEditingCell(null);
    }
  };

  const startEdit = (row: number, col: number) => {
    setEditingCell([row, col]);
    const cell = data[row]?.[col];
    setEditValue(cell?.formula ? `=${cell.formula}` : cell?.value || '');
  };

  const cellLabel = selectedCell
    ? `${String.fromCharCode(65 + (selectedCell[1] % 26))}${selectedCell[0] + 1}`
    : '';

  const selectedCellRaw = selectedCell
    ? (data[selectedCell[0]]?.[selectedCell[1]]?.formula
      ? `=${data[selectedCell[0]][selectedCell[1]].formula}`
      : data[selectedCell[0]]?.[selectedCell[1]]?.value || '')
    : '';

  const addRow = () => {
    const cols = data[0]?.length || 5;
    onChange([...data, Array.from({ length: cols }, () => ({ value: '' }))]);
  };
  const addCol = () => onChange(data.map(r => [...r, { value: '' }]));
  const deleteRow = (idx: number) => { if (data.length > 1) onChange(data.filter((_, i) => i !== idx)); };
  const deleteCol = (idx: number) => { if ((data[0]?.length || 0) > 1) onChange(data.map(r => r.filter((_, i) => i !== idx))); };

  return (
    <div className="h-full flex flex-col">
      {/* Formula bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/30">
        <span className="text-xs font-mono w-10 text-center text-muted-foreground font-semibold">{cellLabel}</span>
        <span className="text-muted-foreground text-xs">ƒx</span>
        <input
          ref={formulaBarRef}
          className="flex-1 h-7 px-2 text-sm bg-background border rounded outline-none focus:ring-1 ring-primary font-mono"
          value={editingCell ? editValue : selectedCellRaw}
          onChange={e => {
            if (editingCell) setEditValue(e.target.value);
            else if (selectedCell) {
              startEdit(selectedCell[0], selectedCell[1]);
              setEditValue(e.target.value);
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') { commitEdit(); formulaBarRef.current?.blur(); }
            if (e.key === 'Escape') { setEditingCell(null); }
          }}
          onBlur={commitEdit}
          placeholder="Introduce valor o fórmula (=SUM, =AVERAGE, =IF...)"
        />
      </div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/20">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addRow}>
          <Plus className="h-3 w-3 mr-1" /> Fila
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCol}>
          <Plus className="h-3 w-3 mr-1" /> Columna
        </Button>
        {selectedCell && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => deleteRow(selectedCell[0])}>
              Eliminar fila
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => deleteCol(selectedCell[1])}>
              Eliminar columna
            </Button>
          </>
        )}
        <div className="ml-auto text-[10px] text-muted-foreground">
          =SUM =AVERAGE =COUNT =MIN =MAX =IF =VLOOKUP =COUNTIF =SUMIF =ROUND =MOD =SQRT =IFERROR · Aritmética: =A1+B2*3
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="overflow-auto">
          <table className="border-collapse w-full min-w-max">
            <thead>
              <tr>
                <th className="w-10 bg-muted/50 border text-xs text-center text-muted-foreground p-1 sticky left-0 z-10">#</th>
                {data[0]?.map((_, ci) => (
                  <th key={ci} className="bg-muted/50 border text-xs text-center text-muted-foreground p-1 min-w-[100px]">
                    {String.fromCharCode(65 + (ci % 26))}
                    {ci >= 26 ? String.fromCharCode(65 + Math.floor(ci / 26) - 1) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, ri) => (
                <tr key={ri}>
                  <td className="bg-muted/30 border text-xs text-center text-muted-foreground p-1 select-none sticky left-0 z-10">{ri + 1}</td>
                  {row.map((cell, ci) => {
                    const isEditing = editingCell?.[0] === ri && editingCell?.[1] === ci;
                    const isSelected = selectedCell?.[0] === ri && selectedCell?.[1] === ci;
                    const displayVal = cell.formula ? evaluateFormula(cell.formula, data) : cell.value;
                    const hasFormula = !!cell.formula;
                    return (
                      <td
                        key={ci}
                        className={cn(
                          "border p-0 relative",
                          isSelected && "ring-2 ring-primary ring-inset",
                          hasFormula && !isEditing && "bg-blue-50/50 dark:bg-blue-950/20"
                        )}
                        onClick={() => { setSelectedCell([ri, ci]); if (!isEditing) setEditingCell(null); }}
                        onDoubleClick={() => startEdit(ri, ci)}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            className="w-full h-full px-2 py-1.5 text-xs bg-background border-none outline-none font-mono"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { commitEdit(); e.preventDefault(); }
                              if (e.key === 'Escape') setEditingCell(null);
                              if (e.key === 'Tab') { e.preventDefault(); commitEdit(); const nc = ci + 1; if (nc < row.length) { setSelectedCell([ri, nc]); startEdit(ri, nc); } }
                            }}
                            onBlur={commitEdit}
                          />
                        ) : (
                          <div
                            className={cn(
                              "w-full px-2 py-1.5 text-xs min-h-[28px] cursor-cell",
                              displayVal.startsWith('#') && "text-destructive font-semibold"
                            )}
                          >
                            {displayVal}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
}

// ── CSV/Excel import helpers ───────────────────────
function parseCSV(text: string): SpreadsheetCell[][] {
  const lines = text.split('\n').filter(l => l.trim());
  return lines.map(line => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) { cells.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    cells.push(current.trim());
    return cells.map(v => ({ value: v }));
  });
}

async function parseExcelFile(file: File): Promise<SpreadsheetCell[][]> {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [[{ value: '' }]];
  const data: SpreadsheetCell[][] = [];
  ws.eachRow((row) => {
    const cells: SpreadsheetCell[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push({ value: String(cell.value ?? '') });
    });
    data.push(cells);
  });
  // Normalize column count
  const maxCols = Math.max(...data.map(r => r.length), 1);
  return data.map(r => {
    while (r.length < maxCols) r.push({ value: '' });
    return r;
  });
}

// ── Main Menu Component ────────────────────────────
function EditorMainMenu({ onCreateNew, onImportFile }: {
  onCreateNew: (type: FileType) => void;
  onImportFile: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileTypes = [
    { type: 'markdown' as FileType, icon: FileText, label: 'Documento Markdown', desc: 'Texto con formato, títulos, listas, código', color: 'text-blue-500', bg: 'bg-blue-500/10 hover:bg-blue-500/20' },
    { type: 'spreadsheet' as FileType, icon: FileSpreadsheet, label: 'Hoja de Cálculo', desc: 'Tablas, datos, importar CSV/Excel', color: 'text-emerald-500', bg: 'bg-emerald-500/10 hover:bg-emerald-500/20' },
    { type: 'text' as FileType, icon: StickyNote, label: 'Texto Plano', desc: 'Notas rápidas sin formato', color: 'text-amber-500', bg: 'bg-amber-500/10 hover:bg-amber-500/20' },
  ];

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Editor IA</h1>
          <p className="text-muted-foreground">Crea documentos, hojas de cálculo y notas con asistencia de inteligencia artificial</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {fileTypes.map(ft => (
            <button
              key={ft.type}
              onClick={() => onCreateNew(ft.type)}
              className={cn(
                "flex flex-col items-center gap-3 p-6 rounded-xl border transition-all duration-200",
                ft.bg, "border-transparent"
              )}
            >
              <ft.icon className={cn("h-10 w-10", ft.color)} />
              <div className="text-center">
                <p className="font-semibold text-sm">{ft.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{ft.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Importar archivo (CSV, Excel, Markdown, TXT)
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.md,.txt,.tsv"
            className="hidden"
            onChange={handleFileImport}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Editor ────────────────────────────────────
export function DocumentEditor({ initialContent = '', initialTitle = '', onSaveToCloud, showBackButton = true }: DocumentEditorProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [fileType, setFileType] = useState<FileType | null>(initialContent ? 'markdown' : null);
  const [title, setTitle] = useState(initialTitle || 'Sin título');
  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showAi, setShowAi] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction>('write');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetCell[][]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // If initial content is provided, skip menu
  useEffect(() => {
    if (initialContent) setFileType('markdown');
  }, [initialContent]);

  // ── Create / Import ──
  const handleCreateNew = (type: FileType) => {
    setFileType(type);
    setContent('');
    setTitle('Sin título');
    if (type === 'spreadsheet') {
      setSpreadsheetData(
        Array.from({ length: 10 }, () => Array.from({ length: 6 }, () => ({ value: '' })))
      );
    }
    if (type === 'markdown') setViewMode('split');
    else setViewMode('edit');
  };

  const handleImportFile = async (file: File) => {
    const name = file.name;
    const ext = name.split('.').pop()?.toLowerCase() || '';

    try {
      if (ext === 'csv' || ext === 'tsv') {
        const text = await file.text();
        const data = parseCSV(text);
        setSpreadsheetData(data);
        setFileType('spreadsheet');
        setTitle(name.replace(/\.\w+$/, ''));
        toast.success(`Importado: ${data.length} filas`);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const data = await parseExcelFile(file);
        setSpreadsheetData(data);
        setFileType('spreadsheet');
        setTitle(name.replace(/\.\w+$/, ''));
        toast.success(`Importado: ${data.length} filas`);
      } else if (ext === 'md' || ext === 'txt') {
        const text = await file.text();
        setContent(text);
        setFileType(ext === 'md' ? 'markdown' : 'text');
        setTitle(name.replace(/\.\w+$/, ''));
        setViewMode('split');
        toast.success('Archivo importado');
      } else {
        toast.error('Formato no soportado. Usa CSV, Excel, Markdown o TXT.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al importar el archivo');
    }
  };

  // ── Markdown helpers ──
  const insertMarkdown = (before: string, after = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${before}${selected || 'texto'}${after}`;
    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + (selected || 'texto').length);
    }, 0);
  };

  // ── AI streaming ──
  const streamAi = useCallback(async (messages: ChatMessage[], action: AiAction, docType: FileType | null) => {
    setIsStreaming(true);
    let assistantContent = '';
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages, action, fileType: docType || 'markdown' }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Error de conexión' }));
        toast.error(err.error || 'Error al conectar con la IA');
        setIsStreaming(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const updateAssistant = (text: string) => {
        setChatMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: text } : m);
          }
          return [...prev, { role: 'assistant', content: text }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) { assistantContent += delta; updateAssistant(assistantContent); }
          } catch { /* partial */ }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Error de conexión con la IA');
    } finally {
      setIsStreaming(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, []);

  const handleSendChat = async () => {
    if (!chatInput.trim() || isStreaming) return;
    let userMessage = chatInput.trim();
    const docContent = fileType === 'spreadsheet'
      ? spreadsheetData.map(r => r.map(c => c.formula ? `=${c.formula}` : c.value).join('\t')).join('\n')
      : content;
    if ((aiAction === 'edit' || aiAction === 'improve' || aiAction === 'summarize') && docContent) {
      userMessage = `Documento actual:\n\n${docContent}\n\n---\n\nInstrucciones: ${userMessage}`;
    }
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMessage }];
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    await streamAi(newMessages, aiAction, fileType);
  };

  const applyAiToDocument = () => {
    const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant) {
      if (fileType === 'spreadsheet') {
        // Try to parse as CSV
        const parsed = parseCSV(lastAssistant.content);
        if (parsed.length > 0) {
          setSpreadsheetData(parsed);
          toast.success('Datos aplicados a la hoja');
        }
      } else {
        setContent(lastAssistant.content);
        toast.success('Contenido aplicado al documento');
      }
    }
  };

  const appendAiToDocument = () => {
    const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant) {
      setContent(prev => prev ? `${prev}\n\n${lastAssistant.content}` : lastAssistant.content);
      toast.success('Contenido añadido al documento');
    }
  };

  // ── Downloads ──
  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMd = () => {
    downloadBlob(new Blob([content], { type: 'text/markdown' }), `${title || 'documento'}.md`);
    toast.success('Descargado como Markdown');
  };

  const handleDownloadTxt = () => {
    const plain = content.replace(/#{1,6}\s/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1').replace(/>\s/g, '').replace(/---/g, '');
    downloadBlob(new Blob([plain], { type: 'text/plain' }), `${title || 'documento'}.txt`);
    toast.success('Descargado como TXT');
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const pageHeight = doc.internal.pageSize.getHeight() - margin * 2;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text(title || 'Documento', margin, margin + 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    const plain = content.replace(/#{1,6}\s/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1').replace(/>\s/g, '').replace(/---/g, '────────────────');
    const lines = doc.splitTextToSize(plain, pageWidth);
    let y = margin + 20;
    for (const line of lines) {
      if (y > pageHeight + margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y); y += 6;
    }
    doc.save(`${title || 'documento'}.pdf`);
    toast.success('Descargado como PDF');
  };

  const handleDownloadCsv = () => {
    const csv = spreadsheetData.map(r => r.map(c => {
      const v = c.value;
      return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv' }), `${title || 'hoja'}.csv`);
    toast.success('Descargado como CSV');
  };

  const handleDownloadXlsx = async () => {
    try {
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Hoja 1');
      spreadsheetData.forEach(row => {
        ws.addRow(row.map(c => c.value));
      });
      const buffer = await wb.xlsx.writeBuffer();
      downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${title || 'hoja'}.xlsx`);
      toast.success('Descargado como Excel');
    } catch (e) {
      console.error(e);
      toast.error('Error al exportar Excel');
    }
  };

  // ── Save to Cloud ──
  const handleSaveToCloud = async () => {
    if (onSaveToCloud) {
      setIsSaving(true);
      try {
        const saveContent = fileType === 'spreadsheet'
          ? spreadsheetData.map(r => r.map(c => c.value).join('\t')).join('\n')
          : content;
        await onSaveToCloud(title, saveContent);
        toast.success('Documento guardado en Cloud');
      } catch { toast.error('Error al guardar'); }
      finally { setIsSaving(false); }
      return;
    }

    if (!user) return;
    setIsSaving(true);
    try {
      const isSpreadsheet = fileType === 'spreadsheet';
      const ext = isSpreadsheet ? 'csv' : 'md';
      const mimeType = isSpreadsheet ? 'text/csv' : 'text/markdown';
      const saveContent = isSpreadsheet
        ? spreadsheetData.map(r => r.map(c => c.value).join(',')).join('\n')
        : content;

      const safeName = sanitizeFileName(title || 'documento');
      const fileName = `${safeName}.${ext}`;
      const blob = new Blob([saveContent], { type: mimeType });
      const file = new File([blob], fileName, { type: mimeType });
      const filePath = `${user.id}/${Date.now()}-${fileName}`;

      const { error: uploadError } = await supabase.storage.from('shared-files').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('shared-files').getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('shared_files').insert({
        user_id: user.id,
        file_name: `${title || 'documento'}.${ext}`,
        file_path: urlData.publicUrl,
        file_size: blob.size,
        file_type: mimeType,
        description: `Creado con el Editor IA (${isSpreadsheet ? 'Hoja de cálculo' : 'Documento'})`,
      });
      if (dbError) throw dbError;
      toast.success('Guardado en Archivos Compartidos');
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar');
    } finally { setIsSaving(false); }
  };

  const handleBack = () => {
    if (fileType && !initialContent) {
      setFileType(null);
      return;
    }
    if (location.pathname === '/tools/editor') navigate('/');
    else window.history.back();
  };

  // ── If no file type selected, show main menu ──
  if (!fileType) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b bg-card px-3 py-2 flex items-center gap-2">
          {showBackButton && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
              if (location.pathname === '/tools/editor') navigate('/');
              else window.history.back();
            }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Editor IA</span>
        </div>
        <EditorMainMenu onCreateNew={handleCreateNew} onImportFile={handleImportFile} />
      </div>
    );
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  // ── Spreadsheet view ──
  if (fileType === 'spreadsheet') {
    return (
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="border-b bg-card px-3 py-2 flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input value={title} onChange={e => setTitle(e.target.value)} className="max-w-[250px] h-8 text-sm font-medium" placeholder="Título" />
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Badge variant="secondary" className="text-xs">{spreadsheetData.length} filas × {spreadsheetData[0]?.length || 0} cols</Badge>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs"><FileDown className="h-3.5 w-3.5 mr-1" />Descargar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadCsv}><FileText className="h-4 w-4 mr-2" />CSV (.csv)</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel (.xlsx)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSaveToCloud} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Cloud className="h-3.5 w-3.5 mr-1" />}
            Guardar
          </Button>
          <Button variant={showAi ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setShowAi(!showAi)}>
            {showAi ? <PanelRightClose className="h-3.5 w-3.5 mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}IA
          </Button>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-h-0">
            <SpreadsheetEditor data={spreadsheetData} onChange={setSpreadsheetData} />
          </div>
          {showAi && renderAiPanel()}
        </div>
      </div>
    );
  }

  // ── Text/Markdown view ──
  function renderAiPanel() {
    return (
      <div className="w-[340px] border-l flex flex-col bg-card">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Asistente IA</span>
          </div>
          <div className="flex items-center gap-1">
            <Select value={aiAction} onValueChange={(v: AiAction) => setAiAction(v)}>
              <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="write">Escribir</SelectItem>
                <SelectItem value="edit">Editar</SelectItem>
                <SelectItem value="improve">Mejorar</SelectItem>
                <SelectItem value="summarize">Resumir</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChatMessages([])}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
                <Sparkles className="h-8 w-8 mx-auto opacity-50" />
                <p>Pide a la IA que escriba, edite o mejore tu documento</p>
                <div className="flex flex-wrap gap-1 justify-center mt-3">
                  {(fileType === 'spreadsheet'
                    ? ['Crea una tabla de gastos', 'Genera datos de ejemplo', 'Organiza estos datos']
                    : ['Escribe un informe', 'Crea un acta de reunión', 'Redacta una propuesta']
                  ).map(suggestion => (
                    <button key={suggestion} onClick={() => setChatInput(suggestion)}
                      className="text-[10px] px-2 py-1 rounded-full border hover:bg-muted transition-colors">{suggestion}</button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[90%] rounded-lg px-3 py-2 text-xs',
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-xs dark:prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                  ) : (<p className="whitespace-pre-wrap">{msg.content}</p>)}
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />Generando...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>
        {chatMessages.some(m => m.role === 'assistant') && !isStreaming && (
          <div className="px-3 py-2 border-t flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={applyAiToDocument}>Reemplazar</Button>
            {fileType !== 'spreadsheet' && (
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={appendAiToDocument}>Añadir al final</Button>
            )}
          </div>
        )}
        <div className="p-3 border-t">
          <div className="flex gap-2">
            <Input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
              placeholder={aiAction === 'write' ? 'Describe qué crear...' : aiAction === 'edit' ? 'Describe los cambios...' : aiAction === 'improve' ? 'Instrucciones de mejora...' : 'Pide un resumen...'}
              className="h-8 text-xs" disabled={isStreaming} />
            <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSendChat} disabled={isStreaming || !chatInput.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b bg-card px-3 py-2 flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack} title="Volver">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input value={title} onChange={e => setTitle(e.target.value)} className="max-w-[250px] h-8 text-sm font-medium" placeholder="Título del documento" />
        <Separator orientation="vertical" className="h-6 mx-1" />

        {fileType === 'markdown' && (
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('**', '**')} title="Negrita"><Bold className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('*', '*')} title="Cursiva"><Italic className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('# ')} title="Título 1"><Heading1 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('## ')} title="Título 2"><Heading2 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('- ')} title="Lista"><List className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('1. ')} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('> ')} title="Cita"><Quote className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('`', '`')} title="Código"><Code className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('\n---\n')} title="Separador"><Minus className="h-3.5 w-3.5" /></Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
          </div>
        )}

        {/* View mode buttons */}
        {fileType === 'markdown' && (
          <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
            <Button variant={viewMode === 'edit' ? 'secondary' : 'ghost'} size="sm" className="h-6 text-[10px] px-2"
              onClick={() => setViewMode('edit')}>Editar</Button>
            <Button variant={viewMode === 'split' ? 'secondary' : 'ghost'} size="sm" className="h-6 text-[10px] px-2"
              onClick={() => setViewMode('split')}>
              <Columns2 className="h-3 w-3 mr-1" />Split
            </Button>
            <Button variant={viewMode === 'preview' ? 'secondary' : 'ghost'} size="sm" className="h-6 text-[10px] px-2"
              onClick={() => setViewMode('preview')}>Vista previa</Button>
          </div>
        )}

        <div className="flex-1" />
        <Badge variant="secondary" className="text-xs font-normal hidden sm:inline-flex">
          {wordCount} palabras · {charCount} caracteres
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs"><FileDown className="h-3.5 w-3.5 mr-1" />Descargar</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadMd}><FileText className="h-4 w-4 mr-2" />Markdown (.md)</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadTxt}><FileText className="h-4 w-4 mr-2" />Texto plano (.txt)</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadPdf}><FileText className="h-4 w-4 mr-2" />PDF (.pdf)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSaveToCloud} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Cloud className="h-3.5 w-3.5 mr-1" />}
          Guardar
        </Button>
        <Button variant={showAi ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setShowAi(!showAi)}>
          {showAi ? <PanelRightClose className="h-3.5 w-3.5 mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}IA
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Editor area */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={cn("min-h-0", viewMode === 'split' ? 'flex-1 border-r' : 'flex-1')}>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Empieza a escribir o usa la IA para generar contenido..."
              className="h-full w-full resize-none border-0 rounded-none focus-visible:ring-0 p-6 md:p-10 font-mono text-sm leading-relaxed"
            />
          </div>
        )}

        {/* Preview area */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={cn("min-h-0", viewMode === 'split' ? 'flex-1' : 'flex-1')}>
            <ScrollArea className="h-full">
              <div className="p-6 md:p-10 max-w-3xl mx-auto prose prose-sm dark:prose-invert">
                {content ? <ReactMarkdown>{content}</ReactMarkdown> : (
                  <p className="text-muted-foreground italic">La vista previa aparecerá aquí...</p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* AI Panel */}
        {showAi && renderAiPanel()}
      </div>
    </div>
  );
}
