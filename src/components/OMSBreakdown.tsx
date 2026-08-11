import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import { toBlob as htmlToBlob, toPng as htmlToPng } from 'html-to-image';
import {
  Maximize2, Minimize2, Upload, Download, Plus, Trash2, Save, X,
  Loader2, FileSpreadsheet, RefreshCw, Search, Edit3, PieChart, Filter, ClipboardList, AlertTriangle, Users, Camera, CheckCircle2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from './DatePicker';

// ============= Types =============
export interface OmsEmployee {
  id: string;
  mobile_number: string;
  sys_code: string;
  partner_id: string;
  insur_comp: string;
  structure_company: string;
  maxer_id: string;
  national_id: string;
  name_en: string;
  name_ar: string;
  site: string;
  gender: string;
  hiring_date: string;
}

export interface PreviewEmployee {
  national_id: string;
  mobile_number: string;
  sys_code: string;
  partner_id: string;
  insur_comp: string;
  structure_company: string;
  maxer_id: string;
  name_en: string;
  name_ar: string;
  site: string;
  gender: string;
  hiring_date: string;
  status: 'new' | 'update' | 'excluded';
  statusReason: string;
}

export interface OmsPayroll {
  national_id: string;
  leaving_date: string;
  account_number: string;
  payment_method: string;
  m: string;
  cost_centre: string;
  department: string;
  sub_department: string;
  title: string;
  net_fixed_salary: string;
  ceiling_variable_salary: string;
  fixed_allowances: string;
  working_days: string;
  fixed_allowances_per_working_day: string;
  net_fixed_per_working_days: string;
  net_variable_salary: string;
  productivity_bonus: string;
  net_bonus: string;
  overtime_per_hours: string;
  overtime_per_days: string;
  transportation: string;
  total_earning: string;
  absence: string;
  attendance_lateness: string;
  other_deductions: string;
  cash_deficit: string;
  pending_deficit: string;
  damage_deficit: string;
  total_deduction: string;
  deductions_0005: string;
  total_net: string;
  comments: string;
}

// Manual columns (ordered)
const MANUAL_COLS: { key: keyof OmsEmployee; label: string; readOnly?: boolean }[] = [
  { key: 'mobile_number', label: 'Mobile Number' },
  { key: 'sys_code', label: 'SYS Code' },
  { key: 'partner_id', label: 'Partner ID' },
  { key: 'insur_comp', label: 'Insur. Comp' },
  { key: 'structure_company', label: 'Structure Company' },
  { key: 'maxer_id', label: 'Maxer ID' },
  { key: 'national_id', label: 'National ID' },
  { key: 'name_en', label: 'Name En.' },
  { key: 'name_ar', label: 'Name Ar', readOnly: true },
  { key: 'site', label: 'Site' },
  { key: 'gender', label: 'Gender' },
  { key: 'hiring_date', label: 'Hiring Date' },
];

// Excel columns: header label -> db key
const EXCEL_COLS: { key: keyof OmsPayroll; label: string }[] = [
  { key: 'leaving_date', label: 'Leaving Date' },
  { key: 'account_number', label: 'Account Number' },
  { key: 'payment_method', label: 'Payment Method' },
  { key: 'm', label: 'M' },
  { key: 'cost_centre', label: 'Cost Centre' },
  { key: 'department', label: 'Department' },
  { key: 'sub_department', label: 'Sub-Department' },
  { key: 'title', label: 'Title' },
  { key: 'net_fixed_salary', label: 'Net Fixed Salary' },
  { key: 'ceiling_variable_salary', label: 'Ceiling Variable Salary' },
  { key: 'fixed_allowances', label: 'Fixed Allowances' },
  { key: 'working_days', label: 'Working Days' },
  { key: 'fixed_allowances_per_working_day', label: 'Fixed Allowances Per Working Day' },
  { key: 'net_fixed_per_working_days', label: 'Net Fixed Per Working Days' },
  { key: 'net_variable_salary', label: 'Net Variable Salary' },
  { key: 'productivity_bonus', label: 'Productivity Bonus' },
  { key: 'net_bonus', label: 'Net Bonus' },
  { key: 'overtime_per_hours', label: 'Overtime Per Hours' },
  { key: 'overtime_per_days', label: 'Overtime Per Days' },
  { key: 'transportation', label: 'Transportation' },
  { key: 'total_earning', label: 'Total Earning' },
  { key: 'absence', label: 'Absence' },
  { key: 'attendance_lateness', label: 'Attendance Lateness' },
  { key: 'other_deductions', label: 'Other Deductions' },
  { key: 'cash_deficit', label: 'Cash Deficit' },
  { key: 'pending_deficit', label: 'Pending Deficit' },
  { key: 'damage_deficit', label: 'Damage Deficit' },
  { key: 'total_deduction', label: 'Total deduction' },
  { key: 'deductions_0005', label: '0005% Deductions' },
  { key: 'total_net', label: 'Total Net' },
  { key: 'comments', label: 'Comments' },
];

const NOT_ON_OMS = 'Not On OMS';

// Normalize header for matching
// Normalize header for matching (supports English and Arabic)
const norm = (s: string) => String(s || '').toLowerCase().trim().replace(/[\s._-]+/g, '');

// Build header lookup from excel
function buildHeaderMap(headers: string[]): Map<string, number> {
  const m = new Map<string, number>();
  headers.forEach((h, i) => {
    const nh = norm(h);
    if (nh) m.set(nh, i);
  });
  return m;
}

// Helper to find column index using multiple labels and fuzzy matching
function findColumnIndex(headerMap: Map<string, number>, labels: string[]): number | undefined {
  const normalizedLabels = labels.map(lbl => norm(lbl)).filter(Boolean);

  // 1. Exact match for any label
  for (const nlbl of normalizedLabels) {
    if (headerMap.has(nlbl)) return headerMap.get(nlbl);
  }

  // 2. Fuzzy match: check if a header in the sheet contains our label
  for (const nlbl of normalizedLabels) {
    for (const [h, idx] of headerMap.entries()) {
      if (h.includes(nlbl)) return idx;
    }
  }

  // 3. Reverse fuzzy match: check if our label contains the header in the sheet,
  // but only if the sheet header is at least 4 characters long to avoid false matches
  // with short words like "رقم" or "id" matching "الرقم القومي" or "partner_id"
  for (const nlbl of normalizedLabels) {
    for (const [h, idx] of headerMap.entries()) {
      if (h.length >= 4 && nlbl.includes(h)) return idx;
    }
  }

  return undefined;
}

// English -> Arabic transliteration (dictionary + char-level fallback)
const enToArMap: Record<string, string> = {
  'mohamed': 'محمد', 'mohammed': 'محمد', 'muhammad': 'محمد', 'mohamad': 'محمد',
  'mahmoud': 'محمود', 'mahmood': 'محمود',
  'ahmed': 'أحمد', 'ahmad': 'أحمد',
  'ali': 'علي', 'aly': 'علي',
  'hassan': 'حسن', 'hasan': 'حسن', 'hussein': 'حسين', 'hussien': 'حسين', 'hossam': 'حسام',
  'omar': 'عمر', 'amr': 'عمرو',
  'youssef': 'يوسف', 'yousef': 'يوسف', 'yusuf': 'يوسف', 'yousif': 'يوسف',
  'ibrahim': 'إبراهيم', 'ebrahim': 'إبراهيم',
  'mostafa': 'مصطفى', 'mustafa': 'مصطفى', 'moustafa': 'مصطفى',
  'khaled': 'خالد', 'khalid': 'خالد',
  'sayed': 'سيد', 'syed': 'سيد', 'sayyed': 'سيد',
  'rahman': 'الرحمن', 'rahim': 'الرحيم', 'fatah': 'الفتاح', 'fattah': 'الفتاح',
  'aziz': 'العزيز', 'salam': 'السلام', 'kareem': 'الكريم', 'karim': 'الكريم',
  'hamid': 'الحميد', 'hameed': 'الحميد', 'majid': 'المجيد', 'megid': 'المجيد',
  'nasser': 'الناصر', 'naser': 'الناصر', 'sattar': 'الستار', 'wahab': 'الوهاب',
  'reda': 'رضا', 'redha': 'رضا', 'tarek': 'طارق', 'tarik': 'طارق',
  'walid': 'وليد', 'waleed': 'وليد', 'sherif': 'شريف', 'shereef': 'شريف',
  'fady': 'فادي', 'fadi': 'فادي', 'samir': 'سمير', 'sameer': 'سمير',
  'gamal': 'جمال', 'jamal': 'جمال', 'hany': 'هاني', 'hani': 'هاني',
  'nabil': 'نبيل', 'magdy': 'مجدي', 'magdi': 'مجدي',
  'el': 'ال', 'al': 'ال', 'abu': 'أبو', 'abou': 'أبو', 'bin': 'بن', 'ibn': 'ابن',
  'abdel': 'عبد', 'abdul': 'عبد', 'abd': 'عبد', 'abdo': 'عبده', 'abdou': 'عبده',
  'abdelrahman': 'عبدالرحمن', 'abdulrahman': 'عبدالرحمن',
  'abdallah': 'عبدالله', 'abdullah': 'عبدالله', 'abdalla': 'عبدالله',
  'abdelfatah': 'عبدالفتاح', 'abdelfattah': 'عبدالفتاح',
  'abdelaziz': 'عبدالعزيز', 'abdulaziz': 'عبدالعزيز',
  'abdelhamid': 'عبدالحميد', 'abdelmonem': 'عبدالمنعم', 'abdelmoneim': 'عبدالمنعم',
  'abdelnasser': 'عبدالناصر', 'abdelkarim': 'عبدالكريم', 'abdelhakim': 'عبدالحكيم',
  'abdelsalam': 'عبدالسلام', 'abdelghany': 'عبدالغني', 'abdelmagid': 'عبدالمجيد',
  'said': 'سعيد', 'saeed': 'سعيد', 'saied': 'سعيد',
  'kamal': 'كمال', 'adel': 'عادل', 'emad': 'عماد', 'amir': 'أمير', 'ameer': 'أمير',
  'ashraf': 'أشرف', 'atef': 'عاطف', 'ayman': 'أيمن', 'bassem': 'باسم', 'bassam': 'بسام',
  'fathy': 'فتحي', 'fathi': 'فتحي', 'fawzy': 'فوزي', 'fawzi': 'فوزي',
  'gaber': 'جابر', 'gaballah': 'جاب الله', 'george': 'جورج',
  'hamdy': 'حمدي', 'hamdi': 'حمدي', 'hamada': 'حمادة', 'hatem': 'حاتم',
  'islam': 'إسلام', 'ismail': 'إسماعيل', 'esmail': 'إسماعيل',
  'mahmod': 'محمود', 'mansour': 'منصور', 'medhat': 'مدحت', 'mena': 'مينا',
  'nader': 'نادر', 'nasr': 'نصر', 'nour': 'نور', 'noureldin': 'نورالدين',
  'osama': 'أسامة', 'ossama': 'أسامة', 'rami': 'رامي', 'ramy': 'رامي',
  'rashad': 'رشاد', 'rashed': 'راشد', 'romany': 'روماني',
  'sabry': 'صبري', 'sabri': 'صبري', 'sadek': 'صادق', 'salah': 'صلاح',
  'samy': 'سامي', 'sami': 'سامي', 'shaaban': 'شعبان', 'shawky': 'شوقي',
  'sobhy': 'صبحي', 'sobhi': 'صبحي', 'soliman': 'سليمان', 'suliman': 'سليمان',
  'taha': 'طه', 'wael': 'وائل', 'wagdy': 'وجدي', 'yahia': 'يحيى', 'yehia': 'يحيى',
  'zaki': 'زكي', 'zakaria': 'زكريا', 'ziad': 'زياد',
  'eid': 'عيد', 'eed': 'عيد', 'farag': 'فرج', 'farouk': 'فاروق',
  'galal': 'جلال', 'ghaly': 'غالي', 'habib': 'حبيب', 'hisham': 'هشام', 'hesham': 'هشام',
  'kamel': 'كامل', 'lotfy': 'لطفي', 'maher': 'ماهر', 'mamdouh': 'ممدوح',
  'mina': 'مينا', 'mounir': 'منير', 'moneer': 'منير', 'nagy': 'ناجي', 'naji': 'ناجي',
  'rabea': 'ربيع', 'rabie': 'ربيع', 'raafat': 'رأفت', 'safwat': 'صفوت',
  'shadi': 'شادي', 'shady': 'شادي', 'sharaf': 'شرف', 'tamer': 'تامر',
  'wahid': 'وحيد', 'waheed': 'وحيد', 'yasser': 'ياسر', 'yaser': 'ياسر',
  'zein': 'زين', 'zeinhom': 'زينهم',
};

// Char-level fallback (digraphs first)
const charDigraphs: [string, string][] = [
  ['sh', 'ش'], ['ch', 'تش'], ['kh', 'خ'], ['gh', 'غ'], ['th', 'ث'],
  ['dh', 'ذ'], ['ph', 'ف'], ['oo', 'و'], ['ou', 'و'], ['ee', 'ي'],
  ['ei', 'ي'], ['ai', 'اي'], ['ay', 'اي'], ['aa', 'ا'],
];
const charSingles: Record<string, string> = {
  a: 'ا', b: 'ب', c: 'ك', d: 'د', e: 'ي', f: 'ف', g: 'ج', h: 'ه',
  i: 'ي', j: 'ج', k: 'ك', l: 'ل', m: 'م', n: 'ن', o: 'و', p: 'ب',
  q: 'ق', r: 'ر', s: 'س', t: 'ت', u: 'و', v: 'ف', w: 'و', x: 'كس',
  y: 'ي', z: 'ز',
};
function transliterateWord(w: string): string {
  const lw = w.toLowerCase();
  if (enToArMap[lw]) return enToArMap[lw];
  let s = lw, out = '';
  while (s.length) {
    let matched = false;
    for (const [k, v] of charDigraphs) {
      if (s.startsWith(k)) { out += v; s = s.slice(k.length); matched = true; break; }
    }
    if (matched) continue;
    const ch = s[0];
    out += charSingles[ch] ?? ch;
    s = s.slice(1);
  }
  // strip leading alef after initial letter sequences only when single char
  return out || w;
}
function autoArabic(en: string): string {
  if (!en) return '';
  const words = en.trim().split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const lw = w.toLowerCase();
    // Compound: abdel/abdul/abd + next word
    if ((lw === 'abdel' || lw === 'abdul' || lw === 'abd') && i + 1 < words.length) {
      const next = words[i + 1];
      const combined = (lw + next).toLowerCase();
      if (enToArMap[combined]) {
        out.push(enToArMap[combined]);
      } else {
        const nextAr = enToArMap[next.toLowerCase()] || transliterateWord(next);
        out.push('عبد' + (nextAr.startsWith('ال') ? nextAr : 'ال' + nextAr));
      }
      i++;
      continue;
    }
    out.push(transliterateWord(w));
  }
  return out.join(' ');
}

