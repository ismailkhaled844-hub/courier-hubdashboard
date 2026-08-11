import { useMemo, useState } from 'react';
import { SalaryRow, ReconRow } from '@/lib/google-sheets';
import { exportToExcel } from '@/lib/export-excel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, ArrowUpDown, ArrowUp, ArrowDown, Info, Maximize, Minimize, CalendarDays } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

interface Props {
  salaryData: SalaryRow[];
  reconData: ReconRow[];
  allData: SalaryRow[];
}

interface CourierFinancial {
  partnerId: string;
  partnerName: string;
  warehouse: string;
  fixedSalary: number;
  variables: number;
  offsetDeduction: number;
  offsetRaise: number;
  totalSalary: number;
  cash: number;
  pending: number;
  damage: number;
  totalDeficit: number;
  netSalary: number;
  orders: number;
  weight: number;
  hiringDate: string | null;
  leavingDate: string | null;
}

type SortKey = keyof CourierFinancial;
type SortDir = 'asc' | 'desc';

interface DrillDown {
  courier: CourierFinancial;
  column: string;
}

const COLUMN_TOOLTIPS: Record<string, string> = {
  fixedSalary: 'Fixed salary for the courier per the approved payment policy',
  variables: 'Variables = (Orders × 5) + (Total Weight × 0.05)',
  offsetDeduction: 'Offsetting deduction applied to the courier salary',
  offsetRaise: 'Offsetting bonus added to the courier salary',
  totalSalary: 'Fixed salary + (Orders × 5) + (Total Weight × 0.05)',
  cash: 'Total cash collected from the courier',
  pending: 'Pending amounts not yet settled',
  damage: 'Value of damages recorded against the courier',
  totalDeficit: 'Total deficit = Cash + Pending + Damage',
  netSalary: 'Net salary = Total salary - Total deficit',
};

