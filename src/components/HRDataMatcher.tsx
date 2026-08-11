import { useMemo, useState, useRef, useEffect } from 'react';
import { SalaryRow } from '@/lib/google-sheets';
import { exportToExcel } from '@/lib/export-excel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Download, Upload, AlertTriangle, CheckCircle, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Users } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  salaryData: SalaryRow[];
}

interface HRRow {
  partnerId: string;
  partnerName: string;
  hrFixed: number;
  hrVariable: number;
  hrTotalNet: number;
}

interface ComparisonRow {
  partnerId: string;
  partnerName: string;
  warehouse: string;
  dashFixed: number;
  hrFixed: number;
  diffFixed: number;
  dashVariable: number;
  hrVariable: number;
  diffVariable: number;
  dashNet: number;
  hrNet: number;
  diffNet: number;
  hasDiscrepancy: boolean;
  source: 'both' | 'dashboard_only' | 'hr_only';
}

type SortKey = keyof ComparisonRow;
type SortDir = 'asc' | 'desc';

const STORAGE_KEY = 'hr_matcher_file';

export default function HRDataMatcher({ salaryData }: Props) {
  const [hrData, setHrData] = useState<HRRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [whFilter, setWhFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey | ''>('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const fileRef = useRef<HTMLInputElement>(null);

  // Load persisted file on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { name, data } = JSON.parse(stored);
        setFileName(name);
        setHrData(data);
      }
    } catch {}
  }, []);

  const persistData = (name: string, data: HRRow[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, data }));
    } catch {}
  };

  const handleClearFile = () => {
    setHrData([]);
    setFileName('');
    localStorage.removeItem(STORAGE_KEY);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const parsed: HRRow[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as (string | number | undefined)[];
        const partnerId = String(row[0] || '').trim().replace(/,/g, '');
        if (!partnerId) continue;
        const num = (v: unknown) => parseFloat(String(v || '0').replace(/,/g, '')) || 0;
        const netFixed = num(row[23]);
        const absence = num(row[31]);
        const hrFixed = netFixed - absence;
        const hrVariable = num(row[24]);
        const hrTotalNet = num(row[39]);
        const partnerName = String(row[1] || '').trim();
        parsed.push({ partnerId, partnerName, hrFixed, hrVariable, hrTotalNet });
      }
      setHrData(parsed);
      persistData(file.name, parsed);
    };
    reader.readAsArrayBuffer(file);
  };

  const normalizeId = (id: string) => id.replace(/,/g, '').trim();

  const dashData = useMemo(() => {
    const map = new Map<string, { name: string; wh: string; fixed: number; variable: number; totalSalary: number }>();
    salaryData.forEach(r => {
      const nid = normalizeId(r.PARTNER_ID);
      if (!map.has(nid)) {
        map.set(nid, { name: r.PARTNER_NAME, wh: r.TEAM_NAME, fixed: 0, variable: 0, totalSalary: 0 });
      }
      const t = map.get(nid)!;
      t.fixed += r.FIXED_SALARY;
      t.variable += r.VARIABLES;
      t.totalSalary += r.CALC_SALARY;
    });
    return map;
  }, [salaryData]);

  const warehouses = useMemo(() => [...new Set(salaryData.map(r => r.TEAM_NAME))].filter(Boolean).sort(), [salaryData]);

  const comparison = useMemo((): ComparisonRow[] => {
    if (!hrData.length) return [];
    const hrMap = new Map<string, HRRow>();
    hrData.forEach(h => hrMap.set(h.partnerId, h));

    const allIds = new Set([...dashData.keys(), ...hrMap.keys()]);
    const rows: ComparisonRow[] = [];

    allIds.forEach(id => {
      const dash = dashData.get(id);
      const hr = hrMap.get(id);
      if (!dash && !hr) return;

      const round2 = (n: number) => Math.round(n * 100) / 100;
      const dashFixed = round2(dash?.fixed || 0);
      const hrFixed = round2(hr?.hrFixed || 0);
      const dashVariable = round2(dash?.variable || 0);
      const hrVariable = round2(hr?.hrVariable || 0);
      const dashNet = round2(dash?.totalSalary || 0);
      const hrNet = round2(hr?.hrTotalNet || 0);

      const diffFixed = round2(dashFixed - hrFixed);
      const diffVariable = round2(dashVariable - hrVariable);
      const diffNet = round2(dashNet - hrNet);

      const source = dash && hr ? 'both' : dash ? 'dashboard_only' : 'hr_only';

      rows.push({
        partnerId: id,
        partnerName: dash?.name || hr?.partnerName || `(Unknown) ${id}`,
        warehouse: dash?.wh || '-',
        dashFixed, hrFixed, diffFixed,
        dashVariable, hrVariable, diffVariable,
        dashNet, hrNet, diffNet,
        hasDiscrepancy: diffFixed !== 0 || diffVariable !== 0 || diffNet !== 0,
        source,
      });
    });

    return rows;
  }, [hrData, dashData]);

  const filtered = useMemo(() => {
    let list = comparison;
    if (showDiscrepanciesOnly) list = list.filter(r => r.hasDiscrepancy);
    if (whFilter !== 'all') list = list.filter(r => r.warehouse === whFilter);
    if (sourceFilter !== 'all') list = list.filter(r => r.source === sourceFilter);
    if (search) list = list.filter(r => r.partnerName.toLowerCase().includes(search.toLowerCase()) || r.partnerId.includes(search));
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
        return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
    }
    return list;
  }, [comparison, showDiscrepanciesOnly, whFilter, sourceFilter, search, sortKey, sortDir]);

  const stats = useMemo(() => {
    const total = comparison.length;
    const matched = comparison.filter(r => !r.hasDiscrepancy).length;
    const mismatched = total - matched;
    const dashOnly = comparison.filter(r => r.source === 'dashboard_only').length;
    const hrOnly = comparison.filter(r => r.source === 'hr_only').length;
    return { total, matched, mismatched, dashOnly, hrOnly };
  }, [comparison]);

  const handleExport = () => {
    exportToExcel(
      filtered.map(r => ({
        'Partner ID': r.partnerId,
        'Name': r.partnerName,
        'Warehouse': r.warehouse,
        'Source': r.source,
        'Dash Fixed': r.dashFixed,
        'HR Fixed': r.hrFixed,
        'Diff Fixed': r.diffFixed,
        'Dash Variable': r.dashVariable,
        'HR Variable': r.hrVariable,
        'Diff Variable': r.diffVariable,
        'Dash Net': r.dashNet,
        'HR Net': r.hrNet,
        'Diff Net': r.diffNet,
      })),
      'HR_Audit_Report'
    );
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const diffCell = (val: number) => {
    if (val === 0) return <td className="table-cell text-right text-success font-medium">0.00</td>;
    return <td className="table-cell text-right font-semibold bg-destructive/10 text-destructive">{fmt(val)}</td>;
  };

  const sortableHeader = (label: string, key: SortKey, extra = '') => (
    <th className={`table-subheader-cell cursor-pointer select-none hover:bg-muted/50 ${extra}`} onClick={() => toggleSort(key)}>
      <span className="flex items-center gap-1 justify-center">{label} <SortIcon col={key} /></span>
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Upload area */}
      <div className="flex gap-3 flex-wrap items-center">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> Upload HR Export
        </Button>
        {fileName && (
          <>
            <span className="text-sm text-muted-foreground">{fileName}</span>
            <Button variant="destructive" size="sm" onClick={handleClearFile}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear File
            </Button>
          </>
        )}
      </div>

      {hrData.length > 0 && (
        <>
          {/* Stats */}
          <div className="flex gap-4 flex-wrap items-center">
            <div className="flex items-center gap-1 text-sm">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="font-medium">{stats.matched} Matched</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-medium">{stats.mismatched} Discrepancies</span>
            </div>
            <span className="text-sm text-muted-foreground">Total: {stats.total}</span>
            {stats.dashOnly > 0 && (
              <div className="flex items-center gap-1 text-sm text-amber-600">
                <Users className="h-4 w-4" />
                <span className="font-medium">{stats.dashOnly} Dashboard Only</span>
              </div>
            )}
            {stats.hrOnly > 0 && (
              <div className="flex items-center gap-1 text-sm text-blue-600">
                <Users className="h-4 w-4" />
                <span className="font-medium">{stats.hrOnly} HR Only</span>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center">
            <Input placeholder="Search by name or ID..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs h-9" />
            <Select value={whFilter} onValueChange={setWhFilter}>
              <SelectTrigger className="w-48 h-9"><SelectValue placeholder="All Warehouses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {warehouses.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-48 h-9"><SelectValue placeholder="All Sources" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="both">In Both</SelectItem>
                <SelectItem value="dashboard_only">Dashboard Only</SelectItem>
                <SelectItem value="hr_only">HR Only</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={showDiscrepanciesOnly} onCheckedChange={setShowDiscrepanciesOnly} />
              <span className="text-sm">Discrepancies Only</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="ml-auto">
              <Download className="h-4 w-4 mr-1" /> Export Audit Report
            </Button>
          </div>

          {/* Comparison Table */}
          <div className="border rounded-lg overflow-auto max-h-[70vh]">
            <table className="text-sm w-max min-w-full">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th rowSpan={2} className="table-header-cell cursor-pointer" onClick={() => toggleSort('partnerId')}>
                    <span className="flex items-center gap-1">ID <SortIcon col="partnerId" /></span>
                  </th>
                  <th rowSpan={2} className="table-header-cell cursor-pointer" onClick={() => toggleSort('partnerName')}>
                    <span className="flex items-center gap-1">Name <SortIcon col="partnerName" /></span>
                  </th>
                  <th rowSpan={2} className="table-header-cell cursor-pointer" onClick={() => toggleSort('warehouse')}>
                    <span className="flex items-center gap-1">Warehouse <SortIcon col="warehouse" /></span>
                  </th>
                  <th rowSpan={2} className="table-header-cell cursor-pointer" onClick={() => toggleSort('source')}>
                    <span className="flex items-center gap-1">Source <SortIcon col="source" /></span>
                  </th>
                  <th colSpan={3} className="table-header-cell text-center border-l">Fixed Salary</th>
                  <th colSpan={3} className="table-header-cell text-center border-l">Variable</th>
                  <th colSpan={3} className="table-header-cell text-center border-l">Net Total</th>
                </tr>
                <tr>
                  {sortableHeader('Dashboard', 'dashFixed', 'border-l')}
                  {sortableHeader('HR', 'hrFixed')}
                  {sortableHeader('Diff', 'diffFixed')}
                  {sortableHeader('Dashboard', 'dashVariable', 'border-l')}
                  {sortableHeader('HR', 'hrVariable')}
                  {sortableHeader('Diff', 'diffVariable')}
                  {sortableHeader('Dashboard', 'dashNet', 'border-l')}
                  {sortableHeader('HR', 'hrNet')}
                  {sortableHeader('Diff', 'diffNet')}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.partnerId} className={`hover:bg-muted/50 ${r.source === 'dashboard_only' ? 'bg-amber-50/50' : r.source === 'hr_only' ? 'bg-blue-50/50' : ''}`}>
                    <td className="table-cell font-medium">{r.partnerId}</td>
                    <td className="table-cell">{r.partnerName}</td>
                    <td className="table-cell">{r.warehouse}</td>
                    <td className="table-cell text-xs">
                      {r.source === 'both' && <span className="text-success">✓ Both</span>}
                      {r.source === 'dashboard_only' && <span className="text-amber-600">Dashboard Only</span>}
                      {r.source === 'hr_only' && <span className="text-blue-600">HR Only</span>}
                    </td>
                    <td className="table-cell text-right border-l">{fmt(r.dashFixed)}</td>
                    <td className="table-cell text-right">{fmt(r.hrFixed)}</td>
                    {diffCell(r.diffFixed)}
                    <td className="table-cell text-right border-l">{fmt(r.dashVariable)}</td>
                    <td className="table-cell text-right">{fmt(r.hrVariable)}</td>
                    {diffCell(r.diffVariable)}
                    <td className="table-cell text-right border-l">{fmt(r.dashNet)}</td>
                    <td className="table-cell text-right">{fmt(r.hrNet)}</td>
                    {diffCell(r.diffNet)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!hrData.length && (
        <div className="text-center py-20 text-muted-foreground">
          <Upload className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Upload HR Export Sheet</p>
          <p className="text-sm mt-1">Upload an Excel file to compare HR data with dashboard calculations</p>
        </div>
      )}
    </div>
  );
}
