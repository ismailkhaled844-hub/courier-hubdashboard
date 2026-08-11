import { useEffect, useMemo, useState } from 'react';
import { SalaryRow, ReconRow, normalizeWarehouse, OnDemandRow, FleetOpRow, PendingRow, DamageRow, ExtraRow } from '@/lib/google-sheets';
import { exportToExcel } from '@/lib/export-excel';
import DateRangeFilter from './DateRangeFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, Settings2, RotateCcw, Warehouse } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  salaryData: SalaryRow[];
  reconData: ReconRow[];
  onDemandData?: OnDemandRow[];
  fleetOpData?: FleetOpRow[];
  pendingData?: PendingRow[];
  damageData?: DamageRow[];
  extraData?: ExtraRow[];
}

type FactorKey = 'nmvPct' | 'avgValue' | 'avgOrders' | 'avgWeight' | 'ordersPerHour' | 'weightPerHour';

interface PerformanceWeights {
  nmvPct: number;
  productivity: number;
  deficits: number;
}

const fmtNum = (v: number, maxDigits: number = 1) => {
  const clean = isNaN(v) || !isFinite(v) ? 0 : v;
  return clean.toLocaleString('en-US', { maximumFractionDigits: maxDigits });
};

const safeDiv = (num: number, den: number) => {
  if (!den || isNaN(num) || isNaN(den) || !isFinite(num) || !isFinite(den)) return 0;
  const res = num / den;
  return isNaN(res) || !isFinite(res) ? 0 : res;
};

const NMV_FACTOR: { key: FactorKey; label: string; fmt: (v: number) => string } = {
  key: 'nmvPct', label: 'NMV%', fmt: v => `${fmtNum(v, 2)}%`,
};

const PRODUCTIVITY_FACTORS: { key: FactorKey; label: string; fmt: (v: number) => string }[] = [
  { key: 'avgValue', label: 'Avg Value', fmt: v => fmtNum(v, 1) },
  { key: 'avgOrders', label: 'Avg Orders', fmt: v => fmtNum(v, 2) },
  { key: 'avgWeight', label: 'Avg Weight', fmt: v => fmtNum(v, 1) },
  { key: 'ordersPerHour', label: 'Orders/Hour', fmt: v => fmtNum(v, 2) },
  { key: 'weightPerHour', label: 'Weight/Hour', fmt: v => fmtNum(v, 1) },
];

const FACTORS: { key: FactorKey; label: string; fmt: (v: number) => string }[] = [NMV_FACTOR, ...PRODUCTIVITY_FACTORS];

const DEFAULT_WEIGHTS: PerformanceWeights = {
  nmvPct: 20,
  productivity: 60,
  deficits: 20,
};

const WEIGHTS_KEY = 'warehouse-perf-weights-v3';

function defaultRange() {
  const now = new Date();
  return { from: new Date(now.getFullYear(), now.getMonth() - 1, 21), to: new Date(now.getFullYear(), now.getMonth(), 20) };
}

const INACTIVE_STATUSES = new Set(['NO_SHOW', 'OFF', 'Annual-Leave', 'Sick-Leave', 'Unpaid-Leave']);