export default function CourierFinancialDetails({ salaryData, reconData, allData }: Props) {
  const [search, setSearch] = useState('');
  const [whFilter, setWhFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('warehouse');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const [drillFullscreen, setDrillFullscreen] = useState(false);

  // Deficit date filter - default 19th of previous month to 18th of current month
  const now = new Date();
  const defFrom = new Date(now.getFullYear(), now.getMonth() - 1, 19);
  const defTo = new Date(now.getFullYear(), now.getMonth(), 18);

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

  const warehouses = useMemo(() => [...new Set(salaryData.map(r => r.TEAM_NAME))].filter(Boolean).sort(), [salaryData]);

  const dates = useMemo(() => {
    const d = [...new Set(salaryData.map(r => r.DATE))];
    d.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return d;
  }, [salaryData]);

  const firstDate = dates[0] || null;
  const lastDate = dates[dates.length - 1] || null;

  const partnerDates = useMemo(() => {
    const m = new Map<string, Set<string>>();
    salaryData.forEach(r => {
      if (!m.has(r.PARTNER_ID)) m.set(r.PARTNER_ID, new Set());
      m.get(r.PARTNER_ID)!.add(r.DATE);
    });
    return m;
  }, [salaryData]);

  // Recon data per partner
  const reconByPartner = useMemo(() => {
    const map = new Map<string, { cash: number; pending: number; damage: number }>();
    filteredRecon.forEach(r => {
      const id = (r._col2 || '').trim();
      if (!id) return;
      if (!map.has(id)) map.set(id, { cash: 0, pending: 0, damage: 0 });
      const t = map.get(id)!;
      t.cash += parseFloat(r._col19) || 0;
      t.pending += parseFloat(r._col22) || 0;
      t.damage += parseFloat(r._col25) || 0;
    });
    return map;
  }, [filteredRecon]);

  const couriers = useMemo((): CourierFinancial[] => {
    const map = new Map<string, { rows: SalaryRow[] }>();
    salaryData.forEach(r => {
      if (!map.has(r.PARTNER_ID)) map.set(r.PARTNER_ID, { rows: [] });
      map.get(r.PARTNER_ID)!.rows.push(r);
    });

    return [...map.entries()].map(([id, { rows }]) => {
      const first = rows[0];
      const fixedSalary = rows.reduce((s, r) => s + r.FIXED_SALARY, 0);
      const variables = rows.reduce((s, r) => s + r.VARIABLES, 0);
      const offsetDeduction = rows.reduce((s, r) => s + r.OFFSET_DEDUCTION, 0);
      const offsetRaise = rows.reduce((s, r) => s + r.OFFSET_RAISE, 0);
      const totalSalary = rows.reduce((s, r) => s + r.CALC_SALARY, 0);
      const orders = rows.reduce((s, r) => s + r.DELIVERED_ORDERS, 0);
      const weight = rows.reduce((s, r) => s + r.DELIVERED_WEIGHT, 0);

      const recon = reconByPartner.get(id) || { cash: 0, pending: 0, damage: 0 };
      const totalDeficit = recon.cash + recon.pending + recon.damage;

      // Hiring/leaving logic
      let hiringDate: string | null = null;
      let leavingDate: string | null = null;
      const pDates = partnerDates.get(id);
      if (pDates && firstDate && dates.length >= 2) {
        if (!pDates.has(firstDate)) {
          for (const d of dates) {
            if (pDates.has(d)) { hiringDate = d; break; }
          }
        }
        if (lastDate && !pDates.has(lastDate)) {
          for (let i = dates.length - 1; i >= 0; i--) {
            if (pDates.has(dates[i])) { leavingDate = dates[i]; break; }
          }
        }
      }

      return {
        partnerId: id,
        partnerName: first.PARTNER_NAME,
        warehouse: first.TEAM_NAME,
        fixedSalary,
        variables,
        offsetDeduction,
        offsetRaise,
        totalSalary,
        cash: recon.cash,
        pending: recon.pending,
        damage: recon.damage,
        totalDeficit,
        netSalary: totalSalary - totalDeficit,
        orders,
        weight,
        hiringDate,
        leavingDate,
      };
    });
  }, [salaryData, reconByPartner, partnerDates, dates, firstDate, lastDate]);

  const filtered = useMemo(() => {
    let list = couriers;
    if (whFilter !== 'all') list = list.filter(c => c.warehouse === whFilter);
    if (search) list = list.filter(c => c.partnerName.toLowerCase().includes(search.toLowerCase()) || c.partnerId.includes(search));
    list = [...list].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      return sortDir === 'asc' ? String(aVal || '').localeCompare(String(bVal || '')) : String(bVal || '').localeCompare(String(aVal || ''));
    });
    return list;
  }, [couriers, whFilter, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const fmt = (n: number) => n ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '-';
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const handleExport = () => {
    exportToExcel(
      filtered.map(c => ({
        'Partner ID': c.partnerId,
        'Partner Name': c.partnerName,
        'Warehouse': c.warehouse,
        'Hiring Date': c.hiringDate ? fmtDate(c.hiringDate) : '-',
        'Leaving Date': c.leavingDate ? fmtDate(c.leavingDate) : '-',
        'Fixed Salary': +c.fixedSalary.toFixed(2),
        'Variables': +c.variables.toFixed(2),
        'Offset Ded.': +c.offsetDeduction.toFixed(2),
        'Offset Raise': +c.offsetRaise.toFixed(2),
        'Total Salary': +c.totalSalary.toFixed(2),
        'Cash': +c.cash.toFixed(2),
        'Pending': +c.pending.toFixed(2),
        'Damage': +c.damage.toFixed(2),
        'Total Deficit': +c.totalDeficit.toFixed(2),
        'Net Salary': +c.netSalary.toFixed(2),
      })),
      'Courier_Financial_Details'
    );
  };

  const HeaderCell = ({ col, label, tooltip, align = 'right' }: { col: SortKey; label: string; tooltip?: string; align?: string }) => (
    <th
      className={`table-header-cell cursor-pointer hover:bg-primary/80 transition-colors text-${align}`}
      onClick={() => toggleSort(col)}
    >
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

  // Drill-down details
  const drillDownRows = useMemo(() => {
    if (!drillDown) return [];
    const rows = salaryData.filter(r => r.PARTNER_ID === drillDown.courier.partnerId);
    return rows.sort((a, b) => new Date(a.DATE).getTime() - new Date(b.DATE).getTime());
  }, [drillDown, salaryData]);

  const getDrillColumns = (col: string) => {
    const base = ['DATE', 'STATUS'];
    switch (col) {
      case 'fixedSalary': return [...base, 'FIXED_SALARY'];
      case 'variables': return [...base, 'DELIVERED_ORDERS', 'DELIVERED_WEIGHT', 'VARIABLES'];
      case 'totalSalary': return [...base, 'FIXED_SALARY', 'DELIVERED_ORDERS', 'DELIVERED_WEIGHT', 'CALC_SALARY'];
      case 'cash': case 'pending': case 'damage': case 'totalDeficit': return ['Recon details not available at daily level'];
      default: return [...base, 'FIXED_SALARY', 'VARIABLES', 'CALC_SALARY'];
    }
  };

  const colLabel = (c: string) => {
    const labels: Record<string, string> = {
      DATE: 'Date', STATUS: 'Status', FIXED_SALARY: 'Fixed', DELIVERED_ORDERS: 'Orders',
      DELIVERED_WEIGHT: 'Weight', VARIABLES: 'Variables', CALC_SALARY: 'Total Salary',
    };
    return labels[c] || c;
  };

  const totals = useMemo(() => {
    return {
      fixedSalary: filtered.reduce((s, c) => s + c.fixedSalary, 0),
      variables: filtered.reduce((s, c) => s + c.variables, 0),
      offsetDeduction: filtered.reduce((s, c) => s + c.offsetDeduction, 0),
      offsetRaise: filtered.reduce((s, c) => s + c.offsetRaise, 0),
      totalSalary: filtered.reduce((s, c) => s + c.totalSalary, 0),
      cash: filtered.reduce((s, c) => s + c.cash, 0),
      pending: filtered.reduce((s, c) => s + c.pending, 0),
      damage: filtered.reduce((s, c) => s + c.damage, 0),
      totalDeficit: filtered.reduce((s, c) => s + c.totalDeficit, 0),
      netSalary: filtered.reduce((s, c) => s + c.netSalary, 0),
    };
  }, [filtered]);

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex gap-3 flex-wrap items-center">
          <Input placeholder="Search by name or ID..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs h-9" />
          <Select value={whFilter} onValueChange={setWhFilter}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="All Warehouses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} couriers</span>
          <Button variant="outline" size="sm" onClick={handleExport} className="ml-auto">
            <Download className="h-4 w-4 mr-1" /> Export Excel
          </Button>
        </div>

        <div className="border rounded-lg overflow-auto max-h-[78vh]">
          <table className="text-sm w-max min-w-full">
            <thead className="sticky top-0 z-20">
              <tr>
                <HeaderCell col="partnerId" label="ID" align="left" />
                <HeaderCell col="partnerName" label="Name" align="left" />
                <HeaderCell col="warehouse" label="Warehouse" align="left" />
                <HeaderCell col="hiringDate" label="Hiring" align="center" />
                <HeaderCell col="leavingDate" label="Leaving" align="center" />
                <HeaderCell col="fixedSalary" label="Fixed" tooltip={COLUMN_TOOLTIPS.fixedSalary} />
                <HeaderCell col="variables" label="Variable" tooltip={COLUMN_TOOLTIPS.variables} />
                <HeaderCell col="offsetDeduction" label="Offset Ded" tooltip={COLUMN_TOOLTIPS.offsetDeduction} />
                <HeaderCell col="offsetRaise" label="Offset Raise" tooltip={COLUMN_TOOLTIPS.offsetRaise} />
                <HeaderCell col="totalSalary" label="Total Salary" tooltip={COLUMN_TOOLTIPS.totalSalary} />
                <th className="table-header-cell bg-warning/80 text-center" colSpan={4}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span>Recon (Deficit)</span>
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
                <HeaderCell col="netSalary" label="Net Salary" tooltip={COLUMN_TOOLTIPS.netSalary} />
              </tr>
              <tr>
                {/* spacers for first 10 columns */}
                <th colSpan={10} className="table-subheader-cell p-0 h-0 border-0" />
                <th className="table-subheader-cell text-right">Cash</th>
                <th className="table-subheader-cell text-right">Pending</th>
                <th className="table-subheader-cell text-right">Damage</th>
                <th className="table-subheader-cell text-right">Total</th>
                <th className="table-subheader-cell p-0 h-0 border-0" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.partnerId} className="hover:bg-muted/50">
                  <td className="table-cell font-medium">{c.partnerId}</td>
                  <td className="table-cell">{c.partnerName}</td>
                  <td className="table-cell">{c.warehouse}</td>
                  <td className="table-cell text-center">
                    {c.hiringDate ? <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/15 text-success">{fmtDate(c.hiringDate)}</span> : '-'}
                  </td>
                  <td className="table-cell text-center">
                    {c.leavingDate ? <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/15 text-destructive">{fmtDate(c.leavingDate)}</span> : '-'}
                  </td>
                  <td className="table-cell text-right cursor-pointer hover:bg-primary/5" onClick={() => setDrillDown({ courier: c, column: 'fixedSalary' })}>{fmt(c.fixedSalary)}</td>
                  <td className="table-cell text-right cursor-pointer hover:bg-primary/5" onClick={() => setDrillDown({ courier: c, column: 'variables' })}>{fmt(c.variables)}</td>
                  <td className="table-cell text-right">{fmt(c.offsetDeduction)}</td>
                  <td className="table-cell text-right">{fmt(c.offsetRaise)}</td>
                  <td className="table-cell text-right font-semibold text-primary cursor-pointer hover:bg-primary/5" onClick={() => setDrillDown({ courier: c, column: 'totalSalary' })}>{fmt(c.totalSalary)}</td>
                  <td className="table-cell text-right">{fmt(c.cash)}</td>
                  <td className="table-cell text-right">{fmt(c.pending)}</td>
                  <td className="table-cell text-right">{fmt(c.damage)}</td>
                  <td className="table-cell text-right font-semibold text-destructive">{fmt(c.totalDeficit)}</td>
                  <td className={`table-cell text-right font-bold ${c.netSalary < 0 ? 'text-destructive' : 'text-success'}`}>{fmt(c.netSalary)}</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="table-total-row sticky bottom-0 z-10">
                <td className="table-cell font-bold" colSpan={5}>Total ({filtered.length} couriers)</td>
                <td className="table-cell text-right font-bold">{fmt(totals.fixedSalary)}</td>
                <td className="table-cell text-right font-bold">{fmt(totals.variables)}</td>
                <td className="table-cell text-right font-bold">{fmt(totals.offsetDeduction)}</td>
                <td className="table-cell text-right font-bold">{fmt(totals.offsetRaise)}</td>
                <td className="table-cell text-right font-bold text-primary">{fmt(totals.totalSalary)}</td>
                <td className="table-cell text-right font-bold">{fmt(totals.cash)}</td>
                <td className="table-cell text-right font-bold">{fmt(totals.pending)}</td>
                <td className="table-cell text-right font-bold">{fmt(totals.damage)}</td>
                <td className="table-cell text-right font-bold text-destructive">{fmt(totals.totalDeficit)}</td>
                <td className={`table-cell text-right font-bold ${totals.netSalary < 0 ? 'text-destructive' : 'text-success'}`}>{fmt(totals.netSalary)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Drill Down Panel */}
        <Sheet open={!!drillDown} onOpenChange={open => { if (!open) { setDrillDown(null); setDrillFullscreen(false); } }}>
          <SheetContent className={drillFullscreen ? "w-full sm:w-full sm:max-w-full overflow-auto" : "w-[600px] sm:w-[800px] sm:max-w-[800px] overflow-auto"}>
            <SheetHeader>
              <div className="flex items-center justify-between">
                <SheetTitle>{drillDown?.courier.partnerName} - {drillDown?.column === 'totalSalary' ? 'Total Salary' : drillDown?.column === 'fixedSalary' ? 'Fixed Salary' : drillDown?.column === 'variables' ? 'Variables' : drillDown?.column}</SheetTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDrillFullscreen(f => !f)}>
                  {drillFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{drillDown?.courier.warehouse} • {drillDown?.courier.partnerId}</p>
              {drillDown && COLUMN_TOOLTIPS[drillDown.column] && (
                <p className="text-xs text-muted-foreground font-['Tajawal'] text-right" dir="rtl">{COLUMN_TOOLTIPS[drillDown.column]}</p>
              )}
            </SheetHeader>
            <div className="mt-4 overflow-x-auto">
              {drillDown && getDrillColumns(drillDown.column)[0]?.startsWith('Recon') ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Recon details are only available at the aggregate level</p>
              ) : (
                <table className="text-sm w-full">
                  <thead className="sticky top-0 bg-card">
                    <tr>
                      {drillDown && getDrillColumns(drillDown.column).map(col => (
                        <th key={col} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">{colLabel(col)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drillDownRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/50 border-b border-border">
                        {drillDown && getDrillColumns(drillDown.column).map(col => (
                          <td key={col} className="px-3 py-2 text-xs whitespace-nowrap">
                            {col === 'DATE' ? fmtDate(row.DATE) :
                             col === 'STATUS' ? row.STATUS :
                             col === 'FIXED_SALARY' ? fmt(row.FIXED_SALARY) :
                             col === 'DELIVERED_ORDERS' ? row.DELIVERED_ORDERS :
                             col === 'DELIVERED_WEIGHT' ? row.DELIVERED_WEIGHT.toLocaleString('en-US', { maximumFractionDigits: 2 }) :
                             col === 'VARIABLES' ? fmt(row.VARIABLES) :
                             col === 'CALC_SALARY' ? fmt(row.CALC_SALARY) :
                             '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
