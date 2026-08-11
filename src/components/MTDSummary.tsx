import { useMemo, useState } from 'react';
import { SalaryRow, ReconRow, getAllWarehouses } from '@/lib/google-sheets';
import { exportToExcel } from '@/lib/export-excel';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, Info, ArrowUpDown, ArrowUp, ArrowDown, Maximize, Minimize, CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';

interface Props {
  salaryData: SalaryRow[];
  reconData: ReconRow[];
}

interface WHSummary {
  wh: string;
  region: string;
  courierCount: number;
  fixedSalary: number;
  extraShiftValue: number;
  variables: number;
  deductions: number;
  offsetDeduction: number;
  offsetRaise: number;
  totalCalcSalary: number;
  cash: number;
  pending: number;
  damage: number;
  totalDeficit: number;
  netSalary: number;
}

type SortKey = keyof WHSummary;
type SortDir = 'asc' | 'desc';

const TOOLTIPS: Record<string, string> = {
  fixedSalary: 'Fixed salary for couriers per the approved payment policy',
  variables: 'Variables = (Orders × 5) + (Total Weight × 0.05)',
  totalCalcSalary: 'Fixed salary + (Orders × 5) + (Total Weight × 0.05)',
  totalDeficit: 'Total deficit = Cash + Pending + Damage',
  netSalary: 'Net salary = Total salary - Total deficit',
  deductions: 'Deductions applied to courier salaries',
  offsetDeduction: 'Offsetting deduction applied to the salary',
  offsetRaise: 'Offsetting bonus added to the salary',
};

interface DrillDown {
  wh: string;
  column: string;
  rows: SalaryRow[];
}