export default function WarehousesPerformance({
  salaryData,
  reconData,
  onDemandData = [],
  fleetOpData = [],
  pendingData = [],
  damageData = [],
  extraData = [],
}: Props) {
  const def = defaultRange();
  const [fromDate, setFromDate] = useState<Date | undefined>(def.from);
  const [toDate, setToDate] = useState<Date | undefined>(def.to);
  const [weights, setWeights] = useState<PerformanceWeights>(() => {
    try {
      const raw = localStorage.getItem(WEIGHTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.nmvPct === 'number' && typeof parsed.productivity === 'number' && typeof parsed.deficits === 'number') {
          return parsed;
        }
      }
    } catch { /* ignore */ }
    return DEFAULT_WEIGHTS;
  });
  const [draft, setDraft] = useState<PerformanceWeights>(weights);
  const [open, setOpen] = useState(false);

  useEffect(() => { localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights)); }, [weights]);

  const inRange = (value: string) => {
    if (!value) return false;
    const d = new Date(value);
    if (isNaN(d.getTime())) return false;
    if (fromDate) {
      const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0);
      if (d < from) return false;
    }
    if (toDate) {
      const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59);
      if (d > to) return false;
    }
    return true;
  };

  const rows = useMemo(() => {
    // Aggregate salary data & Fleet Operation data per warehouse
    const agg = new Map<string, {
      orders: number;
      weight: number;
      days: number;
      nmv: number;
      ofd: number;
      runSheets: number;
      ofdOrders: number;
      fleetWeight: number;
      tripTimeHrs: number;
      pendingDeficit: number;
      damageDeficit: number;
      extraDeficit: number;
    }>();
    const get = (wh: string) => {
      if (!agg.has(wh)) {
        agg.set(wh, {
          orders: 0,
          weight: 0,
          days: 0,
          nmv: 0,
          ofd: 0,
          runSheets: 0,
          ofdOrders: 0,
          fleetWeight: 0,
          tripTimeHrs: 0,
          pendingDeficit: 0,
          damageDeficit: 0,
          extraDeficit: 0,
        });
      }
      return agg.get(wh)!;
    };

    const isExcluded = (name: string) => {
      const n = (name || '').trim().toLowerCase();
      return n === 'frozen_gc' || n === 'frozen gc' || n.includes('frozen_gc');
    };

    salaryData.forEach(r => {
      const wh = normalizeWarehouse(r.TEAM_NAME);
      if (!wh || isExcluded(wh) || !inRange(r.DATE)) return;
      const a = get(wh);
      a.orders += r.DELIVERED_ORDERS || 0;
      a.weight += r.DELIVERED_WEIGHT || 0;
      if (!INACTIVE_STATUSES.has(r.STATUS) || r.DELIVERED_ORDERS > 0) a.days += 1;
    });

    const isFleetAvailable = Boolean(fleetOpData && fleetOpData.length > 0);

    if (isFleetAvailable) {
      fleetOpData.forEach(r => {
        const wh = normalizeWarehouse(r.WAREHOUSE);
        if (!wh || isExcluded(wh) || !inRange(r.DELIVERY_DATE)) return;
        const a = get(wh);
        a.runSheets += 1;
        a.nmv += r.NMV || 0;
        a.ofd += r.OFD_VALUE || 0;
        a.ofdOrders += r.OFD_ORDERS || 0;
        a.fleetWeight += r.WEIGHT || 0;
        if (r.TRIP_TIME_HRS > 0) {
          a.tripTimeHrs += r.TRIP_TIME_HRS;
        }
      });
    } else {
      // Fallback: use reconData for NMV and onDemandData for OFD
      reconData.forEach(r => {
        const wh = normalizeWarehouse((r.WAREHOUSE || r._col4 || '').trim());
        const date = r.DELIVERY_DATE || r._col5 || '';
        if (!wh || isExcluded(wh) || !inRange(date)) return;
        const amount = parseFloat((r.TOTAL_DELIVERY_AMOUNT || r._col6 || '').replace(/,/g, '')) || 0;
        get(wh).nmv += amount;
      });

      onDemandData.forEach(r => {
        const wh = normalizeWarehouse(r.WH);
        if (!wh || isExcluded(wh)) return;
        if (fromDate || toDate) {
          const d = new Date(r.Date);
          if (isNaN(d.getTime())) return;
          if (fromDate) {
            const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
            if (d < from) return;
          }
          if (toDate) {
            const to = new Date(toDate); to.setHours(23, 59, 59, 999);
            if (d > to) return;
          }
        }
        get(wh).ofd += r.Ofd || 0;
      });
    }

    // 1. Pending Deficit per warehouse (LIABILITY_ON = 'Courier')
    if (pendingData && pendingData.length > 0) {
      pendingData.forEach(r => {
        if ((r.LIABILITY_ON || '').toLowerCase() !== 'courier') return;
        const wh = normalizeWarehouse(r.WAREHOUSE);
        if (!wh || isExcluded(wh) || !inRange(r.CREATED_AT)) return;
        get(wh).pendingDeficit += r.PENDING_VALUE || 0;
      });
    }

    // 2. Damage Deficit per warehouse (LIABILITY_ON = 'Courier')
    if (damageData && damageData.length > 0) {
      damageData.forEach(r => {
        if ((r.LIABILITY_ON || '').toLowerCase() !== 'courier') return;
        const wh = normalizeWarehouse(r.WAREHOUSE);
        if (!wh || isExcluded(wh) || !inRange(r.CREATED_AT)) return;
        get(wh).damageDeficit += r.DAMAGE_VALUE || 0;
      });
    }

    // 3. Extra Deficit per warehouse (PRODUCT_LIABILITY_TYPE = 'Courier')
    if (extraData && extraData.length > 0) {
      extraData.forEach(r => {
        if ((r.PRODUCT_LIABILITY_TYPE || '').toLowerCase() !== 'courier') return;
        const wh = normalizeWarehouse(r.WAREHOUSE);
        if (!wh || isExcluded(wh) || !inRange(r.EXTRA_CREATION_DATE)) return;
        get(wh).extraDeficit += r.EXTRA_VALUE || 0;
      });
    }

    const base = [...agg.entries()]
      .filter(([wh, a]) => !isExcluded(wh) && (a.days > 0 || a.nmv > 0 || a.ofd > 0 || a.runSheets > 0 || a.pendingDeficit > 0 || a.damageDeficit > 0 || a.extraDeficit > 0))
      .map(([wh, a]) => {
        const hasRunSheets = a.runSheets > 0;
        const totalDeficit = (a.pendingDeficit || 0) + (a.damageDeficit || 0) + (a.extraDeficit || 0);
        const values: Record<FactorKey, number> = {
          // 1. NMV% = (∑ NMV / ∑ OFD_VALUE) * 100
          nmvPct: safeDiv(a.nmv, a.ofd) * 100,
          // 2. Avg Value = ∑ OFD_VALUE / Run Sheets
          avgValue: hasRunSheets ? safeDiv(a.ofd, a.runSheets) : safeDiv(a.nmv, a.orders),
          // 3. Avg Orders = ∑ OFD_ORDERS / Run Sheets
          avgOrders: hasRunSheets ? safeDiv(a.ofdOrders, a.runSheets) : safeDiv(a.orders, a.days),
          // 4. Avg Weight = ∑ WEIGHT / Run Sheets
          avgWeight: hasRunSheets ? safeDiv(a.fleetWeight, a.runSheets) : safeDiv(a.weight, a.days),
          // 5. Orders/Hour = ∑ OFD_ORDERS / ∑ TRIP_TIME_HRS
          ordersPerHour: safeDiv(a.ofdOrders, a.tripTimeHrs),
          // 6. Weight/Hour = ∑ WEIGHT / ∑ TRIP_TIME_HRS
          weightPerHour: safeDiv(a.fleetWeight, a.tripTimeHrs),
        };
        return {
          warehouse: wh,
          days: a.days,
          orders: hasRunSheets ? a.ofdOrders : a.orders,
          weight: hasRunSheets ? a.fleetWeight : a.weight,
          nmv: a.nmv,
          ofd: a.ofd,
          runSheets: a.runSheets,
          tripTimeHrs: a.tripTimeHrs,
          pendingDeficit: a.pendingDeficit,
          damageDeficit: a.damageDeficit,
          extraDeficit: a.extraDeficit,
          totalDeficit,
          values,
        };
      });

    // Normalize each factor against the best performer (0-100)
    const max: Record<FactorKey, number> = {} as Record<FactorKey, number>;
    FACTORS.forEach(f => { max[f.key] = Math.max(0, ...base.map(b => b.values[f.key])); });
    const maxTotalDeficit = Math.max(0, ...base.map(b => b.totalDeficit));
    const totalWeight = (weights.nmvPct || 0) + (weights.productivity || 0) + (weights.deficits || 0) || 1;

    return base
      .map(b => {
        // NMV% normalized score (0-100)
        const nmvNorm = max.nmvPct > 0 ? (b.values.nmvPct / max.nmvPct) * 100 : 0;
        // Productivity average normalized score (0-100) across all 5 productivity factors
        const prodNormSum = PRODUCTIVITY_FACTORS.reduce((sum, f) => {
          const norm = max[f.key] > 0 ? (b.values[f.key] / max[f.key]) * 100 : 0;
          return sum + norm;
        }, 0);
        const prodNormAvg = prodNormSum / PRODUCTIVITY_FACTORS.length;

        // Deficit score: lower deficit is better (100 for 0 deficit, scales down to 0 for highest deficit)
        const deficitScore = maxTotalDeficit > 0 ? Math.max(0, (1 - (b.totalDeficit / maxTotalDeficit)) * 100) : 100;

        // Unified score: NMV% weight + Productivity weight + Deficits weight
        const score = (nmvNorm * ((weights.nmvPct || 0) / totalWeight)) +
                      (prodNormAvg * ((weights.productivity || 0) / totalWeight)) +
                      (deficitScore * ((weights.deficits || 0) / totalWeight));

        return { ...b, score: safeDiv(score, 1) };
      })
      .sort((a, b) => b.score - a.score);
  }, [salaryData, reconData, onDemandData, fleetOpData, pendingData, damageData, extraData, fromDate, toDate, weights]);

  const draftTotal = (draft.nmvPct || 0) + (draft.productivity || 0) + (draft.deficits || 0);

  const handleSave = () => {
    if (Math.round(draftTotal) !== 100) {
      toast.error(`Weights must total 100% — currently ${draftTotal.toFixed(0)}%`);
      return;
    }
    setWeights(draft);
    setOpen(false);
    toast.success('Weights updated');
  };

  const handleExport = () => {
    exportToExcel(
      rows.map((r, i) => ({
        Rank: i + 1,
        Warehouse: r.warehouse,
        'Courier Days': r.days,
        'Run Sheets': r.runSheets,
        'Trip Hours (HRS)': +r.tripTimeHrs.toFixed(2),
        'Total Orders (OFD)': r.orders,
        'Total Weight': +r.weight.toFixed(2),
        NMV: +r.nmv.toFixed(2),
        'OFD Value': +r.ofd.toFixed(2),
        'NMV%': +r.values.nmvPct.toFixed(2),
        'Avg Value': +r.values.avgValue.toFixed(2),
        'Avg Orders': +r.values.avgOrders.toFixed(2),
        'Avg Weight': +r.values.avgWeight.toFixed(2),
        'Orders/Hour': +r.values.ordersPerHour.toFixed(2),
        'Weight/Hour': +r.values.weightPerHour.toFixed(2),
        'Pending Deficit': +r.pendingDeficit.toFixed(2),
        'Damage Deficit': +r.damageDeficit.toFixed(2),
        'Extra Deficit': +r.extraDeficit.toFixed(2),
        'Total Deficit': +r.totalDeficit.toFixed(2),
        'Total Performance %': +r.score.toFixed(2),
      })),
      'Warehouses_Performance'
    );
  };

  const scoreColor = (s: number) =>
    s >= 75 ? 'bg-success/15 text-success' : s >= 50 ? 'bg-info/15 text-info' : s >= 30 ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <DateRangeFilter fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} />
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={o => { setOpen(o); if (o) setDraft(weights); }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 mr-1" /> Weights
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Performance Weights</DialogTitle>
                <DialogDescription>Set the relative weights for NMV%, Productivity, and Deficits. The total must equal 100%.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="flex-1 text-sm font-medium">NMV%</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.nmvPct}
                    onChange={e => setDraft({ ...draft, nmvPct: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="h-9 w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex-1 text-sm font-medium">Productivity</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.productivity}
                    onChange={e => setDraft({ ...draft, productivity: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="h-9 w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex-1 text-sm font-medium">Deficits</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.deficits}
                    onChange={e => setDraft({ ...draft, deficits: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="h-9 w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <div className={`text-sm font-semibold ${Math.round(draftTotal) === 100 ? 'text-success' : 'text-destructive'}`}>
                  Total: {draftTotal.toFixed(0)}% {Math.round(draftTotal) === 100 ? '' : '(must be 100%)'}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setDraft(DEFAULT_WEIGHTS)}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Reset
                </Button>
                <Button size="sm" onClick={handleSave}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-1" /> Export Excel
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Warehouse className="h-4 w-4" />
        <span>{rows.length} warehouses</span>
        <span className="opacity-60">
          | Weights: NMV% {weights.nmvPct}% · Productivity {weights.productivity}% · Deficits {weights.deficits}%
        </span>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[72vh]">
        <table className="text-sm w-max min-w-full">
          <thead className="sticky top-0 z-20">
            <tr>
              <th rowSpan={2} className="table-header-cell sticky left-0 z-30 min-w-[60px] text-center">#</th>
              <th rowSpan={2} className="table-header-cell sticky left-[60px] z-30 min-w-[220px] text-left">Warehouse</th>
              <th rowSpan={2} className="table-header-cell text-center min-w-[120px]">
                {NMV_FACTOR.label}
                <span className="block text-[10px] font-normal opacity-70">{weights.nmvPct}%</span>
              </th>
              <th colSpan={PRODUCTIVITY_FACTORS.length} className="table-header-cell text-center border-b border-primary-foreground/20 border-r-2 border-primary-foreground/40">
                Productivity
                <span className="block text-[10px] font-normal opacity-70">{weights.productivity}%</span>
              </th>
              <th colSpan={3} className="table-header-cell text-center border-b border-primary-foreground/20 border-r-2 border-primary-foreground/40">
                Deficits
                <span className="block text-[10px] font-normal opacity-70">{weights.deficits}%</span>
              </th>
              <th rowSpan={2} className="table-header-cell text-center min-w-[150px]">Total Performance</th>
            </tr>
            <tr>
              {PRODUCTIVITY_FACTORS.map((f, idx) => (
                <th
                  key={f.key}
                  className={`table-header-cell text-center min-w-[120px] ${
                    idx === PRODUCTIVITY_FACTORS.length - 1 ? 'border-r-2 border-primary-foreground/40' : ''
                  }`}
                >
                  {f.label}
                </th>
              ))}
              <th className="table-header-cell text-center min-w-[130px]">Pending Deficit</th>
              <th className="table-header-cell text-center min-w-[130px]">Damage Deficit</th>
              <th className="table-header-cell text-center min-w-[130px] border-r-2 border-primary-foreground/40">Extra Deficit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.warehouse} className="hover:bg-muted/50">
                <td className="table-cell sticky left-0 bg-card z-10 text-center font-medium">{i + 1}</td>
                <td className="table-cell sticky left-[60px] bg-card z-10 font-medium">{r.warehouse}</td>
                <td className="table-cell text-center">{NMV_FACTOR.fmt(r.values[NMV_FACTOR.key])}</td>
                {PRODUCTIVITY_FACTORS.map((f, idx) => (
                  <td
                    key={f.key}
                    className={`table-cell text-center ${
                      idx === PRODUCTIVITY_FACTORS.length - 1 ? 'border-r-2 border-border/80' : ''
                    }`}
                  >
                    {f.fmt(r.values[f.key])}
                  </td>
                ))}
                <td className="table-cell text-right font-medium text-amber-600 dark:text-amber-400">
                  {r.pendingDeficit > 0 ? r.pendingDeficit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </td>
                <td className="table-cell text-right font-medium text-rose-600 dark:text-rose-400">
                  {r.damageDeficit > 0 ? r.damageDeficit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </td>
                <td className="table-cell text-right font-medium text-red-600 dark:text-red-400 border-r-2 border-border/80">
                  {r.extraDeficit > 0 ? r.extraDeficit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </td>
                <td className="table-cell text-center">
                  <span className={`inline-block px-2 py-0.5 rounded font-semibold ${scoreColor(r.score)}`}>
                    {r.score.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={2 + 1 + PRODUCTIVITY_FACTORS.length + 3 + 1} className="table-cell text-center text-muted-foreground py-8">
                  No warehouse data for the selected period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