const EXCLUDED_SITES = ['mostorod', 'barageel', 'sakkarah', 'barageel 2pl', 'barageel 2 pl'];
const isExcludedSite = (site: string) => {
  // Exclusions disabled to show all uploaded sites in the UI
  return false;
};

const ColumnFilter = ({ 
  label, 
  options, 
  selected, 
  onSelect 
}: { 
  label: string, 
  options: string[], 
  selected: string[], 
  onSelect: (vals: string[]) => void 
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`p-1 rounded hover:bg-slate-200 transition-colors ${selected.length > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
          <Filter className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="p-2 border-b bg-slate-50">
          <p className="text-xs font-bold text-slate-700">Filter {label}</p>
        </div>
        <div className="max-h-60 overflow-auto p-2 space-y-1">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer group">
              <Checkbox 
                checked={selected.includes(opt)} 
                onCheckedChange={(checked) => {
                  if (checked) onSelect([...selected, opt]);
                  else onSelect(selected.filter(s => s !== opt));
                }}
              />
              <span className="text-xs text-slate-600 group-hover:text-slate-900">{opt || '(Empty)'}</span>
            </label>
          ))}
        </div>
        <div className="p-2 border-t flex justify-between gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => onSelect([])}>Clear</Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => onSelect(options)}>Select All</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface OMSBreakdownProps {
  initialEmployees: OmsEmployee[];
  initialPayrollMap: Map<string, OmsPayroll>;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

export default function OMSBreakdown({ initialEmployees, initialPayrollMap, isLoading: globalLoading, onRefresh }: OMSBreakdownProps) {
  const [employees, setEmployees] = useState<OmsEmployee[]>(initialEmployees);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [payrollMap, setPayrollMap] = useState<Map<string, OmsPayroll>>(initialPayrollMap);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<Partial<OmsEmployee>>({});
  const [uploading, setUploading] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [siteOther, setSiteOther] = useState(false);
  const [markedIds, setMarkedIds] = useState<Record<string, boolean>>({});

  const [isMpCompareOpen, setIsMpCompareOpen] = useState(false);
  const [mpCompareLoading, setMpCompareLoading] = useState(false);
  const [mpCompareMode, setMpCompareMode] = useState<'missing_from_oms' | 'missing_from_manpower' | 'mismatches'>('missing_from_oms');
  const [mpCompareResults, setMpCompareResults] = useState<{
    missingFromOms: any[];
    missingFromManpower: any[];
    mismatches: any[];
  }>({ missingFromOms: [], missingFromManpower: [], mismatches: [] });
  const [mpActionLoading, setMpActionLoading] = useState(false);

  const markedCount = useMemo(() => {
    return Object.keys(markedIds).filter(id => markedIds[id] && employees.some(e => e.id === id)).length;
  }, [markedIds, employees]);

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkMode, setBulkMode] = useState<'excel' | 'paste'>('excel');
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [previewEmployees, setPreviewEmployees] = useState<PreviewEmployee[] | null>(null);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewFilterStatus, setPreviewFilterStatus] = useState<'all' | 'new' | 'update'>('all');

  const handleBulkOpenChange = (open: boolean) => {
    setIsBulkOpen(open);
    if (!open) {
      setPreviewEmployees(null);
      setBulkText('');
      setPreviewSearch('');
      setPreviewFilterStatus('all');
    }
  };

  const previewKPIs = useMemo(() => {
    if (!previewEmployees) return { total: 0, newCount: 0, updateCount: 0 };
    return {
      total: previewEmployees.length,
      newCount: previewEmployees.filter(e => e.status === 'new').length,
      updateCount: previewEmployees.filter(e => e.status === 'update').length,
    };
  }, [previewEmployees]);

  const filteredPreview = useMemo(() => {
    if (!previewEmployees) return [];
    return previewEmployees.filter(emp => {
      if (previewFilterStatus !== 'all' && emp.status !== previewFilterStatus) {
        return false;
      }
      if (previewSearch.trim()) {
        const q = previewSearch.toLowerCase().trim();
        const nameAr = String(emp.name_ar || '').toLowerCase();
        const nameEn = String(emp.name_en || '').toLowerCase();
        const nid = String(emp.national_id || '').toLowerCase();
        const mob = String(emp.mobile_number || '').toLowerCase();
        const sys = String(emp.sys_code || '').toLowerCase();
        return nameAr.includes(q) || nameEn.includes(q) || nid.includes(q) || mob.includes(q) || sys.includes(q);
      }
      return true;
    });
  }, [previewEmployees, previewFilterStatus, previewSearch]);

  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditAccepting, setAuditAccepting] = useState(false);
  // Stores employee-related columns extracted from the uploaded payroll Excel (partner_id, name_en, etc.)
  // Loaded from localStorage so it persists across page refreshes
  const [payrollMetaMap, setPayrollMetaMap] = useState<Map<string, any>>(() => {
    try {
      const stored = localStorage.getItem('oms_payroll_meta');
      if (stored) {
        const obj = JSON.parse(stored) as Record<string, any>;
        return new Map(Object.entries(obj));
      }
    } catch {}
    return new Map();
  });

  const [auditMode, setAuditMode] = useState<'missing_from_system' | 'missing_from_excel'>('missing_from_system');

  const missingFromExcel = useMemo(() => {
    const excelIds = new Set(Array.from(payrollMap.keys()).map(nid => String(nid).trim()));
    return employees.filter(e => {
      const nid = String(e.national_id || '').trim();
      return nid && !excelIds.has(nid);
    });
  }, [employees, payrollMap]);

  const uniqueSites = useMemo(() => {
    const sites = Array.from(new Set(employees.map(e => String(e.site || '').trim()))).filter(Boolean);
    return sites.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  }, [employees]);

  const missingFromSystem = useMemo(() => {
    const systemIds = new Set(employees.map(e => String(e.national_id || '').trim()));
    const missing: any[] = [];
    payrollMap.forEach((payroll, nid) => {
      const nidStr = String(nid).trim();
      if (!systemIds.has(nidStr)) {
        // Merge payroll data + employee columns extracted from Excel
        const meta = payrollMetaMap.get(nidStr) || {};
        const site = meta.site || (payroll as any).site || '';
        if (!isExcludedSite(site)) {
          missing.push({ ...payroll, ...meta, national_id: nidStr });
        }
      }
    });
    return missing;
  }, [employees, payrollMap, payrollMetaMap]);

  // Columns shown in Mismatch Audit — matches what's available in payroll Excel
  const AUDIT_COLS = [
    { key: 'mobile_number',      label: 'Mobile Number' },
    { key: 'sys_code',           label: 'SYS Code' },
    { key: 'partner_id',         label: 'Partner ID' },
    { key: 'insur_comp',         label: 'Insur. Comp' },
    { key: 'structure_company',  label: 'Structure Company' },
    { key: 'maxer_id',           label: 'Maxer ID' },
    { key: 'national_id',        label: 'National ID' },
    { key: 'name_en',            label: 'Name En.' },
    { key: 'name_ar',            label: 'Name Ar.' },
    { key: 'site',               label: 'Site' },
    { key: 'gender',             label: 'Gender' },
    { key: 'hiring_date',        label: 'Hiring Date' },
    { key: 'leaving_date',       label: 'Leaving Date' },
  ];

  const acceptMissing = async (rows: any[]) => {
    if (rows.length === 0) return;
    setAuditAccepting(true);
    try {
      const toInsert = rows.map(p => ({
        national_id:       String(p.national_id || '').trim(),
        mobile_number:     String(p.mobile_number || ''),
        sys_code:          String(p.sys_code || ''),
        partner_id:        String(p.partner_id || ''),
        insur_comp:        String(p.insur_comp || ''),
        structure_company: String(p.structure_company || ''),
        maxer_id:          String(p.maxer_id || ''),
        name_en:           String(p.name_en || ''),
        name_ar:           String(p.name_ar || ''),
        site:              String(p.site || ''),
        gender:            String(p.gender || ''),
        hiring_date:       String(p.hiring_date || ''),
      }));

      const { data, error } = await supabase.from('oms_employees').insert(toInsert).select();
      if (error) throw error;

      setEmployees(prev => [...(data as OmsEmployee[]).filter(e => !isExcludedSite(e.site)), ...prev]);
      toast({ title: 'Accepted', description: `${toInsert.length} employee(s) added to the system.` });
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setAuditAccepting(false);
    }
  };

  const compareManpowerAndOms = (manpowerList: any[], omsList: any[]) => {
    const missingFromOms: any[] = [];
    const missingFromManpower: any[] = [];
    const mismatches: any[] = [];

    const normId = (s: any) => String(s || '').trim();

    // Create OMS lookup maps
    const omsByNid = new Map<string, any>();
    const omsBySystem = new Map<string, any>();
    
    omsList.forEach(o => {
      const nid = normId(o.national_id);
      if (nid) omsByNid.set(nid, o);
      
      const pid = normId(o.partner_id);
      if (pid) omsBySystem.set(pid, o);
      
      const sc = normId(o.sys_code);
      if (sc) omsBySystem.set(sc, o);
    });

    // Create Manpower lookup maps
    const manByNid = new Map<string, any>();
    const manBySystem = new Map<string, any>();
    
    manpowerList.forEach(m => {
      const nid = normId(m.id_number);
      if (nid) manByNid.set(nid, m);
      
      const sys = normId(m.system);
      if (sys) manBySystem.set(sys, m);
    });

    // 1. Manpower to OMS
    manpowerList.forEach(m => {
      // Ignore leavers
      if (m.status !== 'Active') return;

      const nid = normId(m.id_number);
      const sys = normId(m.system);

      const matchByNid = nid ? omsByNid.get(nid) : null;
      const matchBySys = sys ? omsBySystem.get(sys) : null;

      if (!matchByNid && !matchBySys) {
        // Not found in OMS
        missingFromOms.push(m);
      } else {
        // Matches, let's see if there's details difference
        const matchedOms = matchByNid || matchBySys;
        
        // Strip names for basic comparison
        const mName = String(m.courier_name || '').trim().toLowerCase();
        const oNameAr = String(matchedOms.name_ar || '').trim().toLowerCase();
        const oNameEn = String(matchedOms.name_en || '').trim().toLowerCase();
        
        const nameDiff = mName !== oNameAr && mName !== oNameEn;
        const codeDiff = sys && (sys !== normId(matchedOms.partner_id) && sys !== normId(matchedOms.sys_code));

        if (nameDiff || codeDiff) {
          mismatches.push({
            manpower: m,
            oms: matchedOms,
            reason: nameDiff && codeDiff 
              ? 'Name and code mismatch' 
              : nameDiff 
                ? 'Name mismatch' 
                : 'System code mismatch'
          });
        }
      }
    });

    // 2. OMS to Manpower
    omsList.forEach(o => {
      const nid = normId(o.national_id);
      const pid = normId(o.partner_id);
      const sc = normId(o.sys_code);

      const matchByNid = nid ? manByNid.get(nid) : null;
      const matchByPid = pid ? manBySystem.get(pid) : null;
      const matchBySc = sc ? manBySystem.get(sc) : null;

      const matchedMan = matchByNid || matchByPid || matchBySc;

      if (!matchedMan) {
        missingFromManpower.push(o);
      }
    });

    return { missingFromOms, missingFromManpower, mismatches };
  };

  const runManpowerComparison = async () => {
    setMpCompareLoading(true);
    try {
      const { data: mpData, error: mpError } = await supabase
        .from('manpower')
        .select('*');

      if (mpError) throw mpError;

      const results = compareManpowerAndOms(mpData || [], employees);
      setMpCompareResults(results);
    } catch (err: any) {
      toast({ title: 'Data comparison failed', description: err.message, variant: 'destructive' });
    } finally {
      setMpCompareLoading(false);
    }
  };

  const handleMpCompareOpen = async () => {
    setIsMpCompareOpen(true);
    await runManpowerComparison();
  };

  const addToOms = async (mpRecord: any) => {
    setMpActionLoading(true);
    try {
      const newEmp = {
        mobile_number: mpRecord.mobile || '',
        sys_code: mpRecord.system || '',
        partner_id: mpRecord.system || '',
        national_id: mpRecord.id_number || '',
        name_en: mpRecord.courier_name || '',
        name_ar: mpRecord.courier_name || '',
        site: mpRecord.region || '',
        gender: 'Male',
        hiring_date: mpRecord.starting_date || ''
      };

      const { data, error } = await supabase
        .from('oms_employees')
        .insert([newEmp])
        .select()
        .single();

      if (error) throw error;

      setEmployees(prev => [data as OmsEmployee, ...prev]);
      toast({ title: 'Added to OMS successfully', description: mpRecord.courier_name });
      await runManpowerComparison();
    } catch (err: any) {
      toast({ title: 'Failed to add', description: err.message, variant: 'destructive' });
    } finally {
      setMpActionLoading(false);
    }
  };

  const addAllToOms = async (records: any[]) => {
    if (records.length === 0) return;
    setMpActionLoading(true);
    try {
      const toInsert = records.map(r => ({
        mobile_number: r.mobile || '',
        sys_code: r.system || '',
        partner_id: r.system || '',
        national_id: r.id_number || '',
        name_en: r.courier_name || '',
        name_ar: r.courier_name || '',
        site: r.region || '',
        gender: 'Male',
        hiring_date: r.starting_date || ''
      }));

      const { data, error } = await supabase
        .from('oms_employees')
        .insert(toInsert)
        .select();

      if (error) throw error;

      setEmployees(prev => [...(data as OmsEmployee[]), ...prev]);
      toast({ title: 'All added successfully', description: `Added ${toInsert.length} couriers.` });
      await runManpowerComparison();
    } catch (err: any) {
      toast({ title: 'Bulk add failed', description: err.message, variant: 'destructive' });
    } finally {
      setMpActionLoading(false);
    }
  };

  const addToManpower = async (omsRecord: any) => {
    setMpActionLoading(true);
    try {
      const newMp = {
        courier_name: omsRecord.name_ar || omsRecord.name_en || '',
        system: omsRecord.partner_id || omsRecord.sys_code || '',
        id_number: omsRecord.national_id || '',
        mobile: omsRecord.mobile_number || '',
        region: omsRecord.site || '',
        starting_date: omsRecord.hiring_date || '',
        status: 'Active',
        employment_type: omsRecord.structure_company === 'Outsource' ? 'Outsource' : 'Fixed'
      };

      const { error } = await supabase
        .from('manpower')
        .insert([newMp]);

      if (error) throw error;

      toast({ title: 'Added to Manpower successfully', description: omsRecord.name_ar || omsRecord.name_en });
      await runManpowerComparison();
    } catch (err: any) {
      toast({ title: 'Failed to add', description: err.message, variant: 'destructive' });
    } finally {
      setMpActionLoading(false);
    }
  };

  const addAllToManpower = async (records: any[]) => {
    if (records.length === 0) return;
    setMpActionLoading(true);
    try {
      const toInsert = records.map(r => ({
        courier_name: r.name_ar || r.name_en || '',
        system: r.partner_id || r.sys_code || '',
        id_number: r.national_id || '',
        mobile: r.mobile_number || '',
        region: r.site || '',
        starting_date: r.hiring_date || '',
        status: 'Active',
        employment_type: r.structure_company === 'Outsource' ? 'Outsource' : 'Fixed'
      }));

      const { error } = await supabase
        .from('manpower')
        .insert(toInsert);

      if (error) throw error;

      toast({ title: 'All added successfully', description: `Added ${toInsert.length} couriers to Manpower.` });
      await runManpowerComparison();
    } catch (err: any) {
      toast({ title: 'Bulk add failed', description: err.message, variant: 'destructive' });
    } finally {
      setMpActionLoading(false);
    }
  };

  const syncOmsWithManpower = async (mRecord: any, oRecord: any) => {
    setMpActionLoading(true);
    try {
      const updateData = {
        name_ar: mRecord.courier_name || oRecord.name_ar,
        name_en: oRecord.name_en || mRecord.courier_name,
        sys_code: mRecord.system || oRecord.sys_code,
        partner_id: mRecord.system || oRecord.partner_id
      };

      const { data, error } = await supabase
        .from('oms_employees')
        .update(updateData)
        .eq('id', oRecord.id)
        .select()
        .single();

      if (error) throw error;

      setEmployees(prev => prev.map(e => e.id === oRecord.id ? (data as OmsEmployee) : e));
      toast({ title: 'OMS data matched and updated successfully' });
      await runManpowerComparison();
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    } finally {
      setMpActionLoading(false);
    }
  };

  const exportMpComparisonExcel = () => {
    const dataOms = mpCompareResults.missingFromOms.map(r => ({
      'Type': 'In Manpower, not in OMS',
      'Courier Name': r.courier_name,
      'System Code': r.system,
      'National ID': r.id_number,
      'Mobile': r.mobile,
      'Region': r.region,
      'Status': r.status,
      'Employment Type': r.employment_type
    }));

    const dataMp = mpCompareResults.missingFromManpower.map(r => ({
      'Type': 'In OMS, not in Manpower',
      'Courier Name (Arabic)': r.name_ar,
      'Courier Name (English)': r.name_en,
      'Partner ID': r.partner_id,
      'SYS Code': r.sys_code,
      'National ID': r.national_id,
      'Mobile': r.mobile_number,
      'Site': r.site
    }));

    const dataDiff = mpCompareResults.mismatches.map(r => ({
      'Type': 'Data mismatch',
      'National ID': r.manpower.id_number || r.oms.national_id,
      'Name in Manpower': r.manpower.courier_name,
      'Name in OMS (Arabic)': r.oms.name_ar,
      'Name in OMS (English)': r.oms.name_en,
      'Code in Manpower': r.manpower.system,
      'Code in OMS': r.oms.partner_id || r.oms.sys_code,
      'Reason': r.reason
    }));

    const allRecords = [...dataOms, ...dataMp, ...dataDiff];

    const ws = XLSX.utils.json_to_sheet(allRecords);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Manpower_OMS_Comparison');
    XLSX.writeFile(wb, `Comparison_Manpower_OMS_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Report exported successfully' });
  };

  const getUniqueValues = (key: keyof OmsEmployee) => {
    return Array.from(new Set(employees.map(d => String(d[key] || '')))).sort();
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  const [screenshotLoading, setScreenshotLoading] = useState(false);

  const copyScreenshot = async () => {
    if (!detailsRef.current) return;
    setScreenshotLoading(true);
    try {
      // Try to use modern async Clipboard API with Promise to prevent user-activation expiry
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        try {
          const blobPromise = htmlToBlob(detailsRef.current, {
            backgroundColor: '#ffffff',
            cacheBust: true,
            pixelRatio: 1, // Render 1x resolution (super fast)
            skipFonts: true, // Skip loading fonts (huge performance boost)
            style: {
              transform: 'scale(1)',
              transformOrigin: 'top left'
            }
          });

          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blobPromise as Promise<Blob>
            })
          ]);
          toast({ title: 'Copied!', description: 'Ready to paste (Ctrl+V).' });
          setScreenshotLoading(false);
          return;
        } catch (clipErr) {
          console.warn('Promise-based clipboard write failed, trying fallback...', clipErr);
        }
      }

      // Traditional fallback
      const blob = await htmlToBlob(detailsRef.current, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 1,
        skipFonts: true,
      });

      if (!blob) {
        toast({ title: 'Failed to create image blob', variant: 'destructive' });
        setScreenshotLoading(false);
        return;
      }

      try {
        if (!navigator.clipboard) throw new Error('Clipboard API not available');
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        toast({ title: 'Copied!', description: 'Ready to paste (Ctrl+V).' });
      } catch (err: any) {
        console.error('Traditional clipboard write failed:', err);
        // If copying to clipboard failed (e.g. non-secure context like HTTP IP address), download the file
        const dataUrl = await htmlToPng(detailsRef.current, {
          backgroundColor: '#ffffff',
          cacheBust: true,
          pixelRatio: 1,
          skipFonts: true,
        });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `Couriers_${selectedSite}.png`;
        link.click();
        toast({
          title: 'Downloaded instead of Copied',
          description: 'Copying is not supported on insecure browsers (HTTP). The image was downloaded instead. Use localhost or HTTPS for direct copying.'
        });
      } finally {
        setScreenshotLoading(false);
      }
    } catch (err) {
      console.error('Screenshot copy failed:', err);
      toast({ title: 'Failed to copy', variant: 'destructive' });
      setScreenshotLoading(false);
    }
  };

  // Sync internal state when props change
  useEffect(() => {
    setEmployees(initialEmployees.filter(e => !isExcludedSite(e.site)));
  }, [initialEmployees]);

  useEffect(() => {
    setPayrollMap(initialPayrollMap);

    // Rebuild payrollMetaMap from payroll comments JSON (to share metadata across team members)
    const newMetaMap = new Map<string, any>();
    initialPayrollMap.forEach((pay, nid) => {
      if (pay.comments) {
        try {
          const str = String(pay.comments).trim();
          if (str.startsWith('{') && str.endsWith('}')) {
            const meta = JSON.parse(str);
            newMetaMap.set(nid, meta);
          }
        } catch (e) {
          // comments is not JSON
        }
      }
    });

    // Fallback to local storage (for the local uploader/legacy data)
    try {
      const stored = localStorage.getItem('oms_payroll_meta');
      if (stored) {
        const obj = JSON.parse(stored) as Record<string, any>;
        Object.entries(obj).forEach(([k, v]) => {
          if (!newMetaMap.has(k)) {
            newMetaMap.set(k, v);
          }
        });
      }
    } catch {}

    setPayrollMetaMap(newMetaMap);
  }, [initialPayrollMap]);

  const load = async () => {
    setLoading(true);
    await onRefresh();
    setLoading(false);
  };

  // ============= Filter =============
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...employees].sort((a, b) => {
      const da = String(a.hiring_date || '').trim();
      const db = String(b.hiring_date || '').trim();
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db);
    });
    return sorted.filter(e => {
      // Global search
      const matchesSearch = !q || [e.name_en, e.name_ar, e.national_id, e.mobile_number, e.partner_id, e.sys_code, e.site]
        .some(v => String(v || '').toLowerCase().includes(q));
      
      if (!matchesSearch) return false;

      // Column filters
      for (const [key, selectedValues] of Object.entries(columnFilters)) {
        if (selectedValues.length > 0) {
          const isExcel = EXCEL_COLS.some(c => c.key === key);
          if (isExcel) {
            const nid = String(e.national_id || '').trim();
            const pay = nid ? payrollMap.get(nid) : undefined;
            const val = pay ? String((pay as any)[key] ?? '').trim() : NOT_ON_OMS;
            if (!selectedValues.includes(val)) return false;
          } else {
            const val = String(e[key as keyof OmsEmployee] || '');
            if (!selectedValues.includes(val)) return false;
          }
        }
      }

      return true;
    });
  }, [employees, search, columnFilters]);

  // ============= Add / Edit / Delete =============
  const startAdd = () => {
    const blank: Partial<OmsEmployee> = { mobile_number: '', sys_code: '', partner_id: '', insur_comp: '', structure_company: '', maxer_id: '', national_id: '', name_en: '', name_ar: '', site: '', gender: '', hiring_date: '' };
    setEditDraft(blank);
    setEditingId(null);
    setSiteOther(false);
    setIsSheetOpen(true);
  };

  const startEdit = (row: OmsEmployee) => {
    setEditingId(row.id);
    setEditDraft({ ...row });
    setSiteOther(!uniqueSites.includes(String(row.site || '').trim()));
    setIsSheetOpen(true);
  };
  const cancelEdit = () => { setEditingId(null); setEditDraft({}); setSiteOther(false); setIsSheetOpen(false); };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const draft: any = { ...editDraft };
    if (draft.name_en && !draft.name_ar) draft.name_ar = autoArabic(draft.name_en);
    
    if (editingId) {
      // Edit
      const updateData = { ...draft };
      delete updateData.id;
      const { error } = await supabase.from('oms_employees').update(updateData).eq('id', editingId);
      if (error) { toast({ title: 'Failed to save', description: error.message, variant: 'destructive' }); return; }
      setEmployees(prev => prev.map(r => r.id === editingId ? { ...r, ...updateData } : r).filter(e => !isExcludedSite(e.site)));
    } else {
      // Add
      const { data, error } = await supabase.from('oms_employees').insert([draft]).select().single();
      if (error) { toast({ title: 'Failed to add', description: error.message, variant: 'destructive' }); return; }
      const newEmp = data as OmsEmployee;
      if (!isExcludedSite(newEmp.site)) {
        setEmployees(prev => [newEmp, ...prev]);
      }
    }
    
    setIsSheetOpen(false);
    setEditingId(null); 
    setEditDraft({});
    toast({ title: editingId ? 'Saved successfully' : 'Created successfully' });
    await onRefresh();
  };

  const deleteRow = async (id: string, name?: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete courier "${name || ''}" from the system?`)) return;
    const { error } = await supabase.from('oms_employees').delete().eq('id', id);
    if (error) { toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' }); return; }
    setEmployees(prev => prev.filter(r => r.id !== id));
    await onRefresh();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const next: Record<string, boolean> = {};
      filtered.forEach(e => {
        next[e.id] = true;
      });
      setMarkedIds(next);
    } else {
      setMarkedIds({});
    }
  };

  const handleToggleMark = (id: string) => {
    setMarkedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleClearMarks = () => {
    setMarkedIds({});
  };

  const handleDeleteMarked = async () => {
    const idsToDelete = Object.keys(markedIds).filter(id => markedIds[id] && employees.some(e => e.id === id));
    if (idsToDelete.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${idsToDelete.length} selected employees from the system?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('oms_employees')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      setEmployees(prev => prev.filter(r => !idsToDelete.includes(r.id)));
      setMarkedIds({});
      toast({ title: 'Success', description: `Deleted ${idsToDelete.length} employees successfully.` });
      await onRefresh();
    } catch (err: any) {
      toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (key: keyof OmsEmployee, val: string) => {
    setEditDraft(prev => {
      const next = { ...prev, [key]: val };
      if (key === 'name_en') next.name_ar = autoArabic(val);
      return next;
    });
  };

  // ============= Excel Upload =============
  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '' });
      if (rows.length < 1) throw new Error('File is empty');

      // Find the header row (search first 10 rows for National ID or equivalent)
      let headerIdx = -1;
      let nidIdx = -1;
      let headerMap = new Map<string, number>();

      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const potentialHeaders = (rows[i] as any[]).map(h => String(h || ''));
        const m = buildHeaderMap(potentialHeaders);
        const foundNid = findColumnIndex(m, ['national id', 'nationalid', 'nid', 'الرقم القومي', 'رقم البطاقة', 'national_id']);
        if (foundNid !== undefined) {
          headerIdx = i;
          nidIdx = foundNid;
          headerMap = m;
          break;
        }
      }

      if (headerIdx === -1 || nidIdx === -1) {
        throw new Error('Could not find National ID column. Please ensure the Excel contains a "National ID" or "الرقم القومي" column.');
      }

      // Employee-related columns that may exist in the payroll Excel
      const EMP_META_COLS = [
        { key: 'mobile_number',     labels: ['mobile', 'phone', 'tel', 'موبايل', 'هاتف', 'تليفون'] },
        { key: 'sys_code',          labels: ['sys code', 'system code', 'كود النظام', 'سيس كود', 'كود الموظف'] },
        { key: 'partner_id',        labels: ['partner', 'شريك', 'بيرتنر'] },
        { key: 'insur_comp',        labels: ['insur', 'insurance', 'تأمين', 'تأمين طبي', 'تأمين اجتماعي'] },
        { key: 'structure_company', labels: ['structure', 'company', 'الشركة', 'كيان'] },
        { key: 'maxer_id',          labels: ['maxer', 'ماكسر'] },
        { key: 'name_en',           labels: ['name en', 'english name', 'الاسم انجليزي', 'الأسم انجليزي'] },
        { key: 'name_ar',           labels: ['name ar', 'arabic name', 'الاسم عربي', 'الأسم عربي', 'الاسم', 'الأسم', 'اسم الموظف'] },
        { key: 'site',              labels: ['site', 'dept', 'الموقع', 'القسم', 'فرع', 'إدارة'] },
        { key: 'gender',            labels: ['gender', 'sex', 'النوع', 'الجنس'] },
        { key: 'hiring_date',       labels: ['hiring', 'join', 'start', 'تعيين', 'تاريخ المباشرة'] },
        { key: 'leaving_date',      labels: ['leaving', 'end', 'استقالة', 'ترك العمل'] },
      ];

      const parsedRows: any[] = [];
      const newMetaMap = new Map<string, any>();
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i] as any[];
        const nid = String(row[nidIdx] ?? '').trim();
        if (!nid) continue;
        const obj: any = { national_id: nid };
        
        // Match EXCEL_COLS (for payroll db)
        EXCEL_COLS.forEach(({ key, label }) => {
          const idx = findColumnIndex(headerMap, [label]);
          obj[key] = idx !== undefined ? String(row[idx] ?? '').trim() : '';
        });

        // Extract employee meta columns
        const meta: any = {};
        EMP_META_COLS.forEach(({ key, labels }) => {
          const idx = findColumnIndex(headerMap, labels);
          if (idx !== undefined) {
            const val = String(row[idx] ?? '').trim();
            if (val) meta[key] = val;
          }
        });
        newMetaMap.set(nid, meta);

        // Store meta + original comment in comments column of payroll DB
        obj.comments = JSON.stringify({
          ...meta,
          comments: obj.comments || ''
        });

        parsedRows.push(obj);
      }
      setPayrollMetaMap(newMetaMap);
      // Persist to localStorage so data survives page refresh
      try {
        const obj: Record<string, any> = {};
        newMetaMap.forEach((v, k) => { obj[k] = v; });
        localStorage.setItem('oms_payroll_meta', JSON.stringify(obj));
      } catch {}

      if (parsedRows.length === 0) throw new Error('No valid rows');

      // Replace: delete all existing then insert
      const del = await supabase.from('oms_payroll').delete().neq('national_id', '___never___');
      if (del.error) throw del.error;

      // Insert in batches
      const BATCH = 500;
      for (let i = 0; i < parsedRows.length; i += BATCH) {
        const slice = parsedRows.slice(i, i + BATCH);
        const { error } = await supabase.from('oms_payroll').upsert(slice, { onConflict: 'national_id' });
        if (error) throw error;
      }

      toast({ title: 'File uploaded', description: `Loaded ${parsedRows.length} rows.` });
      await load();
    } catch (err: any) {
      toast({ title: 'Failed to upload file', description: err?.message || 'Try again', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processToPreview = async (items: any[]): Promise<PreviewEmployee[]> => {
    // Fetch all national IDs to determine new vs update — no exclusions
    const allNationalIds = items.map(x => String(x.national_id || '').trim()).filter(Boolean);

    let existingMap = new Map<string, string>();
    if (allNationalIds.length > 0) {
      const { data: existingEmps, error: fetchError } = await supabase
        .from('oms_employees')
        .select('id, national_id')
        .in('national_id', allNationalIds);

      if (!fetchError && existingEmps) {
        existingEmps.forEach(e => {
          if (e.national_id) {
            existingMap.set(String(e.national_id).trim(), e.id);
          }
        });
      }
    }

    return items.map(emp => {
      const nid = String(emp.national_id || '').trim();
      // No exclusions — every record is either new or update
      const status: 'new' | 'update' | 'excluded' = existingMap.has(nid) ? 'update' : 'new';
      const statusReason = status === 'update' ? 'Update existing employee data' : 'Add new employee';

      return {
        ...emp,
        status,
        statusReason,
      };
    });
  };

  const handleBulkPaste = async () => {
    if (!bulkText.trim()) return;
    setLoading(true);
    try {
      const lines = bulkText.trim().split('\n');
      
      const parseDateStr = (s: string) => {
        if (!s) return '';
        const clean = s.replace(/[ِ]/g, '').replace(/-/g, ' ').trim();
        const d = new Date(clean);
        return isNaN(d.getTime()) ? s : d.toISOString().split('T')[0];
      };

      const rawEmployees: any[] = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split('\t').map(p => p.trim());
        if (parts.every(p => !p)) continue;

        const emp = {
          mobile_number: parts[0] || '',
          sys_code: parts[1] || '',
          partner_id: parts[2] || '',
          insur_comp: parts[3] || '',
          structure_company: parts[4] || '',
          maxer_id: parts[5] || '',
          national_id: parts[6] || '',
          name_en: parts[7] || '',
          name_ar: parts[8] || '',
          site: parts[9] || '',
          gender: parts[10] || '',
          hiring_date: parts[11] ? parseDateStr(parts[11]) : ''
        };

        if (emp.name_en && !emp.name_ar) {
          emp.name_ar = autoArabic(emp.name_en);
        }

        rawEmployees.push(emp);
      }

      if (rawEmployees.length === 0) throw new Error('No valid data found.');

      const previewData = await processToPreview(rawEmployees);
      setPreviewEmployees(previewData);
    } catch (err: any) {
      toast({ title: 'Failed to parse pasted data', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'Mobile Number',
      'SYS Code',
      'Partner ID',
      'Insur. Comp',
      'Structure Company',
      'Maxer ID',
      'National ID',
      'Name En.',
      'Name Ar',
      'Site',
      'Gender',
      'Hiring Date (YYYY-MM-DD)'
    ];
    const data = [
      {
        'Mobile Number': '01012345678',
        'SYS Code': 'SYS123',
        'Partner ID': 'P456',
        'Insur. Comp': 'AXA',
        'Structure Company': 'Company A',
        'Maxer ID': 'MAX789',
        'National ID': '29001011234567',
        'Name En.': 'Ahmed Ali',
        'Name Ar': 'أحمد علي',
        'Site': 'Cairo FC',
        'Gender': 'Male',
        'Hiring Date (YYYY-MM-DD)': '2025-01-01'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'OMS_Employees_Template.xlsx');
    toast({ title: 'Template Downloaded', description: 'The data entry template is now ready to be filled in.' });
  };

  const handleBulkExcelUpload = async (file: File) => {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '' });
      if (rows.length < 2) throw new Error('The file is empty or does not contain enough data (it must contain a header row and at least one data row).');

      let headerIdx = -1;
      let headerMap = new Map<string, number>();

      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const potentialHeaders = (rows[i] as any[]).map(h => String(h || '').trim());
        const m = buildHeaderMap(potentialHeaders);
        const foundNid = findColumnIndex(m, ['national id', 'national_id', 'national_id', 'الرقم القومي', 'رقم البطاقة']);
        if (foundNid !== undefined) {
          headerIdx = i;
          headerMap = m;
          break;
        }
      }

      if (headerIdx === -1) {
        throw new Error('Could not find the National ID column. Please ensure a column with this name exists.');
      }

      // Find indices for employee columns
      const colsMapping = [
        { key: 'mobile_number',     labels: ['mobile number', 'mobile_number', 'mobile', 'موبايل', 'رقم الهاتف', 'الهاتف'] },
        { key: 'sys_code',          labels: ['sys code', 'sys_code', 'كود النظام', 'سيس كود', 'كود الموظف'] },
        { key: 'partner_id',        labels: ['partner id', 'partner_id', 'partner', 'شريك', 'بيرتنر'] },
        { key: 'insur_comp',        labels: ['insur. comp', 'insur_comp', 'insur comp', 'insurance', 'تأمين'] },
        { key: 'structure_company', labels: ['structure company', 'structure_company', 'الشركة', 'كيان', 'structure'] },
        { key: 'maxer_id',          labels: ['maxer id', 'maxer_id', 'maxer'] },
        { key: 'national_id',       labels: ['national id', 'national_id', 'national_id', 'الرقم القومي', 'رقم البطاقة'] },
        { key: 'name_en',           labels: ['name en.', 'name en', 'name_en', 'الاسم انجليزي', 'الاسم بالانجليزية'] },
        { key: 'name_ar',           labels: ['name ar', 'name_ar', 'الاسم عربي', 'الأسم عربي', 'الاسم بالكامل', 'الاسم'] },
        { key: 'site',              labels: ['site', 'الموقع', 'الفرع', 'المخزن'] },
        { key: 'gender',            labels: ['gender', 'النوع', 'الجنس'] },
        { key: 'hiring_date',       labels: ['hiring date', 'hiring_date', 'hiring', 'تعيين', 'تاريخ التعيين', 'تاريخ المباشرة'] },
      ];

      const colIndices: Record<string, number> = {};
      colsMapping.forEach(c => {
        const idx = findColumnIndex(headerMap, c.labels);
        if (idx !== undefined) {
          colIndices[c.key] = idx;
        }
      });

      const parseDateStr = (s: string) => {
        if (!s) return '';
        const clean = s.replace(/[ِ]/g, '').replace(/-/g, ' ').trim();
        const d = new Date(clean);
        return isNaN(d.getTime()) ? s : d.toISOString().split('T')[0];
      };

      const rawEmployees: any[] = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i] as any[];
        if (!row || row.length === 0) continue;
        if (row.every(val => val === '')) continue;

        const nid = colIndices.national_id !== undefined ? String(row[colIndices.national_id] ?? '').trim() : '';

        const emp: any = {
          national_id: nid,
          mobile_number: colIndices.mobile_number !== undefined ? String(row[colIndices.mobile_number] ?? '').trim() : '',
          sys_code: colIndices.sys_code !== undefined ? String(row[colIndices.sys_code] ?? '').trim() : '',
          partner_id: colIndices.partner_id !== undefined ? String(row[colIndices.partner_id] ?? '').trim() : '',
          insur_comp: colIndices.insur_comp !== undefined ? String(row[colIndices.insur_comp] ?? '').trim() : '',
          structure_company: colIndices.structure_company !== undefined ? String(row[colIndices.structure_company] ?? '').trim() : '',
          maxer_id: colIndices.maxer_id !== undefined ? String(row[colIndices.maxer_id] ?? '').trim() : '',
          name_en: colIndices.name_en !== undefined ? String(row[colIndices.name_en] ?? '').trim() : '',
          name_ar: colIndices.name_ar !== undefined ? String(row[colIndices.name_ar] ?? '').trim() : '',
          site: colIndices.site !== undefined ? String(row[colIndices.site] ?? '').trim() : '',
          gender: colIndices.gender !== undefined ? String(row[colIndices.gender] ?? '').trim() : '',
          hiring_date: colIndices.hiring_date !== undefined ? parseDateStr(String(row[colIndices.hiring_date] ?? '')) : '',
        };

        if (emp.name_en && !emp.name_ar) {
          emp.name_ar = autoArabic(emp.name_en);
        }

        rawEmployees.push(emp);
      }

      if (rawEmployees.length === 0) throw new Error('No valid employee data found in the file.');

      const previewData = await processToPreview(rawEmployees);
      setPreviewEmployees(previewData);
    } catch (err: any) {
      toast({ title: 'Bulk upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    }
  };

  const confirmBulkUpload = async () => {
    if (!previewEmployees) return;
    setLoading(true);
    try {
      // Upload ALL employees — no exclusions
      const allEmployees = previewEmployees;
      if (allEmployees.length === 0) {
        throw new Error('No data to upload.');
      }

      const nationalIds = allEmployees.map(emp => emp.national_id).filter(Boolean);
      const { data: existingEmps, error: fetchError } = await supabase
        .from('oms_employees')
        .select('id, national_id')
        .in('national_id', nationalIds);

      if (fetchError) throw fetchError;

      const existingMap = new Map(
        (existingEmps || []).map(e => [String(e.national_id).trim(), e.id])
      );

      const itemsToInsert: any[] = [];
      const itemsToUpdate: { id: string; data: any }[] = [];

      allEmployees.forEach(emp => {
        const nid = String(emp.national_id || '').trim();
        const { status, statusReason, ...dbData } = emp;

        if (nid && existingMap.has(nid)) {
          itemsToUpdate.push({
            id: existingMap.get(nid)!,
            data: dbData
          });
        } else {
          itemsToInsert.push(dbData);
        }
      });

      let insertedData: OmsEmployee[] = [];
      let updatedData: OmsEmployee[] = [];

      if (itemsToInsert.length > 0) {
        const CHUNK_SIZE = 500;
        for (let i = 0; i < itemsToInsert.length; i += CHUNK_SIZE) {
          const slice = itemsToInsert.slice(i, i + CHUNK_SIZE);
          const { data, error } = await supabase
            .from('oms_employees')
            .insert(slice)
            .select();
          if (error) throw error;
          insertedData.push(...((data || []) as OmsEmployee[]));
        }
      }

      if (itemsToUpdate.length > 0) {
        const CHUNK_SIZE = 10;
        for (let i = 0; i < itemsToUpdate.length; i += CHUNK_SIZE) {
          const chunk = itemsToUpdate.slice(i, i + CHUNK_SIZE);
          const updatePromises = chunk.map(async (item) => {
            const { data, error } = await supabase
              .from('oms_employees')
              .update(item.data)
              .eq('id', item.id)
              .select();
            if (error) throw error;
            return data?.[0];
          });
          const results = await Promise.all(updatePromises);
          updatedData.push(...(results.filter(Boolean) as OmsEmployee[]));
        }
      }

      const allMerged = [...insertedData, ...updatedData];

      setEmployees(prev => {
        const existingMapState = new Map(prev.map(e => [e.national_id, e]));
        allMerged.forEach(e => {
          existingMapState.set(e.national_id, e);
        });
        return Array.from(existingMapState.values());
      });

      toast({ title: 'Saved successfully', description: `Added ${insertedData.length} and updated ${updatedData.length} employees successfully.` });
      handleBulkOpenChange(false);
      await load();
    } catch (err: any) {
      toast({ title: 'Failed to save data', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const clearPayroll = async () => {
    if (!confirm('All Excel data will be deleted. Are you sure?')) return;
    const { error } = await supabase.from('oms_payroll').delete().neq('national_id', '___never___');
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    setPayrollMap(new Map());
    toast({ title: 'Deleted successfully' });
  };

  const siteBreakdown = useMemo(() => {
    const counts: Record<string, { total: number; leavers: number }> = {};
    employees.forEach(emp => {
      const s = emp.site || 'No Site';
      if (!counts[s]) counts[s] = { total: 0, leavers: 0 };
      counts[s].total++;
      
      const nid = String(emp.national_id || '').trim();
      const pay = nid ? payrollMap.get(nid) : undefined;
      if (pay && String(pay.leaving_date || '').trim().length > 0) {
        counts[s].leavers++;
      }
    });
    return Object.entries(counts)
      .map(([site, stats]) => ({ site, total: stats.total, leavers: stats.leavers }))
      .sort((a, b) => b.total - a.total);
  }, [employees, payrollMap]);

  // ============= Export =============
  const exportExcel = () => {
    const allCols = [
      ...MANUAL_COLS.map(c => c.label),
      ...EXCEL_COLS.map(c => c.label),
    ];
    const data = filtered.map(emp => {
      const pay = payrollMap.get(String(emp.national_id || '').trim());
      const row: any = {};
      MANUAL_COLS.forEach(c => row[c.label] = (emp as any)[c.key] || '');
      EXCEL_COLS.forEach(c => {
        let val = pay ? (pay as any)[c.key] || '' : NOT_ON_OMS;
        if (c.key === 'comments' && val && String(val).startsWith('{') && String(val).endsWith('}')) {
          try {
            const parsed = JSON.parse(val);
            val = parsed.comments || '';
          } catch {}
        }
        row[c.label] = val;
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: allCols });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OMS Breakdown');
    XLSX.writeFile(wb, `OMS_Breakdown_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ============= Fullscreen =============
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const payrollCount = payrollMap.size;

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-white px-3 py-2 border-b border-slate-200 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 mr-2">
          <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-slate-900 leading-tight">OMS Breakdown</h2>
            <span className="text-[10px] text-slate-500 font-medium">
              {employees.length} EMP · {payrollCount} EXCEL
            </span>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-[200px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button size="sm" onClick={startAdd} className="h-8 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-bold rounded-lg shadow-sm">
            <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Add</span>
          </Button>

          <Dialog open={isBulkOpen} onOpenChange={handleBulkOpenChange}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 px-2.5 text-[11px] bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 gap-1.5 font-bold rounded-lg">
                <ClipboardList className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Bulk</span>
              </Button>
            </DialogTrigger>
            <DialogContent className={`transition-all duration-300 p-0 overflow-hidden bg-white rounded-2xl border-none shadow-2xl ${previewEmployees ? 'max-w-5xl' : 'max-w-2xl'}`}>
              {previewEmployees ? (
                <div className="flex flex-col max-h-[85vh] md:max-h-[80vh]">
                  {/* Step Indicator */}
                  <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div className="space-y-1 text-right" dir="rtl">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 justify-start">
                        <ClipboardList className="w-5 h-5 text-indigo-600" />
                        Review and confirm imported data
                      </h3>
                      <p className="text-slate-500 text-xs">
                        Please review the list below and confirm the data is correct before saving it to the system.
                      </p>
                    </div>
                    {/* Visual Steps */}
                    <div className="flex items-center gap-2 text-xs shrink-0 self-start sm:self-center font-semibold" dir="rtl">
                      <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Upload File
                      </span>
                      <span className="text-slate-300">←</span>
                      <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                        Review Data
                      </span>
                      <span className="text-slate-300">←</span>
                      <span className="text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                        Save
                      </span>
                    </div>
                  </div>

                  {/* KPIs Summary */}
                  <div className="px-6 py-4 bg-slate-50/30 border-b border-slate-100 grid grid-cols-3 gap-3 shrink-0" dir="rtl">
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
                      <span className="text-slate-500 text-[10px] font-bold">Total Rows</span>
                      <span className="text-lg font-black text-slate-800 mt-1">{previewKPIs.total}</span>
                    </div>
                    <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100/50 shadow-sm flex flex-col justify-between">
                      <span className="text-emerald-700 text-[10px] font-bold">New Employees (to be added)</span>
                      <span className="text-lg font-black text-emerald-600 mt-1">{previewKPIs.newCount}</span>
                    </div>
                    <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-100/50 shadow-sm flex flex-col justify-between">
                      <span className="text-blue-700 text-[10px] font-bold">Updates (existing employees)</span>
                      <span className="text-lg font-black text-blue-600 mt-1">{previewKPIs.updateCount}</span>
                    </div>
                  </div>

                  {/* Search and Filter Row */}
                  <div className="px-6 py-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white shrink-0">
                    <div className="relative flex-1 max-w-md w-full" dir="rtl">
                      <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Search by name, national ID, or phone..."
                        value={previewSearch}
                        onChange={e => setPreviewSearch(e.target.value)}
                        className="pl-4 pr-10 py-2 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-right"
                        dir="rtl"
                      />
                    </div>
                    
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-end md:self-auto shrink-0" dir="rtl">
                      {(['all', 'new', 'update'] as const).map(status => {
                        const label = 
                          status === 'all' ? 'All' : 
                          status === 'new' ? 'New' : 'Update';
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setPreviewFilterStatus(status)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                              previewFilterStatus === status
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Table area */}
                  <div className="flex-1 overflow-auto px-6 py-4 bg-slate-50/10">
                    <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-sm">
                      <table className="min-w-full divide-y divide-slate-100 text-right" dir="rtl">
                        <thead className="bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                          <tr>
                            <th className="px-4 py-3 text-right">Full Name (Arabic/English)</th>
                            <th className="px-4 py-3 text-right">National ID</th>
                            <th className="px-4 py-3 text-right">Site</th>
                            <th className="px-4 py-3 text-right">Phone / System Code</th>
                            <th className="px-4 py-3 text-right">Company / Maxer ID</th>
                            <th className="px-4 py-3 text-right">Gender / Hiring Date</th>
                            <th className="px-4 py-3 text-right">Status & Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredPreview.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                No data matching the current search and filter options.
                              </td>
                            </tr>
                          ) : (
                            filteredPreview.map((emp, idx) => {
                              const badgeStyle = 
                                emp.status === 'new' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : emp.status === 'update' 
                                    ? 'bg-blue-50 text-blue-700 border-blue-100' 
                                    : 'bg-rose-50 text-rose-700 border-rose-100';
                              
                              const statusLabel = 
                                emp.status === 'new' ? 'New' : 
                                emp.status === 'update' ? 'Update' : 'Excluded';

                              return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-4 py-2.5">
                                    <div className="font-semibold text-slate-800">{emp.name_ar || '-'}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.name_en || '-'}</div>
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-slate-600">
                                    {emp.national_id || '-'}
                                  </td>
                                  <td className="px-4 py-2.5 font-semibold text-slate-700">
                                    {emp.site || '-'}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <div className="text-slate-600 font-mono">{emp.mobile_number || '-'}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">SYS: {emp.sys_code || '-'}</div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <div className="text-slate-700">{emp.structure_company || '-'}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">Maxer: {emp.maxer_id || '-'}</div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <div className="text-slate-600">{emp.gender || '-'}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.hiring_date || '-'}</div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <div className="flex flex-col gap-1 items-start">
                                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyle}`}>
                                        {statusLabel}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-medium text-right">
                                        {emp.statusReason}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                    <Button
                      variant="ghost"
                      onClick={() => handleBulkOpenChange(false)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-700 rounded-xl"
                    >
                      Cancel
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setPreviewEmployees(null)}
                        className="text-xs font-bold border-slate-200 text-slate-700 rounded-xl bg-white hover:bg-slate-50"
                      >
                        Go Back and Change File
                      </Button>
                      <Button
                        onClick={confirmBulkUpload}
                        disabled={loading || previewKPIs.total === 0}
                        className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 py-2 shadow-sm"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Confirm and Save All ({previewKPIs.total})
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                    <DialogHeader className="text-left space-y-1">
                      <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-indigo-600" />
                        Bulk Upload of Employee Data (Bulk Upload)
                      </DialogTitle>
                      <DialogDescription className="text-slate-500 text-xs">
                        Choose your preferred upload method below to register employees in bulk.
                      </DialogDescription>
                    </DialogHeader>
                  </div>

                  <div className="p-6">
                    {/* Mode Selector Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mb-6">
                      <button
                        type="button"
                        onClick={() => setBulkMode('excel')}
                        className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                          bulkMode === 'excel'
                            ? 'bg-white text-indigo-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Upload Excel File (Recommended)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkMode('paste')}
                        className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                          bulkMode === 'paste'
                            ? 'bg-white text-indigo-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Paste Text Directly from a Table
                      </button>
                    </div>

                    {bulkMode === 'excel' ? (
                      <div className="space-y-6">
                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800 text-xs leading-relaxed">
                          <AlertTriangle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold mb-1">Bulk upload instructions:</p>
                            <p>1. Download the empty Excel template first.</p>
                            <p>2. Fill in the courier and employee data accurately in the specified columns.</p>
                            <p>3. Save the file, then upload it here to automatically enter and update the data.</p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                          <div className="text-xs text-slate-500">
                            <p className="font-semibold text-slate-700 mb-0.5">Step One:</p>
                            <p>Download the standard entry template</p>
                          </div>
                          <Button
                            type="button"
                            onClick={downloadTemplate}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold px-6 h-10 rounded-lg gap-2 shrink-0 w-full sm:w-auto"
                          >
                            <Download className="w-4 h-4 text-indigo-600" />
                            Download Empty Template
                          </Button>
                        </div>

                        <div className="border-t border-slate-100 pt-4 space-y-3">
                          <p className="text-xs font-semibold text-slate-700">Step Two: Upload the completed file</p>
                          <div
                            onClick={() => bulkFileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/20 cursor-pointer rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all text-center"
                          >
                            <div className="bg-indigo-50 p-3 rounded-full text-indigo-600">
                              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-slate-800">Click here to select and upload an Excel file</p>
                              <p className="text-xs text-slate-400">Supports Excel formats (.xlsx, .xls)</p>
                            </div>
                            <input
                              ref={bulkFileInputRef}
                              type="file"
                              accept=".xlsx,.xls"
                              className="hidden"
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) handleBulkExcelUpload(f);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <DialogDescription className="text-slate-500 text-xs leading-relaxed">
                          Copy the cells from your Excel table and paste them here directly. Required column order: 
                          <span className="font-mono bg-slate-100 px-1 rounded mx-0.5 text-indigo-600 text-[10px]">Mobile</span>, 
                          <span className="font-mono bg-slate-100 px-1 rounded mx-0.5 text-indigo-600 text-[10px]">SysCode</span>, 
                          <span className="font-mono bg-slate-100 px-1 rounded mx-0.5 text-indigo-600 text-[10px]">PartnerID</span>, 
                          <span className="font-mono bg-slate-100 px-1 rounded mx-0.5 text-indigo-600 text-[10px]">Insur</span>, 
                          <span className="font-mono bg-slate-100 px-1 rounded mx-0.5 text-indigo-600 text-[10px]">Structure</span>, 
                          <span className="font-mono bg-slate-100 px-1 rounded mx-0.5 text-indigo-600 text-[10px]">Maxer</span>, 
                          <span className="font-mono bg-slate-100 px-1 rounded mx-0.5 text-indigo-600 text-[10px]">NationalID</span>, 
                          <span className="font-mono bg-slate-100 px-1 rounded mx-0.5 text-indigo-600 text-[10px]">NameEn</span>, 
                          <span className="font-mono bg-slate-100 px-1 rounded mx-0.5 text-indigo-600 text-[10px]">NameAr</span>, 
                          <span className="font-mono bg-slate-100 px-1 rounded mx-0.5 text-indigo-600 text-[10px]">Site</span>, 
                          <span className="font-mono bg-slate-100 px-1 rounded mx-0.5 text-indigo-600 text-[10px]">Gender</span>, 
                          <span className="font-mono bg-slate-100 bg-slate-100 px-1 rounded mx-0.5 text-indigo-600 text-[10px]">HiringDate</span>.
                        </DialogDescription>
                        <textarea
                          value={bulkText}
                          onChange={e => setBulkText(e.target.value)}
                          placeholder="Paste cells and data here..."
                          className="w-full h-60 p-3 text-xs font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                        />
                        <div className="flex justify-end gap-2 border-t pt-4">
                          <Button variant="ghost" size="sm" onClick={() => handleBulkOpenChange(false)} className="rounded-lg">Cancel</Button>
                          <Button
                            size="sm"
                            onClick={handleBulkPaste}
                            disabled={loading || !bulkText.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg px-6"
                          >
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Save className="w-3.5 h-3.5 mr-2" />}
                            Save and Process Data
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isMpCompareOpen} onOpenChange={setIsMpCompareOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={handleMpCompareOpen} className="h-8 px-2.5 text-[11px] bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 gap-1.5 font-bold rounded-lg transition-all shadow-sm">
                <Users className="w-3.5 h-3.5 text-amber-600" /> 
                <span className="hidden sm:inline">Compare Manpower</span> 
                {(!mpCompareLoading && (mpCompareResults.missingFromOms.length + mpCompareResults.missingFromManpower.length + mpCompareResults.mismatches.length) > 0) && (
                  <span className="bg-amber-600 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                    {mpCompareResults.missingFromOms.length + mpCompareResults.missingFromManpower.length + mpCompareResults.mismatches.length}
                  </span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl bg-white">
              <div className="p-6 border-b bg-white">
                <DialogHeader dir="rtl">
                  <div className="flex items-center justify-between flex-row-reverse">
                    <div className="text-right">
                      <DialogTitle className="flex items-center gap-2 text-amber-600 text-lg justify-end">
                        <Users className="w-5 h-5" /> Manpower & OMS Matching Report
                      </DialogTitle>
                      <DialogDescription className="mt-1 text-right text-xs">
                        Review the differences and gaps between the employee database (OMS) and active couriers in HR (Manpower).
                      </DialogDescription>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 flex-row-reverse" dir="rtl">
                      <Button
                        type="button"
                        variant={mpCompareMode === 'missing_from_oms' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setMpCompareMode('missing_from_oms')}
                        className={`h-8 px-3 text-xs gap-1.5 rounded-lg transition-all ${mpCompareMode === 'missing_from_oms' ? 'bg-white text-amber-700 shadow-sm hover:bg-white' : 'text-slate-500 hover:bg-slate-200'}`}
                      >
                        Missing from OMS ({mpCompareResults.missingFromOms.length})
                      </Button>
                      <Button
                        type="button"
                        variant={mpCompareMode === 'missing_from_manpower' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setMpCompareMode('missing_from_manpower')}
                        className={`h-8 px-3 text-xs gap-1.5 rounded-lg transition-all ${mpCompareMode === 'missing_from_manpower' ? 'bg-white text-amber-700 shadow-sm hover:bg-white' : 'text-slate-500 hover:bg-slate-200'}`}
                      >
                        Missing from Manpower ({mpCompareResults.missingFromManpower.length})
                      </Button>
                      <Button
                        type="button"
                        variant={mpCompareMode === 'mismatches' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setMpCompareMode('mismatches')}
                        className={`h-8 px-3 text-xs gap-1.5 rounded-lg transition-all ${mpCompareMode === 'mismatches' ? 'bg-white text-amber-700 shadow-sm hover:bg-white' : 'text-slate-500 hover:bg-slate-200'}`}
                      >
                        Mismatched Data ({mpCompareResults.mismatches.length})
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
                {mpCompareLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                    <span className="text-sm font-bold text-slate-500">Loading and comparing data...</span>
                  </div>
                ) : mpCompareMode === 'missing_from_oms' ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white p-3 border rounded-xl" dir="rtl">
                      <span className="text-xs text-slate-500 font-semibold">Couriers registered in Manpower and active, but not registered in the OMS database.</span>
                      {mpCompareResults.missingFromOms.length > 0 && (
                        <Button
                          size="sm"
                          disabled={mpActionLoading}
                          onClick={() => addAllToOms(mpCompareResults.missingFromOms)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-8 rounded-lg"
                        >
                          Add All to OMS
                        </Button>
                      )}
                    </div>
                    <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                      <table className="w-full text-[11px] text-right border-collapse" dir="rtl">
                        <thead className="bg-slate-50 sticky top-0 border-b z-10 text-slate-500 font-bold">
                          <tr>
                            <th className="p-3 border-l">Name in Manpower</th>
                            <th className="p-3 border-l">System Code</th>
                            <th className="p-3 border-l">National ID</th>
                            <th className="p-3 border-l">Mobile</th>
                            <th className="p-3 border-l">Region</th>
                            <th className="p-3 border-l">Type / Status</th>
                            <th className="p-3 text-center w-28">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {mpCompareResults.missingFromOms.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-12 text-center text-slate-400 italic">
                                <div className="flex flex-col items-center gap-2">
                                  <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50" />
                                  <span>No gaps. All Manpower couriers are registered in OMS.</span>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            mpCompareResults.missingFromOms.map((m, i) => (
                              <tr key={i} className="hover:bg-amber-50/20 transition-colors">
                                <td className="p-3 border-l font-semibold text-slate-800">{m.courier_name}</td>
                                <td className="p-3 border-l font-mono text-slate-600">{m.system || '—'}</td>
                                <td className="p-3 border-l font-mono text-slate-600">{m.id_number || '—'}</td>
                                <td className="p-3 border-l font-mono text-slate-600">{m.mobile || '—'}</td>
                                <td className="p-3 border-l font-semibold text-slate-700">{m.region || '—'}</td>
                                <td className="p-3 border-l text-slate-500">{m.employment_type || 'Fixed'} / {m.status}</td>
                                <td className="p-3 text-center">
                                  <Button
                                    size="sm"
                                    onClick={() => addToOms(m)}
                                    disabled={mpActionLoading}
                                    className="h-7 text-[10px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md"
                                  >
                                    Add to OMS
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : mpCompareMode === 'missing_from_manpower' ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white p-3 border rounded-xl" dir="rtl">
                      <span className="text-xs text-slate-500 font-semibold">Employees registered in OMS but not found in the HR sheet (Manpower).</span>
                      {mpCompareResults.missingFromManpower.length > 0 && (
                        <Button
                          size="sm"
                          disabled={mpActionLoading}
                          onClick={() => addAllToManpower(mpCompareResults.missingFromManpower)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-8 rounded-lg"
                        >
                          Add All to Manpower
                        </Button>
                      )}
                    </div>
                    <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                      <table className="w-full text-[11px] text-right border-collapse" dir="rtl">
                        <thead className="bg-slate-50 sticky top-0 border-b z-10 text-slate-500 font-bold">
                          <tr>
                            <th className="p-3 border-l">Full Name (Arabic/English)</th>
                            <th className="p-3 border-l">System Code / Partner ID</th>
                            <th className="p-3 border-l">National ID</th>
                            <th className="p-3 border-l">Mobile</th>
                            <th className="p-3 border-l">Site</th>
                            <th className="p-3 border-l">Company & Structure</th>
                            <th className="p-3 border-l">Leaving Date</th>
                            <th className="p-3 text-center w-36">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {mpCompareResults.missingFromManpower.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-12 text-center text-slate-400 italic">
                                <div className="flex flex-col items-center gap-2">
                                  <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50" />
                                  <span>No gaps. All OMS employees are registered in Manpower.</span>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            mpCompareResults.missingFromManpower.map((o, i) => {
                              const pay = o.national_id ? payrollMap.get(String(o.national_id).trim()) : undefined;
                              const leavingDate = pay?.leaving_date || '—';
                              return (
                                <tr key={i} className="hover:bg-amber-50/20 transition-colors">
                                  <td className="p-3 border-l">
                                    <div className="font-semibold text-slate-800">{o.name_ar || '—'}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{o.name_en || '—'}</div>
                                  </td>
                                  <td className="p-3 border-l">
                                    <div className="font-mono text-slate-600">SYS: {o.sys_code || '—'}</div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">Partner: {o.partner_id || '—'}</div>
                                  </td>
                                  <td className="p-3 border-l font-mono text-slate-600">{o.national_id || '—'}</td>
                                  <td className="p-3 border-l font-mono text-slate-600">{o.mobile_number || '—'}</td>
                                  <td className="p-3 border-l font-semibold text-slate-700">{o.site || '—'}</td>
                                  <td className="p-3 border-l text-slate-500">{o.structure_company || '—'}</td>
                                  <td className="p-3 border-l font-mono text-rose-600 font-bold">{leavingDate}</td>
                                  <td className="p-3 text-center">
                                    <Button
                                      size="sm"
                                      onClick={() => addToManpower(o)}
                                      disabled={mpActionLoading}
                                      className="h-7 text-[10px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md"
                                    >
                                      Add to Manpower
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-white p-3 border rounded-xl text-right text-xs text-slate-500 font-semibold" dir="rtl">
                      Comparing couriers who match by national ID but have differences in details (name or system code).
                    </div>
                    <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                      <table className="w-full text-[11px] text-right border-collapse" dir="rtl">
                        <thead className="bg-slate-50 sticky top-0 border-b z-10 text-slate-500 font-bold">
                          <tr>
                            <th className="p-3 border-l">National ID</th>
                            <th className="p-3 border-l text-amber-700 bg-amber-50/20">Data in Manpower</th>
                            <th className="p-3 border-l text-indigo-700 bg-indigo-50/20">Data in OMS</th>
                            <th className="p-3 border-l">Mismatch Reason</th>
                            <th className="p-3 text-center w-36">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {mpCompareResults.mismatches.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-12 text-center text-slate-400 italic">
                                <div className="flex flex-col items-center gap-2">
                                  <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50" />
                                  <span>No data mismatches. Perfect match!</span>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            mpCompareResults.mismatches.map((m, i) => (
                              <tr key={i} className="hover:bg-amber-50/20 transition-colors">
                                <td className="p-3 border-l font-mono font-bold text-slate-800">{m.manpower.id_number}</td>
                                <td className="p-3 border-l bg-amber-50/10">
                                  <div className="font-semibold text-amber-900">{m.manpower.courier_name}</div>
                                  <div className="text-[10px] text-amber-700 font-mono mt-0.5">Code: {m.manpower.system || '—'}</div>
                                </td>
                                <td className="p-3 border-l bg-indigo-50/10">
                                  <div className="font-semibold text-indigo-950">{m.oms.name_ar || m.oms.name_en}</div>
                                  <div className="text-[10px] text-indigo-700 font-mono mt-0.5">Code: {m.oms.partner_id || m.oms.sys_code || '—'}</div>
                                </td>
                                <td className="p-3 border-l text-rose-600 font-bold">{m.reason}</td>
                                <td className="p-3 text-center">
                                  <Button
                                    size="sm"
                                    onClick={() => syncOmsWithManpower(m.manpower, m.oms)}
                                    disabled={mpActionLoading}
                                    className="h-7 text-[10px] px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md"
                                  >
                                    Sync OMS to Match
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-white border-t flex justify-between items-center flex-row-reverse" dir="rtl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {mpCompareMode === 'missing_from_oms' ? `Total gaps: ${mpCompareResults.missingFromOms.length} couriers` : mpCompareMode === 'missing_from_manpower' ? `Total gaps: ${mpCompareResults.missingFromManpower.length} couriers` : `Total mismatches: ${mpCompareResults.mismatches.length}`}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setIsMpCompareOpen(false)} className="text-slate-500 font-bold rounded-lg">Close</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportMpComparisonExcel}
                    className="border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 rounded-lg gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Report
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAuditOpen} onOpenChange={setIsAuditOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className={`h-8 px-2.5 text-[11px] gap-1.5 font-bold rounded-lg transition-all ${missingFromSystem.length > 0 || missingFromExcel.length > 0 ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                <AlertTriangle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Audit</span> <span className="bg-red-600 text-white px-1.5 py-0.5 rounded-full text-[9px]">{missingFromSystem.length + missingFromExcel.length}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
              <div className="p-6 border-b bg-white">
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <DialogTitle className="flex items-center gap-2 text-red-600 text-xl">
                        <AlertTriangle className="w-6 h-6" /> Mismatch Audit Report
                      </DialogTitle>
                      <DialogDescription className="mt-1">
                        Review discrepancies between System Database and Payroll Excel.
                      </DialogDescription>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <Button
                        variant={auditMode === 'missing_from_system' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setAuditMode('missing_from_system')}
                        className={`h-9 px-4 text-xs gap-2 rounded-lg transition-all ${auditMode === 'missing_from_system' ? 'bg-white text-indigo-700 shadow-sm hover:bg-white' : 'text-slate-500 hover:bg-slate-200'}`}
                      >
                        <Users className="w-4 h-4" />
                        Missing from System ({missingFromSystem.length})
                      </Button>
                      <Button
                        variant={auditMode === 'missing_from_excel' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setAuditMode('missing_from_excel')}
                        className={`h-9 px-4 text-xs gap-2 rounded-lg transition-all ${auditMode === 'missing_from_excel' ? 'bg-white text-indigo-700 shadow-sm hover:bg-white' : 'text-slate-500 hover:bg-slate-200'}`}
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Missing from Excel ({missingFromExcel.length})
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
                {auditMode === 'missing_from_system' ? (
                  <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 border-b z-10">
                        <tr>
                          <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap w-20">Action</th>
                          {AUDIT_COLS.map(c => (
                            <th key={c.key} className="p-3 font-bold text-slate-600 border-r whitespace-nowrap">{c.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {missingFromSystem.length === 0 ? (
                          <tr>
                            <td colSpan={AUDIT_COLS.length + 1} className="p-12 text-center text-slate-400 italic">
                              <div className="flex flex-col items-center gap-2">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50" />
                                <span>No mismatches found. All payroll records match registered employees.</span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          missingFromSystem.map((p, i) => (
                            <tr key={i} className="hover:bg-red-50 transition-colors">
                              <td className="p-3 border-r">
                                <Button
                                  size="sm"
                                  onClick={() => acceptMissing([p])}
                                  disabled={auditAccepting}
                                  className="h-7 text-[10px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md"
                                >
                                  {auditAccepting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Accept'}
                                </Button>
                              </td>
                              {AUDIT_COLS.map(c => (
                                <td key={c.key} className={`p-3 border-r max-w-[180px] truncate ${c.key === 'national_id' ? 'font-mono text-indigo-700 font-semibold' : 'text-slate-700'}`}>
                                  {p[c.key] || <span className="text-slate-300">—</span>}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 border-b z-10">
                        <tr>
                          <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap">National ID</th>
                          <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap">Name (Arabic)</th>
                          <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap">Name (English)</th>
                          <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap">Site</th>
                          <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap">Mobile</th>
                          <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {missingFromExcel.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-12 text-center text-slate-400 italic">
                              <div className="flex flex-col items-center gap-2">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50" />
                                <span>All dashboard employees are present in the uploaded Excel.</span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          missingFromExcel.map((e, i) => (
                            <tr key={i} className="hover:bg-amber-50/50 transition-colors">
                              <td className="p-3 border-r font-mono text-indigo-700 font-semibold">{e.national_id}</td>
                              <td className="p-3 border-r text-right font-medium">{e.name_ar}</td>
                              <td className="px-3 py-2 text-slate-700">{e.name_en}</td>
                              <td className="p-3 border-r font-bold text-slate-600">{e.site}</td>
                              <td className="p-3 border-r text-slate-600">{e.mobile_number}</td>
                              <td className="p-3 text-right">
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[9px] uppercase">Missing in Excel</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="p-4 bg-white border-t flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {auditMode === 'missing_from_system' ? `Found ${missingFromSystem.length} system mismatches` : `Found ${missingFromExcel.length} excel mismatches`}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setIsAuditOpen(false)} className="text-slate-500 font-bold">Close</Button>
                  {auditMode === 'missing_from_system' && missingFromSystem.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => acceptMissing(missingFromSystem)}
                      disabled={auditAccepting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold px-6"
                    >
                      {auditAccepting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Accept All & Add to System
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="hidden"
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-8 px-2.5 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-bold rounded-lg shadow-sm"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{payrollCount > 0 ? 'Replace' : 'Upload'}</span>
          </Button>

          {payrollCount > 0 && (
            <Button size="sm" variant="outline" onClick={clearPayroll} className="h-8 w-8 p-0 border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg" title="Clear Excel">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}

          <Button size="sm" variant="outline" onClick={exportExcel} className="h-8 w-8 p-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg" title="Export Excel">
            <Download className="w-3.5 h-3.5" />
          </Button>

          <div className="w-[1px] h-6 bg-slate-200 mx-1 hidden md:block" />

          <Button size="sm" variant="outline" onClick={load} className="h-8 w-8 p-0 font-bold rounded-lg" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>

          <Button size="sm" variant="outline" onClick={toggleFullscreen} className="h-8 w-8 p-0 font-bold rounded-lg" title="Fullscreen">
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>

          <Dialog open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 px-2.5 text-[11px] gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 font-bold rounded-lg">
                <PieChart className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Breakdown</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-blue-600" />
                  Site Breakdown & Courier Details
                </DialogTitle>
              </DialogHeader>
              
              <div className="flex-1 overflow-auto py-4 space-y-6 scrollbar-thin">
                {/* Summary Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="border-b">
                        <th className="text-left px-4 py-2 font-semibold text-slate-600">Site Name</th>
                        <th className="text-right px-4 py-2 font-semibold text-rose-600">Leavers</th>
                        <th className="text-right px-4 py-2 font-semibold text-slate-600">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {siteBreakdown.map((item) => (
                        <tr 
                          key={item.site} 
                          className={`border-b last:border-0 hover:bg-blue-50 cursor-pointer transition-colors ${selectedSite === item.site ? 'bg-blue-50' : ''}`}
                          onClick={() => setSelectedSite(item.site)}
                        >
                          <td className="px-4 py-2 text-slate-700 font-medium">{item.site}</td>
                          <td className="px-4 py-2 text-right text-rose-600 font-bold">{item.leavers || 0}</td>
                          <td className="px-4 py-2 text-right font-medium text-slate-900">{item.total}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2">
                        <td className="px-4 py-2">Total Summary</td>
                        <td className="px-4 py-2 text-right text-rose-600">
                          {siteBreakdown.reduce((sum, item) => sum + item.leavers, 0)}
                        </td>
                        <td className="px-4 py-2 text-right">{employees.length}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Site Details Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-500" />
                      {selectedSite ? `Couriers in ${selectedSite}` : 'Select a site to view names'}
                      {selectedSite && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={copyScreenshot}
                          disabled={screenshotLoading}
                          className="camera-icon-btn h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 ml-1"
                          title="Copy Screenshot to Clipboard (Ctrl+V)"
                        >
                          {screenshotLoading ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <Camera className="w-4 h-4" />}
                        </Button>
                      )}
                    </h3>
                    {selectedSite && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSite(null)} className="h-7 text-xs text-slate-500">
                        Clear Selection
                      </Button>
                    )}
                  </div>

                  {selectedSite ? (
                    <div ref={detailsRef} className="border rounded-lg overflow-hidden bg-white p-1">
                      <div className="bg-slate-50 px-3 py-2 border-b mb-1 rounded-t-sm flex justify-between items-center">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Site: {selectedSite}</span>
                        <span className="text-[10px] text-slate-400">{new Date().toLocaleDateString()}</span>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr className="border-b">
                            <th className="text-left px-3 py-2 text-slate-500">Name</th>
                            <th className="text-left px-3 py-2 text-slate-500">National ID</th>
                            <th className="text-right px-3 py-2 text-slate-500">Status / Leaving Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {employees
                            .filter(e => e.site === selectedSite)
                            .map(e => {
                              const nid = String(e.national_id || '').trim();
                              const pay = nid ? payrollMap.get(nid) : undefined;
                              const leaveDate = pay ? String(pay.leaving_date || '').trim() : '';
                              return (
                                <tr key={e.id} className={`hover:bg-slate-50 ${leaveDate ? 'bg-rose-50/30' : ''}`}>
                                  <td className="px-3 py-2">
                                    <div className="font-semibold text-slate-900">{e.name_ar || e.name_en}</div>
                                    <div className="text-[10px] text-slate-500">{e.name_en}</div>
                                  </td>
                                  <td className="px-3 py-2 font-mono text-slate-600">{e.national_id}</td>
                                  <td className="px-3 py-2 text-right">
                                    {leaveDate ? (
                                      <span className="inline-flex flex-col items-end">
                                        <span className="text-rose-600 font-bold">LEAVER</span>
                                        <span className="text-[10px] text-rose-500">{leaveDate}</span>
                                      </span>
                                    ) : (
                                      <span className="text-emerald-600 font-medium">Active</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-lg text-slate-400 text-sm">
                      Click on a site in the table above to see the list of couriers.
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {markedCount > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between text-xs transition-all duration-200 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2 text-amber-800 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Selected rows: <strong className="text-amber-950 font-bold">{markedCount}</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleClearMarks}
              className="h-7 text-[11px] border-amber-300 text-amber-800 hover:bg-amber-100/50 bg-white font-semibold"
            >
              Clear Selection (Deselect)
            </Button>
            <Button 
              size="sm" 
              onClick={handleDeleteMarked}
              className="h-7 text-[11px] bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1 rounded"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete Selected from System
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        {globalLoading && employees.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No data. Add an employee or upload an Excel file.</p>
          </div>
        ) : (
          <table className="text-xs border-collapse" style={{ minWidth: 'max-content' }}>
            <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-2 py-2 border border-slate-200 font-semibold text-slate-700 sticky left-0 bg-slate-100 z-30 w-10 text-center">
                  <Checkbox 
                    checked={filtered.length > 0 && filtered.every(e => markedIds[e.id])}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    className="border-slate-400 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                  />
                </th>
                <th className="px-2 py-2 border border-slate-200 font-semibold text-slate-700 sticky left-10 bg-slate-100 z-20">#</th>
                {MANUAL_COLS.map(c => (
                  <th key={c.key} className="px-2 py-2 border border-slate-200 font-semibold text-slate-700 whitespace-nowrap bg-blue-50/50 min-w-[120px]">
                    <div className="flex items-center justify-between gap-2">
                      {c.label}
                      <ColumnFilter 
                        label={c.label} 
                        options={getUniqueValues(c.key)} 
                        selected={columnFilters[c.key] || []} 
                        onSelect={(vals) => setColumnFilters(f => ({ ...f, [c.key]: vals }))} 
                      />
                    </div>
                  </th>
                ))}
                
                {EXCEL_COLS.map(c => (
                  <th key={c.key} className="px-2 py-2 border border-slate-200 font-semibold text-slate-700 whitespace-nowrap bg-amber-50 min-w-[120px]">
                    <div className="flex items-center justify-between gap-2">
                      {c.label}
                      <ColumnFilter 
                        label={c.label} 
                        options={Array.from(new Set(employees.map(emp => {
                          const nid = String(emp.national_id || '').trim();
                          const pay = nid ? payrollMap.get(nid) : undefined;
                          return pay ? String((pay as any)[c.key] ?? '').trim() : NOT_ON_OMS;
                        }))).sort()} 
                        selected={columnFilters[c.key] || []} 
                        onSelect={(vals) => setColumnFilters(f => ({ ...f, [c.key]: vals }))} 
                      />
                    </div>
                  </th>
                ))}
                <th className="px-2 py-2 border border-slate-200 font-semibold text-slate-700 sticky right-0 bg-slate-100 z-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, idx) => {
                const nid = String(emp.national_id || '').trim();
                const pay = nid ? payrollMap.get(nid) : undefined;
                const hasLeaving = pay && String(pay.leaving_date || '').trim().length > 0;
                const isMarked = !!markedIds[emp.id];
                
                let rowBg = hasLeaving ? 'bg-rose-50 hover:bg-rose-100' : 'hover:bg-slate-50';
                if (isMarked) {
                  rowBg = 'bg-amber-50 hover:bg-amber-100/70';
                }

                return (
                  <tr key={emp.id} className={rowBg}>
                    <td className={`px-2 py-1 border border-slate-200 text-center sticky left-0 z-30 w-10 ${isMarked ? 'bg-amber-50' : (hasLeaving ? 'bg-rose-50' : 'bg-white')}`}>
                      <Checkbox 
                        checked={isMarked}
                        onCheckedChange={() => handleToggleMark(emp.id)}
                        className="border-slate-400 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                      />
                    </td>
                    <td className={`px-2 py-1 border border-slate-200 text-center text-slate-500 sticky left-10 z-10 ${isMarked ? 'bg-amber-50' : (hasLeaving ? 'bg-rose-50' : 'bg-white')}`}>
                      {idx + 1}
                    </td>
                    {MANUAL_COLS.map(c => (
                      <td key={c.key} className={`px-2 py-1 border border-slate-200 whitespace-nowrap ${c.key === 'name_ar' ? 'text-right' : ''}`}>
                        <span className="text-slate-700">{(emp[c.key] as string) || ''}</span>
                      </td>
                    ))}
                    {EXCEL_COLS.map(c => {
                      let v = pay ? String((pay as any)[c.key] ?? '').trim() : '';
                      if (c.key === 'comments' && v.startsWith('{') && v.endsWith('}')) {
                        try {
                          const parsed = JSON.parse(v);
                          v = parsed.comments || '';
                        } catch {}
                      }
                      const isMissing = !pay;
                      return (
                        <td key={c.key} className="px-2 py-1 border border-slate-200 whitespace-nowrap">
                          {isMissing ? (
                            <span className="text-rose-500 italic text-[11px]">{NOT_ON_OMS}</span>
                          ) : (
                            <span className="text-slate-700">{v}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className={`px-2 py-1 border border-slate-200 sticky right-0 z-10 ${isMarked ? 'bg-amber-50' : (hasLeaving ? 'bg-rose-50' : 'bg-white')}`}>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => startEdit(emp)} className="h-6 px-2 text-[10px] text-indigo-600 hover:bg-indigo-50 border-indigo-100 bg-white">
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => deleteRow(emp.id, emp.name_ar || emp.name_en)} 
                          className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-all"
                          title="Delete from system"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Employee Dialog */}
      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="sm:max-w-xl w-full p-0 bg-white overflow-hidden rounded-xl border-none shadow-2xl">
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl font-bold text-slate-900">
                {editingId ? 'Edit Employee Record' : 'Add New Employee'}
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-sm">
                Fill in the details for the OMS employee record.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="max-h-[80vh] overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-slate-200">
            <form onSubmit={saveEdit} className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider">Basic Information</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Name (English)</label>
                    <input 
                      required 
                      type="text" 
                      value={editDraft.name_en || ''} 
                      onChange={e => updateDraft('name_en', e.target.value)} 
                      placeholder="e.g. Mohamed Ahmed"
                      className="w-full text-sm border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-4 py-2.5 transition-all outline-none font-medium text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Name (Arabic)</label>
                      <input 
                        type="text" 
                        value={editDraft.name_ar || ''} 
                        onChange={e => updateDraft('name_ar', e.target.value)} 
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-3.5 py-2 border transition-all outline-none bg-slate-50 text-slate-600" 
                        placeholder="Auto-generated"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">National ID</label>
                      <input 
                        required 
                        type="text" 
                        value={editDraft.national_id || ''} 
                        onChange={e => updateDraft('national_id', e.target.value)} 
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-3.5 py-2 border transition-all outline-none" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Mobile Number</label>
                      <input 
                        required 
                        type="text" 
                        value={editDraft.mobile_number || ''} 
                        onChange={e => updateDraft('mobile_number', e.target.value)} 
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-3.5 py-2 border transition-all outline-none" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">SYS Code</label>
                      <input 
                        required 
                        type="text" 
                        value={editDraft.sys_code || ''} 
                        onChange={e => updateDraft('sys_code', e.target.value)} 
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-3.5 py-2 border transition-all outline-none" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Partner ID</label>
                      <input 
                        required 
                        type="text" 
                        value={editDraft.partner_id || ''} 
                        onChange={e => updateDraft('partner_id', e.target.value)} 
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-3.5 py-2 border transition-all outline-none" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Site</label>
                      <select
                        required
                        value={editDraft.site || ''}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '__other__') {
                            setEditDraft(prev => ({ ...prev, site: '' }));
                            setSiteOther(true);
                          } else {
                            setEditDraft(prev => ({ ...prev, site: val }));
                            setSiteOther(false);
                          }
                        }}
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-3.5 py-2 border transition-all outline-none bg-white"
                      >
                        <option value="" disabled>Select Site</option>
                        {uniqueSites.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        <option value="__other__">+ Other (type new)</option>
                      </select>
                      {siteOther && (
                        <input
                          required
                          type="text"
                          placeholder="Type new Site name"
                          value={editDraft.site || ''}
                          onChange={e => updateDraft('site', e.target.value)}
                          className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-3.5 py-2 border transition-all outline-none mt-1"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider">Additional Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Insurance Comp</label>
                    <input type="text" value={editDraft.insur_comp || ''} onChange={e => updateDraft('insur_comp', e.target.value)} className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Structure Company</label>
                    <input type="text" value={editDraft.structure_company || ''} onChange={e => updateDraft('structure_company', e.target.value)} className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Maxer ID</label>
                    <input type="text" value={editDraft.maxer_id || ''} onChange={e => updateDraft('maxer_id', e.target.value)} className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Hiring Date</label>
                    <DatePicker 
                      date={editDraft.hiring_date} 
                      setDate={d => updateDraft('hiring_date', d)} 
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Gender</label>
                    <select value={editDraft.gender || ''} onChange={e => updateDraft('gender', e.target.value)} className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border bg-white appearance-none outline-none">
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-8 flex justify-end gap-3 sticky bottom-0 bg-white py-4 mt-4 border-t border-slate-100">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsSheetOpen(false)}
                  className="px-6 h-11 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="px-10 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20"
                >
                  {editingId ? 'Save Changes' : 'Create Employee'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
