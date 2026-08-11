import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Download, Calendar as CalendarIcon, LayoutGrid, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToExcel } from '@/lib/export-excel';
import { supabase } from '@/integrations/supabase/client';
import { normalizeWarehouse } from '@/lib/google-sheets';


const SHEET_ID = '1Fo6VHE4k1G-KjWwoWNEJgKKUXt5WPoObmOZ5Bf-zIgc';
const SHEET_NAME = 'Data 2026';

const EXCLUDED_TYPES = new Set(['on demand', 'churned']);
const ON_DEMAND_TYPES = new Set(['on demand']);

// Region mapping for Summary view
const REGION_MAP: { region: string; match: string[] }[] = [
  { region: 'Greater Cairo', match: ['barageel', 'mostorod', 'mansourya', 'saryaqus'] },
  { region: 'Delta', match: ['mahala', 'mansoura', 'tanta', 'sharq'] },
  { region: 'UE', match: ['menya', 'samalot', 'assiut', 'sohag', 'bani'] },
  { region: 'Alex', match: ['khorshed', 'alex'] },
];

function regionOf(warehouse: string): string {
  const w = warehouse.toLowerCase();
  for (const r of REGION_MAP) if (r.match.some(m => w.includes(m))) return r.region;
  return 'Other';
}

// Lightweight CSV parser
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (inQ) {
      if (c === '"' && csv[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && csv[i + 1] === '\n') i++;
        row.push(cur); rows.push(row); row = []; cur = '';
      } else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

interface CapacityRow {
  warehouse: string;
  supplier: string;
  carType: string;
  trucks: Record<string, Set<string>>;
}

type Mode = 'normal' | 'ondemand';

async function fetchCapacity(mode: Mode): Promise<{ rows: CapacityRow[]; lastUpdate: string }> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
  const res = await fetch(url);
  const text = await res.text();
  const rows = parseCsv(text);
  if (rows.length < 3) return { rows: [], lastUpdate: '' };
  const lastUpdate = (rows[0][0] || '').replace('Last Update:', '').trim();

  const map = new Map<string, CapacityRow>();
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 15) continue;
    const date = (r[0] || '').trim();
    const warehouse = normalizeWarehouse((r[1] || '').trim());

    const typeCol = (r[9] || '').trim().toLowerCase();
    const truckNo = (r[10] || '').trim();
    const supplier = (r[13] || '').trim();
    const carType = (r[14] || '').trim();
    if (!date) continue;
    if (!warehouse && !supplier && !carType) continue;
    if (mode === 'ondemand') {
      if (!ON_DEMAND_TYPES.has(typeCol)) continue;
    } else {
      if (typeCol && EXCLUDED_TYPES.has(typeCol)) continue;
    }
    const key = `${warehouse}|||${supplier}|||${carType}`;
    let cur = map.get(key);
    if (!cur) { cur = { warehouse, supplier, carType, trucks: {} }; map.set(key, cur); }
    if (!cur.trucks[date]) cur.trucks[date] = new Set();
    cur.trucks[date].add(truckNo || `__row_${i}`);
  }
  return { rows: [...map.values()], lastUpdate };
}

async function fetchEdits(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('capacity_edits').select('cell_key,value');
  if (error || !data) return {};
  const out: Record<string, number> = {};
  for (const r of data as { cell_key: string; value: number | string }[]) {
    out[r.cell_key] = Number(r.value);
  }
  return out;
}

function parseSheetDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function monthKey(d: Date) { return `${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`; }
function dayKey(d: Date) {
  const dd = String(d.getDate()).padStart(2,'0');
  return `${dd}-${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;
}

export default function CapacityTab() {
  const [mode, setMode] = useState<Mode>('normal');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['capacity-data', mode],
    queryFn: () => fetchCapacity(mode),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const editsKey = mode === 'ondemand' ? 'capacity-edits-ondemand' : 'capacity-edits-normal';

  const { data: editsData } = useQuery({
    queryKey: ['capacity-edits', mode],
    queryFn: fetchEdits,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
  const edits = editsData || {};

  const [granularity, setGranularity] = useState<'monthly' | 'daily'>('daily');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => monthKey(new Date()));
  const [showSummary, setShowSummary] = useState(false);

  const updateEdit = async (key: string, value: string) => {
    const trimmed = value.trim();
    // optimistic
    qc.setQueryData(['capacity-edits', mode], (prev: Record<string, number> | undefined) => {
      const next = { ...(prev || {}) };
      if (trimmed === '') delete next[key];
      else {
        const n = Number(trimmed.replace(/,/g, ''));
        if (!isNaN(n)) next[key] = n;
      }
      return next;
    });
    const prefixedKey = `${mode}::${key}`;
    if (trimmed === '') {
      await supabase.from('capacity_edits').delete().eq('cell_key', prefixedKey);
    } else {
      const n = Number(trimmed.replace(/,/g, ''));
      if (isNaN(n)) return;
      await supabase.from('capacity_edits').upsert({ cell_key: prefixedKey, value: n, updated_at: new Date().toISOString() });
    }
  };

  // The edits keys are stored prefixed with mode::; strip when reading
  const cellKey = (r: { warehouse: string; supplier: string; carType: string }, c: string) =>
    `${r.warehouse}|||${r.supplier}|||${r.carType}|||${c}`;
  const prefixed = (k: string) => `${mode}::${k}`;

  const { displayRows, dateCols, monthOptions } = useMemo(() => {
    if (!data) return { displayRows: [], dateCols: [] as string[], monthOptions: [] as string[] };
    const colSet = new Map<string, Date>();
    const monthSet = new Map<string, Date>();

    const aggregated = data.rows.map(r => {
      // Monthly: unique trucks per month (a truck working many days counts once)
      const buckets: Record<string, Set<string>> = {};
      for (const [dateStr, truckSet] of Object.entries(r.trucks)) {
        const d = parseSheetDate(dateStr);
        if (!d) continue;
        const mk = monthKey(d);
        if (!monthSet.has(mk)) monthSet.set(mk, new Date(d.getFullYear(), d.getMonth(), 1));
        if (granularity === 'daily' && mk !== selectedMonth) continue;
        const k = granularity === 'monthly' ? mk : dayKey(d);
        if (!buckets[k]) buckets[k] = new Set();
        truckSet.forEach(t => buckets[k].add(t));
        if (!colSet.has(k)) {
          colSet.set(k, granularity === 'monthly' ? new Date(d.getFullYear(), d.getMonth(), 1) : d);
        }
      }
      const newVals: Record<string, number> = {};
      for (const [k, s] of Object.entries(buckets)) newVals[k] = s.size;
      return { warehouse: r.warehouse, supplier: r.supplier, carType: r.carType, values: newVals };
    });


    const dateCols = [...colSet.entries()].sort((a,b)=>a[1].getTime()-b[1].getTime()).map(([k])=>k);
    const monthOptions = [...monthSet.entries()].sort((a,b)=>a[1].getTime()-b[1].getTime()).map(([k])=>k);

    const wf = warehouseFilter.toLowerCase();
    const sf = supplierFilter.toLowerCase();
    const filtered = aggregated.filter(r =>
      (!wf || r.warehouse.toLowerCase().includes(wf)) &&
      (!sf || r.supplier.toLowerCase().includes(sf))
    );
    filtered.sort((a, b) =>
      a.warehouse.localeCompare(b.warehouse) ||
      a.supplier.localeCompare(b.supplier) ||
      a.carType.localeCompare(b.carType)
    );
    return { displayRows: filtered, dateCols, monthOptions };
  }, [data, granularity, warehouseFilter, supplierFilter, selectedMonth]);

  useEffect(() => {
    if (monthOptions.length && !monthOptions.includes(selectedMonth)) {
      const current = monthKey(new Date());
      setSelectedMonth(monthOptions.includes(current) ? current : monthOptions[monthOptions.length - 1]);
    }
  }, [monthOptions, selectedMonth]);

  const getDisplayValue = (r: { warehouse: string; supplier: string; carType: string; values: Record<string, number> }, c: string) => {
    const k = prefixed(cellKey(r, c));
    if (k in edits) return edits[k];
    return r.values[c] ?? '';
  };

  const handleExport = () => {
    const out = displayRows.map(r => {
      const o: Record<string, unknown> = {
        Warehouse: r.warehouse,
        Supplier: r.supplier,
        'Truck Type': r.carType,
      };
      dateCols.forEach(c => { o[c] = getDisplayValue(r, c); });
      return o;
    });
    exportToExcel(out, `Capacity_${mode}_${granularity}_${new Date().toISOString().slice(0,10)}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const W1 = 140, W2 = 180, W3 = 110;

  return (
    <div className="bg-card border rounded-lg shadow-sm">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b">
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          <button
            onClick={() => setMode('normal')}
            className={`px-3 py-1 text-xs rounded font-semibold transition-all ${mode === 'normal' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Main
          </button>
          <button
            onClick={() => setMode('ondemand')}
            className={`px-3 py-1 text-xs rounded font-semibold transition-all ${mode === 'ondemand' ? 'bg-amber-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Zap className="h-3 w-3 inline mr-1" /> Double Run
          </button>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          <button
            onClick={() => setGranularity('daily')}
            className={`px-3 py-1 text-xs rounded font-semibold transition-all ${granularity === 'daily' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <CalendarIcon className="h-3 w-3 inline mr-1" /> Daily
          </button>
          <button
            onClick={() => setGranularity('monthly')}
            className={`px-3 py-1 text-xs rounded font-semibold transition-all ${granularity === 'monthly' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <CalendarIcon className="h-3 w-3 inline mr-1" /> Monthly
          </button>
        </div>
        {granularity === 'daily' && (
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="h-8 px-2 text-xs border rounded-md bg-background"
          >
            {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <input
          placeholder="Filter Warehouse..."
          value={warehouseFilter}
          onChange={e => setWarehouseFilter(e.target.value)}
          className="h-8 px-2 text-xs border rounded-md w-40"
        />
        <input
          placeholder="Filter Supplier..."
          value={supplierFilter}
          onChange={e => setSupplierFilter(e.target.value)}
          className="h-8 px-2 text-xs border rounded-md w-40"
        />
        <div className="ml-auto flex items-center gap-2">
          {data?.lastUpdate && (
            <span className="text-[10px] text-muted-foreground">Updated: {data.lastUpdate}</span>
          )}
          <span className="text-xs text-muted-foreground">{displayRows.length} rows</span>
          <Button size="sm" variant="default" onClick={() => setShowSummary(true)} className="h-8">
            <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Summary
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} className="h-8">
            <Download className="h-3.5 w-3.5 mr-1" /> Export Excel
          </Button>
        </div>
      </div>
      <div className="overflow-auto max-h-[calc(100vh-220px)]">
        <table className="text-xs w-max border-collapse">
          <thead className="sticky top-0 bg-muted z-10">
            <tr>
              <th className="px-3 py-2 text-left font-semibold border-b border-r sticky left-0 bg-muted z-20" style={{minWidth: W1, width: W1}}>Warehouse</th>
              <th className="px-3 py-2 text-left font-semibold border-b border-r sticky bg-muted z-20" style={{left: W1, minWidth: W2, width: W2}}>Supplier</th>
              <th className="px-3 py-2 text-left font-semibold border-b border-r sticky bg-muted z-20" style={{left: W1+W2, minWidth: W3, width: W3, borderRightWidth: 2}}>Truck Type</th>
              {dateCols.map(c => (
                <th key={c} className="px-3 py-2 text-center font-semibold border-b border-r whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r, i) => {
              const prev = displayRows[i - 1];
              const newWh = !prev || prev.warehouse !== r.warehouse;
              const sep = newWh && i > 0 ? 'border-t-2 border-t-primary/40' : '';
              return (
                <tr key={i} className={`hover:bg-muted/40 border-b ${sep}`}>
                  <td className="px-3 py-1.5 border-r sticky bg-card font-medium" style={{left: 0, minWidth: W1, width: W1}}>{r.warehouse}</td>
                  <td className="px-3 py-1.5 border-r sticky bg-card" style={{left: W1, minWidth: W2, width: W2}}>{r.supplier}</td>
                  <td className="px-3 py-1.5 border-r sticky bg-card" style={{left: W1+W2, minWidth: W3, width: W3, borderRightWidth: 2}}>{r.carType}</td>
                  {dateCols.map(c => {
                    const k = prefixed(cellKey(r, c));
                    const edited = k in edits;
                    const val = getDisplayValue(r, c);
                    return (
                      <td key={c} className={`border-r text-center tabular-nums p-0 ${edited ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}>
                        <EditableCell value={val} onCommit={(v) => updateEdit(cellKey(r, c), v)} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {displayRows.length === 0 && (
              <tr><td colSpan={3 + dateCols.length} className="text-center py-12 text-muted-foreground">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showSummary && data && (
        <SummaryModal
          rows={data.rows}
          edits={edits}
          mode={mode}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}

function EditableCell({ value, onCommit }: { value: number | string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState<string>(String(value ?? ''));
  const initial = useRef(String(value ?? ''));
  useEffect(() => {
    setLocal(String(value ?? ''));
    initial.current = String(value ?? '');
  }, [value]);
  return (
    <input
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== initial.current) onCommit(local); }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setLocal(initial.current); (e.target as HTMLInputElement).blur(); }
      }}
      className="w-full h-full bg-transparent text-center px-2 py-1.5 outline-none focus:bg-primary/10 focus:ring-1 focus:ring-primary"
    />
  );
}

/* ------------------------- Summary Modal ------------------------- */

function SummaryModal({
  rows, edits, mode, onClose,
}: {
  rows: CapacityRow[];
  edits: Record<string, number>;
  mode: Mode;
  onClose: () => void;
}) {
  const allDays = useMemo(() => {
    const set = new Map<string, Date>();
    rows.forEach(r => Object.keys(r.trucks).forEach(ds => {
      const d = parseSheetDate(ds);
      if (d) set.set(dayKey(d), d);
    }));
    return [...set.entries()].sort((a,b)=>b[1].getTime()-a[1].getTime()).map(([k])=>k);
  }, [rows]);

  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const today = dayKey(new Date());
    return allDays.includes(today) ? today : (allDays[0] || today);
  });

  const { regions, truckTypes, matrix, govTotals, grandTotal } = useMemo(() => {
    const dayMatches = (ds: string) => {
      const d = parseSheetDate(ds);
      return d ? dayKey(d) === selectedDay : false;
    };

    const typeSet = new Set<string>();
    const whAgg = new Map<string, Map<string, number>>();
    const whRegion = new Map<string, string>();

    rows.forEach(r => {
      if (!r.warehouse || !r.carType) return;
      let cnt = 0;
      for (const [ds, set] of Object.entries(r.trucks)) {
        if (dayMatches(ds)) cnt += set.size;
      }
      const edKey = `${mode}::${r.warehouse}|||${r.supplier}|||${r.carType}|||${selectedDay}`;
      if (edKey in edits) cnt = edits[edKey];
      if (cnt <= 0) return;
      typeSet.add(r.carType);
      whRegion.set(r.warehouse, regionOf(r.warehouse));
      if (!whAgg.has(r.warehouse)) whAgg.set(r.warehouse, new Map());
      const m = whAgg.get(r.warehouse)!;
      m.set(r.carType, (m.get(r.carType) || 0) + cnt);
    });

    const truckTypes = [...typeSet].sort();
    const REGION_ORDER = ['Greater Cairo', 'Delta', 'UE', 'Alex', 'Other'];
    const regionMap = new Map<string, string[]>();
    [...whAgg.keys()].sort().forEach(wh => {
      const reg = whRegion.get(wh) || 'Other';
      if (!regionMap.has(reg)) regionMap.set(reg, []);
      regionMap.get(reg)!.push(wh);
    });
    const regions = REGION_ORDER.filter(r => regionMap.has(r)).map(r => ({ name: r, warehouses: regionMap.get(r)! }));

    const matrix: Record<string, Record<string, number>> = {};
    whAgg.forEach((m, wh) => {
      matrix[wh] = {};
      truckTypes.forEach(t => { matrix[wh][t] = m.get(t) || 0; });
      matrix[wh]['__total'] = truckTypes.reduce((s, t) => s + (m.get(t) || 0), 0);
    });

    const govTotals: Record<string, number> = {};
    let grandTotal = 0;
    truckTypes.forEach(t => {
      govTotals[t] = Object.values(matrix).reduce((s, row) => s + (row[t] || 0), 0);
      grandTotal += govTotals[t];
    });
    govTotals['__total'] = grandTotal;

    return { regions, truckTypes, matrix, govTotals, grandTotal };
  }, [rows, selectedDay, edits, mode]);

  const handleExport = () => {
    const out: Record<string, unknown>[] = [];
    regions.forEach(reg => {
      reg.warehouses.forEach(wh => {
        const row: Record<string, unknown> = { Region: reg.name, WH: wh };
        truckTypes.forEach(t => { row[t] = matrix[wh][t] || ''; });
        row['TOTAL Fleet'] = matrix[wh]['__total'];
        out.push(row);
      });
    });
    const totalRow: Record<string, unknown> = { Region: '', WH: 'Grand Total' };
    truckTypes.forEach(t => { totalRow[t] = govTotals[t]; });
    totalRow['TOTAL Fleet'] = grandTotal;
    out.push(totalRow);
    exportToExcel(out, `Capacity_Summary_${mode}_${selectedDay}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-3 border-b">
          <LayoutGrid className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Capacity Summary {mode === 'ondemand' && <span className="text-amber-600">(Double Run)</span>}</h2>
          <select
            value={selectedDay}
            onChange={e => setSelectedDay(e.target.value)}
            className="h-8 px-2 text-xs border rounded-md bg-background ml-2"
          >
            {allDays.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExport} className="h-8">
              <Download className="h-3.5 w-3.5 mr-1" /> Export
            </Button>
            <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-md"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="overflow-auto p-4">
          <table className="text-xs border-collapse mx-auto">
            <thead>
              <tr className="bg-muted">
                <th className="px-3 py-2 border font-bold">Region</th>
                <th className="px-3 py-2 border font-bold">WH</th>
                {truckTypes.map(t => (
                  <th key={t} className="px-3 py-2 border font-bold whitespace-nowrap">{t}</th>
                ))}
                <th className="px-3 py-2 border font-bold bg-primary/10">TOTAL Fleet</th>
              </tr>
            </thead>
            <tbody>
              {regions.map(reg => (
                reg.warehouses.map((wh, idx) => (
                  <tr key={wh} className="hover:bg-muted/30">
                    {idx === 0 && (
                      <td className="px-3 py-1.5 border font-bold bg-muted/50 text-center align-middle" rowSpan={reg.warehouses.length}>
                        {reg.name}
                      </td>
                    )}
                    <td className="px-3 py-1.5 border">{wh}</td>
                    {truckTypes.map(t => {
                      const v = matrix[wh][t];
                      return <td key={t} className={`px-3 py-1.5 border text-center tabular-nums ${v ? 'text-rose-600 font-medium' : 'text-muted-foreground'}`}>{v || ''}</td>;
                    })}
                    <td className="px-3 py-1.5 border text-center font-bold tabular-nums bg-primary/5">{matrix[wh]['__total'] || ''}</td>
                  </tr>
                ))
              ))}
              <tr className="bg-muted font-bold">
                <td className="px-3 py-2 border" colSpan={2}>Grand Total</td>
                {truckTypes.map(t => (
                  <td key={t} className="px-3 py-2 border text-center tabular-nums">{govTotals[t] || ''}</td>
                ))}
                <td className="px-3 py-2 border text-center tabular-nums bg-primary/10">{grandTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