export default function MTDSummary({ salaryData, reconData }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('wh');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const [drillFullscreen, setDrillFullscreen] = useState(false);
  const [panelSearch, setPanelSearch] = useState('');

  // Deficit date filter
  const now = new Date();
  const defFrom = new Date(now.getFullYear(), now.getMonth() - 1, 18);
  const defTo = new Date(now.getFullYear(), now.getMonth(), 20);
  const [deficitFrom, setDeficitFrom] = useState<Date>(defFrom);
  const [deficitTo, setDeficitTo] = useState<Date>(defTo);

  const filteredRecon = useMemo(() => {
    return reconData.filter(r => {
      const dateStr = r._col5 || '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;
      const from = new Date(deficitFrom); from.setHours(0,0,0,0);
      const to = new Date(deficitTo); to.setHours(23,59,59,999);
      return d >= from && d <= to;
    });
  }, [reconData, deficitFrom, deficitTo]);

  const summaries = useMemo(() => {
    const regionGroups = getAllWarehouses();
    const results: WHSummary[] = [];

    const reconByTeam = new Map<string, { cash: number; pending: number; damage: number }>();
    filteredRecon.forEach(r => {
      const team = (r._col4 || '').trim();
      if (!team) return;
      if (!reconByTeam.has(team)) reconByTeam.set(team, { cash: 0, pending: 0, damage: 0 });
      const t = reconByTeam.get(team)!;
      t.cash += parseFloat(r._col19) || 0;
      t.pending += parseFloat(r._col22) || 0;
      t.damage += parseFloat(r._col25) || 0;
    });

    regionGroups.forEach(({ region, warehouses }) => {
      warehouses.forEach(wh => {
        const rows = salaryData.filter(r => r.TEAM_NAME.toLowerCase().includes(wh.toLowerCase()));
        const uniqueCouriers = new Set(rows.map(r => r.PARTNER_ID));

        let cash = 0, pending = 0, damage = 0;
        reconByTeam.forEach((val, key) => {
          if (key.toLowerCase().includes(wh.toLowerCase()) || wh.toLowerCase().includes(key.toLowerCase())) {
            cash += val.cash; pending += val.pending; damage += val.damage;
          }
        });

        const totalCalcSalary = rows.reduce((s, r) => s + r.CALC_SALARY, 0);
        const totalDeficit = cash + pending + damage;

        results.push({
          wh, region,
          courierCount: uniqueCouriers.size,
          fixedSalary: rows.reduce((s, r) => s + r.FIXED_SALARY, 0),
          extraShiftValue: rows.reduce((s, r) => s + r.EXTRA_SHIFT_VALUE, 0),
          variables: rows.reduce((s, r) => s + r.VARIABLES, 0),
          deductions: rows.reduce((s, r) => s + r.DEDUCTIONS, 0),
          offsetDeduction: rows.reduce((s, r) => s + r.OFFSET_DEDUCTION, 0),
          offsetRaise: rows.reduce((s, r) => s + r.OFFSET_RAISE, 0),
          totalCalcSalary,
          cash, pending, damage, totalDeficit,
          netSalary: totalCalcSalary - totalDeficit,
        });
      });
    });

    return results;
  }, [salaryData, filteredRecon]);

  const regionGroups = getAllWarehouses();

  const sumRows = (rows: WHSummary[]): Omit<WHSummary, 'wh' | 'region'> => ({
    courierCount: rows.reduce((s, r) => s + r.courierCount, 0),
    fixedSalary: rows.reduce((s, r) => s + r.fixedSalary, 0),
    extraShiftValue: rows.reduce((s, r) => s + r.extraShiftValue, 0),
    variables: rows.reduce((s, r) => s + r.variables, 0),
    deductions: rows.reduce((s, r) => s + r.deductions, 0),
    offsetDeduction: rows.reduce((s, r) => s + r.offsetDeduction, 0),
    offsetRaise: rows.reduce((s, r) => s + r.offsetRaise, 0),
    totalCalcSalary: rows.reduce((s, r) => s + r.totalCalcSalary, 0),
    cash: rows.reduce((s, r) => s + r.cash, 0),
    pending: rows.reduce((s, r) => s + r.pending, 0),
    damage: rows.reduce((s, r) => s + r.damage, 0),
    totalDeficit: rows.reduce((s, r) => s + r.totalDeficit, 0),
    netSalary: rows.reduce((s, r) => s + r.netSalary, 0),
  });

  const fmt = (n: number) => n ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '-';

  const handleExport = () => {
    const rows: Record<string, unknown>[] = [];
    summaries.forEach(s => {
      rows.push({
        Region: s.region, Warehouse: s.wh, Couriers: s.courierCount,
        'Fixed Salary': +s.fixedSalary.toFixed(2), 'Extra Shift': +s.extraShiftValue.toFixed(2),
        Variables: +s.variables.toFixed(2), Deductions: +s.deductions.toFixed(2),
        'Offset Ded.': +s.offsetDeduction.toFixed(2), 'Offset Raise': +s.offsetRaise.toFixed(2),
        'Total Salary': +s.totalCalcSalary.toFixed(2),
        Cash: +s.cash.toFixed(2), Pending: +s.pending.toFixed(2), Damage: +s.damage.toFixed(2),
        'Total Deficit': +s.totalDeficit.toFixed(2), 'Net Salary': +s.netSalary.toFixed(2),
      });
    });
    exportToExcel(rows, 'MTD_Summary');
  };

  const handleDrillDown = (wh: string, column: string) => {
    const rows = salaryData.filter(r => r.TEAM_NAME.toLowerCase().includes(wh.toLowerCase()));
    setDrillDown({ wh, column, rows });
    setPanelSearch('');
  };

  const getDrillColumns = (col: string): string[] => {
    const base = ['PARTNER_NAME', 'PARTNER_ID', 'DATE', 'STATUS'];
    switch (col) {
      case 'fixedSalary': return [...base, 'FIXED_SALARY'];
      case 'variables': return [...base, 'DELIVERED_ORDERS', 'DELIVERED_WEIGHT', 'VARIABLES'];
      case 'totalCalcSalary': return [...base, 'FIXED_SALARY', 'DELIVERED_ORDERS', 'DELIVERED_WEIGHT', 'CALC_SALARY'];
      case 'deductions': return [...base, 'DEDUCTIONS'];
      default: return [...base, 'CALC_SALARY'];
    }
  };

  const colLabel = (c: string): string => {
    const labels: Record<string, string> = {
      PARTNER_NAME: 'Name', PARTNER_ID: 'ID', DATE: 'Date', STATUS: 'Status',
      FIXED_SALARY: 'Fixed', DELIVERED_ORDERS: 'Orders', DELIVERED_WEIGHT: 'Weight',
      VARIABLES: 'Variables', CALC_SALARY: 'Total Salary', DEDUCTIONS: 'Deductions',
    };
    return labels[c] || c;
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const drillRows = useMemo(() => {
    if (!drillDown) return [];
    let rows = drillDown.rows;
    if (panelSearch) rows = rows.filter(r => r.PARTNER_NAME.toLowerCase().includes(panelSearch.toLowerCase()) || r.PARTNER_ID.includes(panelSearch));
    return rows.sort((a, b) => a.PARTNER_NAME.localeCompare(b.PARTNER_NAME) || new Date(a.DATE).getTime() - new Date(b.DATE).getTime());
  }, [drillDown, panelSearch]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const HeaderCell = ({ col, label, tooltip, align = 'right' }: { col: SortKey; label: string; tooltip?: string; align?: string }) => (
    <th className={`table-header-cell cursor-pointer hover:bg-primary/80 transition-colors text-${align}`} onClick={() => toggleSort(col)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
              {tooltip && <Info className="h-3 w-3 opacity-60" />}
              <span>{label}</span>
              <SortIcon col={col} />
            </div>
          </TooltipTrigger>
          {tooltip && (
            <TooltipContent side="top" className="max-w-[280px] text-right font-['Tajawal']" dir="rtl">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </th>
  );

  const clickable = (wh: string, col: string, val: number, className = '') => (
    <td className={`table-cell text-right cursor-pointer hover:bg-primary/5 transition-colors ${className}`} onClick={() => handleDrillDown(wh, col)}>
      {fmt(val)}
    </td>
  );

  const renderRow = (label: string, data: Omit<WHSummary, 'wh' | 'region'> & { wh?: string }, isTotal = false) => (
    <tr key={label} className={isTotal ? 'table-total-row' : 'hover:bg-muted/50'}>
      <td className={`table-cell ${isTotal ? 'font-bold' : ''}`}>{label}</td>
      <td className="table-cell text-center">{data.courierCount || '-'}</td>
      {data.wh ? clickable(data.wh, 'fixedSalary', data.fixedSalary) : <td className="table-cell text-right font-bold">{fmt(data.fixedSalary)}</td>}
      <td className="table-cell text-right">{fmt(data.extraShiftValue)}</td>
      {data.wh ? clickable(data.wh, 'variables', data.variables) : <td className="table-cell text-right font-bold">{fmt(data.variables)}</td>}
      {data.wh ? clickable(data.wh, 'deductions', data.deductions) : <td className="table-cell text-right font-bold">{fmt(data.deductions)}</td>}
      <td className="table-cell text-right">{fmt(data.offsetDeduction)}</td>
      <td className="table-cell text-right">{fmt(data.offsetRaise)}</td>
      {data.wh ? clickable(data.wh, 'totalCalcSalary', data.totalCalcSalary, 'font-semibold text-primary') : <td className="table-cell text-right font-bold text-primary">{fmt(data.totalCalcSalary)}</td>}
      <td className="table-cell text-right">{fmt(data.cash)}</td>
      <td className="table-cell text-right">{fmt(data.pending)}</td>
      <td className="table-cell text-right">{fmt(data.damage)}</td>
      <td className="table-cell text-right font-semibold">{fmt(data.totalDeficit)}</td>
      <td className={`table-cell text-right font-semibold ${data.netSalary < 0 ? 'text-destructive' : 'text-success'}`}>{fmt(data.netSalary)}</td>
    </tr>
  );

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export Excel
          </Button>
        </div>
        <div className="border rounded-lg overflow-auto max-h-[78vh]">
          <table className="text-sm w-full min-w-[1300px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th rowSpan={2} className="table-header-cell text-left cursor-pointer" onClick={() => toggleSort('wh')}>Warehouse</th>
                <th rowSpan={2} className="table-header-cell text-center cursor-pointer" onClick={() => toggleSort('courierCount')}>Couriers</th>
                <th rowSpan={2} className="table-header-cell text-right cursor-pointer" onClick={() => toggleSort('fixedSalary')} title={TOOLTIPS.fixedSalary}>Fixed Salary</th>
                <th rowSpan={2} className="table-header-cell text-right cursor-pointer" onClick={() => toggleSort('extraShiftValue')}>Extra Shift</th>
                <th rowSpan={2} className="table-header-cell text-right cursor-pointer" onClick={() => toggleSort('variables')} title={TOOLTIPS.variables}>Variables</th>
                <th rowSpan={2} className="table-header-cell text-right cursor-pointer" onClick={() => toggleSort('deductions')} title={TOOLTIPS.deductions}>Deductions</th>
                <th rowSpan={2} className="table-header-cell text-right cursor-pointer" onClick={() => toggleSort('offsetDeduction')} title={TOOLTIPS.offsetDeduction}>Offset Ded.</th>
                <th rowSpan={2} className="table-header-cell text-right cursor-pointer" onClick={() => toggleSort('offsetRaise')} title={TOOLTIPS.offsetRaise}>Offset Raise</th>
                <th rowSpan={2} className="table-header-cell text-right cursor-pointer" onClick={() => toggleSort('totalCalcSalary')} title={TOOLTIPS.totalCalcSalary}>Total Salary</th>
                <th colSpan={4} className="table-header-cell bg-warning/80 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>Deficit</span>
                    <div className="flex items-center gap-1 text-[9px] font-normal">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-background/50 hover:bg-background/80 text-foreground/70 transition-colors">
                            <CalendarDays className="h-2.5 w-2.5" />
                            {format(deficitFrom, 'dd/MM')} - {format(deficitTo, 'dd/MM')}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="center">
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Deficit Date Range</p>
                            <div className="flex gap-2 items-center">
                              <div>
                                <label className="text-[10px] text-muted-foreground">From</label>
                                <Input type="date" className="h-7 text-xs w-32" value={format(deficitFrom, 'yyyy-MM-dd')} onChange={e => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) setDeficitFrom(d); }} />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground">To</label>
                                <Input type="date" className="h-7 text-xs w-32" value={format(deficitTo, 'yyyy-MM-dd')} onChange={e => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) setDeficitTo(d); }} />
                              </div>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </th>
                <th rowSpan={2} className="table-header-cell text-right cursor-pointer" onClick={() => toggleSort('netSalary')} title={TOOLTIPS.netSalary}>Net Salary</th>
              </tr>
              <tr>
                <th className="table-header-cell text-right cursor-pointer" onClick={() => toggleSort('cash')}>Cash</th>
                <th className="table-header-cell text-right cursor-pointer" onClick={() => toggleSort('pending')}>Pending</th>
                <th className="table-header-cell text-right cursor-pointer" onClick={() => toggleSort('damage')}>Damage</th>
                <th className="table-header-cell text-right cursor-pointer" onClick={() => toggleSort('totalDeficit')} title={TOOLTIPS.totalDeficit}>Total Deficit</th>
              </tr>
            </thead>
            {regionGroups.map(({ region, warehouses }) => {
              const regionSummaries = summaries.filter(s => s.region === region);
              const regionTotal = sumRows(regionSummaries);
              return (
                <tbody key={region}>
                  <tr>
                    <td colSpan={14} className="bg-primary/5 px-3 py-2 text-xs font-bold text-primary uppercase tracking-wider">{region}</td>
                  </tr>
                  {warehouses.map(wh => {
                    const s = summaries.find(x => x.wh === wh);
                    if (!s) return null;
                    return renderRow(wh, { ...s, wh: s.wh });
                  })}
                  {renderRow(`Total ${region}`, regionTotal, true)}
                </tbody>
              );
            })}
            <tbody>
              {renderRow('Total Egypt', sumRows(summaries), true)}
            </tbody>
          </table>
        </div>

        <Sheet open={!!drillDown} onOpenChange={open => { if (!open) { setDrillDown(null); setDrillFullscreen(false); } }}>
          <SheetContent className={drillFullscreen ? "w-full sm:w-full sm:max-w-full overflow-auto" : "w-[600px] sm:w-[800px] sm:max-w-[800px] overflow-auto"}>
            <SheetHeader>
              <div className="flex items-center justify-between">
                <SheetTitle>{drillDown?.wh} - {drillDown?.column === 'totalCalcSalary' ? 'Total Salary' : drillDown?.column || ''}</SheetTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDrillFullscreen(f => !f)}>
                  {drillFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </div>
              {drillDown && TOOLTIPS[drillDown.column] && (
                <p className="text-xs text-muted-foreground font-['Tajawal'] text-right" dir="rtl">{TOOLTIPS[drillDown.column]}</p>
              )}
            </SheetHeader>
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Search..." value={panelSearch} onChange={e => setPanelSearch(e.target.value)} className="h-9" />
                <Button variant="outline" size="icon" onClick={() => {
                  if (!drillDown) return;
                  const cols = getDrillColumns(drillDown.column);
                  exportToExcel(drillRows.map(r => {
                    const obj: Record<string, unknown> = {};
                    cols.forEach(c => {
                      obj[colLabel(c)] = c === 'DATE' ? fmtDate(r.DATE) : c === 'DELIVERED_WEIGHT' ? r.DELIVERED_WEIGHT : (r as any)[c];
                    });
                    return obj;
                  }), `${drillDown.wh}_${drillDown.column}`);
                }} title="Export"><Download className="h-4 w-4" /></Button>
              </div>
              <div className="text-xs text-muted-foreground">{drillRows.length} records</div>
              <div className="max-h-[calc(100vh-220px)] overflow-auto">
                <table className="text-sm w-full">
                  <thead className="sticky top-0 bg-card">
                    <tr>
                      {drillDown && getDrillColumns(drillDown.column).map(col => (
                        <th key={col} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">{colLabel(col)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drillRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/50 border-b border-border">
                        {drillDown && getDrillColumns(drillDown.column).map(col => (
                          <td key={col} className={`px-3 py-1.5 text-xs ${col === 'PARTNER_NAME' ? 'whitespace-normal min-w-[180px]' : 'whitespace-nowrap'}`}>
                            {col === 'DATE' ? fmtDate(row.DATE) :
                             col === 'PARTNER_NAME' ? row.PARTNER_NAME :
                             col === 'PARTNER_ID' ? row.PARTNER_ID :
                             col === 'STATUS' ? row.STATUS :
                             col === 'FIXED_SALARY' ? fmt(row.FIXED_SALARY) :
                             col === 'DELIVERED_ORDERS' ? row.DELIVERED_ORDERS :
                             col === 'DELIVERED_WEIGHT' ? row.DELIVERED_WEIGHT.toLocaleString('en-US', { maximumFractionDigits: 2 }) :
                             col === 'VARIABLES' ? fmt(row.VARIABLES) :
                             col === 'CALC_SALARY' ? fmt(row.CALC_SALARY) :
                             col === 'DEDUCTIONS' ? fmt(row.DEDUCTIONS) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
