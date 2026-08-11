import { useEffect, useMemo, useState } from 'react';
import { SalaryRow, ReconRow, normalizeWarehouse, OnDemandRow, FleetOpRow, PendingRow, DamageRow, ExtraRow, TicketRow, parseFlexibleDate } from '@/lib/google-sheets';
import { exportToExcel } from '@/lib/export-excel';
import DateRangeFilter from './DateRangeFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Settings2, RotateCcw, Warehouse, HelpCircle, BookOpen, Calculator, CheckCircle2, TrendingUp, AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  salaryData: SalaryRow[];
  reconData: ReconRow[];
  onDemandData?: OnDemandRow[];
  fleetOpData?: FleetOpRow[];
  pendingData?: PendingRow[];
  damageData?: DamageRow[];
  extraData?: ExtraRow[];
  ticketsData?: TicketRow[];
}

type FactorKey = 'nmvPct' | 'avgValue' | 'avgOrders' | 'avgWeight' | 'ordersPerHour' | 'weightPerHour';

interface PerformanceWeights {
  nmvPct: number;
  productivity: number;
  deficits: number;
  tickets: number;
}

interface PerformanceTargets {
  nmvPct: number;
  avgValue: number;
  avgOrders: number;
  avgWeight: number;
  ordersPerHour: number;
  weightPerHour: number;
  maxDeficit: number;
  maxTickets: number;
}

interface CellDetailModalData {
  title: string;
  warehouse: string;
  actualLabel: string;
  actualValue: string;
  formula: string;
  benchmarkLabel: string;
  benchmarkValue: string;
  scoreText: string;
  scorePct: number;
  weightLabel: string;
  weightPct: number;
  pointsEarned: number;
  explanation: string;
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
  tickets: 0,
};

const DEFAULT_TARGETS: PerformanceTargets = {
  nmvPct: 0,
  avgValue: 0,
  avgOrders: 0,
  avgWeight: 0,
  ordersPerHour: 0,
  weightPerHour: 0,
  maxDeficit: 0,
  maxTickets: 0,
};

const WEIGHTS_KEY = 'warehouse-perf-weights-v4';
const TARGETS_KEY = 'warehouse-perf-targets-v2';

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
  ticketsData = [],
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
          return { tickets: 0, ...parsed };
        }
      }
    } catch { /* ignore */ }
    return DEFAULT_WEIGHTS;
  });

  const [targets, setTargets] = useState<PerformanceTargets>(() => {
    try {
      const raw = localStorage.getItem(TARGETS_KEY);
      if (raw) {
        return { ...DEFAULT_TARGETS, ...JSON.parse(raw) };
      }
    } catch { /* ignore */ }
    return DEFAULT_TARGETS;
  });

  const [draftWeights, setDraftWeights] = useState<PerformanceWeights>(weights);
  const [draftTargets, setDraftTargets] = useState<PerformanceTargets>(targets);
  const [open, setOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [cellDetail, setCellDetail] = useState<CellDetailModalData | null>(null);

  useEffect(() => { localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights)); }, [weights]);
  useEffect(() => { localStorage.setItem(TARGETS_KEY, JSON.stringify(targets)); }, [targets]);

  const inRange = (value: string) => {
    if (!value) return false;
    const d = parseFlexibleDate(value);
    if (!d || isNaN(d.getTime())) return false;
    if (fromDate) {
      const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0);
      if (d < from) return false;
    }
    if (toDate) {
      const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);
      if (d > to) return false;
    }
    return true;
  };

  const rows = useMemo(() => {
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
      tickets: number;
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
          tickets: 0,
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
          const d = parseFlexibleDate(r.Date);
          if (!d || isNaN(d.getTime())) return;
          if (fromDate) {
            const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0);
            if (d < from) return;
          }
          if (toDate) {
            const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);
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

    // 4. Tickets per warehouse (Ecommerce Max Support Tickets based on DAT)
    if (ticketsData && ticketsData.length > 0) {
      ticketsData.forEach(r => {
        const wh = normalizeWarehouse(r.WAREHOUSE);
        if (!wh || isExcluded(wh) || !inRange(r.DAT || r.CREATED_AT)) return;
        get(wh).tickets += 1;
      });
    }

    const base = [...agg.entries()]
      .filter(([wh, a]) => !isExcluded(wh) && (a.days > 0 || a.nmv > 0 || a.ofd > 0 || a.runSheets > 0 || a.pendingDeficit > 0 || a.damageDeficit > 0 || a.extraDeficit > 0 || a.tickets > 0))
      .map(([wh, a]) => {
        const hasRunSheets = a.runSheets > 0;
        const totalDeficit = (a.pendingDeficit || 0) + (a.damageDeficit || 0) + (a.extraDeficit || 0);
        const values: Record<FactorKey, number> = {
          nmvPct: safeDiv(a.nmv, a.ofd) * 100,
          avgValue: hasRunSheets ? safeDiv(a.ofd, a.runSheets) : safeDiv(a.nmv, a.orders),
          avgOrders: hasRunSheets ? safeDiv(a.ofdOrders, a.runSheets) : safeDiv(a.orders, a.days),
          avgWeight: hasRunSheets ? safeDiv(a.fleetWeight, a.runSheets) : safeDiv(a.weight, a.days),
          ordersPerHour: safeDiv(a.ofdOrders, a.tripTimeHrs),
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
          tickets: a.tickets,
          values,
        };
      });

    // Dynamic Max values across all warehouses
    const dynamicMax: Record<FactorKey, { value: number; topWh: string }> = {} as any;
    FACTORS.forEach(f => {
      let topVal = 0;
      let topWh = '';
      base.forEach(b => {
        if (b.values[f.key] > topVal) {
          topVal = b.values[f.key];
          topWh = b.warehouse;
        }
      });
      dynamicMax[f.key] = { value: topVal, topWh };
    });

    const maxPending = Math.max(0, ...base.map(b => b.pendingDeficit));
    const maxDamage = Math.max(0, ...base.map(b => b.damageDeficit));
    const maxExtra = Math.max(0, ...base.map(b => b.extraDeficit));
    const dynamicMaxTotalDeficit = Math.max(0, ...base.map(b => b.totalDeficit));
    const maxTickets = Math.max(0, ...base.map(b => b.tickets));

    // Active Benchmarks (Manual target if set > 0, otherwise dynamic max)
    const benchmark: Record<FactorKey, { value: number; isManual: boolean; label: string }> = {
      nmvPct: {
        value: targets.nmvPct > 0 ? targets.nmvPct : dynamicMax.nmvPct.value,
        isManual: targets.nmvPct > 0,
        label: targets.nmvPct > 0 ? `Target: ${targets.nmvPct}%` : `Top (${dynamicMax.nmvPct.topWh}): ${dynamicMax.nmvPct.value.toFixed(1)}%`,
      },
      avgValue: {
        value: targets.avgValue > 0 ? targets.avgValue : dynamicMax.avgValue.value,
        isManual: targets.avgValue > 0,
        label: targets.avgValue > 0 ? `Target: ${targets.avgValue.toLocaleString()} EGP` : `Top (${dynamicMax.avgValue.topWh}): ${dynamicMax.avgValue.value.toLocaleString()} EGP`,
      },
      avgOrders: {
        value: targets.avgOrders > 0 ? targets.avgOrders : dynamicMax.avgOrders.value,
        isManual: targets.avgOrders > 0,
        label: targets.avgOrders > 0 ? `Target: ${targets.avgOrders} orders` : `Top (${dynamicMax.avgOrders.topWh}): ${dynamicMax.avgOrders.value.toFixed(2)} orders`,
      },
      avgWeight: {
        value: targets.avgWeight > 0 ? targets.avgWeight : dynamicMax.avgWeight.value,
        isManual: targets.avgWeight > 0,
        label: targets.avgWeight > 0 ? `Target: ${targets.avgWeight.toLocaleString()} KG` : `Top (${dynamicMax.avgWeight.topWh}): ${dynamicMax.avgWeight.value.toLocaleString()} KG`,
      },
      ordersPerHour: {
        value: targets.ordersPerHour > 0 ? targets.ordersPerHour : dynamicMax.ordersPerHour.value,
        isManual: targets.ordersPerHour > 0,
        label: targets.ordersPerHour > 0 ? `Target: ${targets.ordersPerHour} / hr` : `Top (${dynamicMax.ordersPerHour.topWh}): ${dynamicMax.ordersPerHour.value.toFixed(2)} / hr`,
      },
      weightPerHour: {
        value: targets.weightPerHour > 0 ? targets.weightPerHour : dynamicMax.weightPerHour.value,
        isManual: targets.weightPerHour > 0,
        label: targets.weightPerHour > 0 ? `Target: ${targets.weightPerHour} KG / hr` : `Top (${dynamicMax.weightPerHour.topWh}): ${dynamicMax.weightPerHour.value.toFixed(1)} KG / hr`,
      },
    };

    const benchmarkMaxDeficit = targets.maxDeficit > 0 ? targets.maxDeficit : dynamicMaxTotalDeficit;
    const benchmarkMaxTickets = targets.maxTickets > 0 ? targets.maxTickets : maxTickets;
    const totalWeight = (weights.nmvPct || 0) + (weights.productivity || 0) + (weights.deficits || 0) + (weights.tickets || 0) || 1;
    return base
      .map(b => {
        // NMV% score: If manual target set, score relative to target; otherwise score is directly the warehouse NMV%
        const nmvNorm = benchmark.nmvPct.isManual
          ? (benchmark.nmvPct.value > 0 ? Math.min(100, (b.values.nmvPct / benchmark.nmvPct.value) * 100) : 0)
          : Math.min(100, b.values.nmvPct);

        // Productivity normalized scores
        const scores: Record<FactorKey, number> = {
          nmvPct: nmvNorm,
          avgValue: benchmark.avgValue.value > 0 ? safeDiv(Math.min(100, (b.values.avgValue / benchmark.avgValue.value) * 100), 1) : 0,
          avgOrders: benchmark.avgOrders.value > 0 ? safeDiv(Math.min(100, (b.values.avgOrders / benchmark.avgOrders.value) * 100), 1) : 0,
          avgWeight: benchmark.avgWeight.value > 0 ? safeDiv(Math.min(100, (b.values.avgWeight / benchmark.avgWeight.value) * 100), 1) : 0,
          ordersPerHour: benchmark.ordersPerHour.value > 0 ? safeDiv(Math.min(100, (b.values.ordersPerHour / benchmark.ordersPerHour.value) * 100), 1) : 0,
          weightPerHour: benchmark.weightPerHour.value > 0 ? safeDiv(Math.min(100, (b.values.weightPerHour / benchmark.weightPerHour.value) * 100), 1) : 0,
        };

        const prodNormSum = PRODUCTIVITY_FACTORS.reduce((sum, f) => sum + scores[f.key], 0);
        const prodNormAvg = prodNormSum / PRODUCTIVITY_FACTORS.length;

        // Individual deficit scores (0-100 where 0 deficit = 100%)
        const pendingScore = maxPending > 0 ? Math.max(0, (1 - (b.pendingDeficit / maxPending)) * 100) : 100;
        const damageScore = maxDamage > 0 ? Math.max(0, (1 - (b.damageDeficit / maxDamage)) * 100) : 100;
        const extraScore = maxExtra > 0 ? Math.max(0, (1 - (b.extraDeficit / maxExtra)) * 100) : 100;

        // Deficit total pool score: lower deficit is better (100 for 0 deficit, scales down to 0 for highest deficit)
        const deficitScore = benchmarkMaxDeficit > 0 ? Math.max(0, (1 - (b.totalDeficit / benchmarkMaxDeficit)) * 100) : 100;

        // Tickets relative score: lower is better (0 tickets = 100%)
        const ticketsScore = benchmarkMaxTickets > 0 ? Math.max(0, (1 - (b.tickets / benchmarkMaxTickets)) * 100) : 100;

        // Points earned from each category
        const nmvPoints = (nmvNorm * ((weights.nmvPct || 0) / totalWeight));
        const prodPoints = (prodNormAvg * ((weights.productivity || 0) / totalWeight));
        const defPoints = (deficitScore * ((weights.deficits || 0) / totalWeight));
        const ticketsPoints = (ticketsScore * ((weights.tickets || 0) / totalWeight));

        // Unified score: NMV% weight + Productivity weight + Deficits weight + Tickets weight
        const score = nmvPoints + prodPoints + defPoints + ticketsPoints;

        return {
          ...b,
          score: safeDiv(score, 1),
          scores,
          deficitScore: safeDiv(deficitScore, 1),
          pendingScore: safeDiv(pendingScore, 1),
          damageScore: safeDiv(damageScore, 1),
          extraScore: safeDiv(extraScore, 1),
          ticketsScore: safeDiv(ticketsScore, 1),
          nmvPoints: safeDiv(nmvPoints, 1),
          prodPoints: safeDiv(prodPoints, 1),
          defPoints: safeDiv(defPoints, 1),
          ticketsPoints: safeDiv(ticketsPoints, 1),
          benchmark,
          benchmarkMaxDeficit,
          benchmarkMaxTickets,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [salaryData, reconData, onDemandData, fleetOpData, pendingData, damageData, extraData, ticketsData, fromDate, toDate, weights, targets]);

  const draftTotal = (draftWeights.nmvPct || 0) + (draftWeights.productivity || 0) + (draftWeights.deficits || 0) + (draftWeights.tickets || 0);

  const handleSave = () => {
    if (Math.round(draftTotal) !== 100) {
      toast.error(`Weights must total 100% — currently ${draftTotal.toFixed(0)}%`);
      return;
    }
    setWeights(draftWeights);
    setTargets(draftTargets);
    setOpen(false);
    toast.success('Weights & Benchmarks updated successfully');
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
        'NMV% Score': +r.scores.nmvPct.toFixed(1),
        'Avg Value': +r.values.avgValue.toFixed(2),
        'Avg Value Score': +r.scores.avgValue.toFixed(1),
        'Avg Orders': +r.values.avgOrders.toFixed(2),
        'Avg Orders Score': +r.scores.avgOrders.toFixed(1),
        'Avg Weight': +r.values.avgWeight.toFixed(2),
        'Avg Weight Score': +r.scores.avgWeight.toFixed(1),
        'Orders/Hour': +r.values.ordersPerHour.toFixed(2),
        'Orders/Hour Score': +r.scores.ordersPerHour.toFixed(1),
        'Weight/Hour': +r.values.weightPerHour.toFixed(2),
        'Weight/Hour Score': +r.scores.weightPerHour.toFixed(1),
        'Pending Deficit': +r.pendingDeficit.toFixed(2),
        'Pending Score': +r.pendingScore.toFixed(1),
        'Damage Deficit': +r.damageDeficit.toFixed(2),
        'Damage Score': +r.damageScore.toFixed(1),
        'Extra Deficit': +r.extraDeficit.toFixed(2),
        'Extra Score': +r.extraScore.toFixed(1),
        'Total Deficit': +r.totalDeficit.toFixed(2),
        'Deficit Pool Score': +r.deficitScore.toFixed(1),
        'Support Tickets': r.tickets,
        'Tickets Score': +r.ticketsScore.toFixed(1),
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
          {/* Calculation Guide Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGuideOpen(true)}
            className="text-xs h-9 gap-1 text-primary border-primary/40 hover:bg-primary/10 font-medium"
          >
            <HelpCircle className="h-4 w-4 text-primary" />
            <span>Logic & Guide</span>
          </Button>

          {/* Weights & Benchmarks Dialog */}
          <Dialog open={open} onOpenChange={o => { setOpen(o); if (o) { setDraftWeights(weights); setDraftTargets(targets); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-9">
                <Settings2 className="h-4 w-4 mr-1" /> Weights & Benchmarks
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Performance Weights & Target Benchmarks</DialogTitle>
                <DialogDescription>Configure category weights (%) and optional manual benchmark targets.</DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="weights" className="w-full mt-2">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="weights">Category Weights (%)</TabsTrigger>
                  <TabsTrigger value="benchmarks">Manual Benchmarks</TabsTrigger>
                </TabsList>

                <TabsContent value="weights" className="space-y-3 pt-3">
                  <div className="flex items-center gap-3">
                    <label className="flex-1 text-sm font-medium">NMV% Weight</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draftWeights.nmvPct}
                      onChange={e => setDraftWeights({ ...draftWeights, nmvPct: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="h-9 w-24"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 text-sm font-medium">Productivity Weight</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draftWeights.productivity}
                      onChange={e => setDraftWeights({ ...draftWeights, productivity: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="h-9 w-24"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 text-sm font-medium">Deficits Weight</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draftWeights.deficits}
                      onChange={e => setDraftWeights({ ...draftWeights, deficits: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="h-9 w-24"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 text-sm font-medium">Tickets Weight</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draftWeights.tickets || 0}
                      onChange={e => setDraftWeights({ ...draftWeights, tickets: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="h-9 w-24"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className={`text-sm font-semibold pt-2 border-t ${Math.round(draftTotal) === 100 ? 'text-success' : 'text-destructive'}`}>
                    Total: {draftTotal.toFixed(0)}% {Math.round(draftTotal) === 100 ? '✓' : '(must equal 100%)'}
                  </div>
                </TabsContent>

                <TabsContent value="benchmarks" className="space-y-3 pt-3">
                  <p className="text-xs text-muted-foreground bg-muted/60 p-2.5 rounded-md leading-relaxed">
                    💡 <strong>اختياري:</strong> يمكنك تحديد مستهدف رقمي (Target). إذا تركت القيمة <strong>0 أو فارغة</strong>، سيعتمد النظام تلقائياً على أداء أعلى مخزن في نفس الفترة.
                  </p>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <label className="flex-1 text-xs font-medium">Target Avg Value (EGP)</label>
                      <Input
                        type="number"
                        placeholder="Auto (Max)"
                        value={draftTargets.avgValue || ''}
                        onChange={e => setDraftTargets({ ...draftTargets, avgValue: parseFloat(e.target.value) || 0 })}
                        className="h-8 w-28 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 text-xs font-medium">Target Avg Orders (Orders/RunSheet)</label>
                      <Input
                        type="number"
                        placeholder="Auto (Max)"
                        value={draftTargets.avgOrders || ''}
                        onChange={e => setDraftTargets({ ...draftTargets, avgOrders: parseFloat(e.target.value) || 0 })}
                        className="h-8 w-28 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 text-xs font-medium">Target Avg Weight (KG/RunSheet)</label>
                      <Input
                        type="number"
                        placeholder="Auto (Max)"
                        value={draftTargets.avgWeight || ''}
                        onChange={e => setDraftTargets({ ...draftTargets, avgWeight: parseFloat(e.target.value) || 0 })}
                        className="h-8 w-28 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 text-xs font-medium">Target Orders / Hour</label>
                      <Input
                        type="number"
                        step={0.1}
                        placeholder="Auto (Max)"
                        value={draftTargets.ordersPerHour || ''}
                        onChange={e => setDraftTargets({ ...draftTargets, ordersPerHour: parseFloat(e.target.value) || 0 })}
                        className="h-8 w-28 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 text-xs font-medium">Target Weight / Hour (KG/hr)</label>
                      <Input
                        type="number"
                        placeholder="Auto (Max)"
                        value={draftTargets.weightPerHour || ''}
                        onChange={e => setDraftTargets({ ...draftTargets, weightPerHour: parseFloat(e.target.value) || 0 })}
                        className="h-8 w-28 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 text-xs font-medium">Target NMV%</label>
                      <Input
                        type="number"
                        placeholder="Auto (Max)"
                        value={draftTargets.nmvPct || ''}
                        onChange={e => setDraftTargets({ ...draftTargets, nmvPct: parseFloat(e.target.value) || 0 })}
                        className="h-8 w-28 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 text-xs font-medium">Max Deficit Tolerance (EGP)</label>
                      <Input
                        type="number"
                        placeholder="Auto (Max Deficit)"
                        value={draftTargets.maxDeficit || ''}
                        onChange={e => setDraftTargets({ ...draftTargets, maxDeficit: parseFloat(e.target.value) || 0 })}
                        className="h-8 w-28 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 text-xs font-medium">Max Tickets Tolerance (Count)</label>
                      <Input
                        type="number"
                        placeholder="Auto (Max Tickets)"
                        value={draftTargets.maxTickets || ''}
                        onChange={e => setDraftTargets({ ...draftTargets, maxTickets: parseFloat(e.target.value) || 0 })}
                        className="h-8 w-28 text-xs"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-3">
                <Button variant="ghost" size="sm" onClick={() => { setDraftWeights(DEFAULT_WEIGHTS); setDraftTargets(DEFAULT_TARGETS); }}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Reset All
                </Button>
                <Button size="sm" onClick={handleSave}>Save Settings</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={handleExport} disabled={!rows.length} className="text-xs h-9">
            <Download className="h-4 w-4 mr-1" /> Export Excel
          </Button>
        </div>
      </div>

      {/* Interactive Detail Modal on Click */}
      <Dialog open={Boolean(cellDetail)} onOpenChange={o => { if (!o) setCellDetail(null); }}>
        <DialogContent className="max-w-md">
          {cellDetail && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 border-b pb-2">
                  <DialogTitle className="text-base flex items-center gap-1.5 text-primary">
                    <Info className="h-4 w-4" />
                    <span>{cellDetail.title}</span>
                  </DialogTitle>
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary font-bold">
                    {cellDetail.warehouse}
                  </span>
                </div>
                <DialogDescription className="pt-1 text-xs">
                  تفاصيل طريقة الحساب، المقارنة بالـ Benchmark، والنقاط المكتسبة في التقييم النهائي.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-xs pt-1">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded bg-muted/60 border">
                    <div className="text-muted-foreground text-[11px]">{cellDetail.actualLabel}</div>
                    <div className="font-bold text-sm text-foreground mt-0.5">{cellDetail.actualValue}</div>
                  </div>
                  <div className="p-2.5 rounded bg-muted/60 border">
                    <div className="text-muted-foreground text-[11px]">الـ Benchmark المعتمد</div>
                    <div className="font-bold text-sm text-primary mt-0.5">{cellDetail.benchmarkValue}</div>
                  </div>
                </div>

                {/* Calculation Formula */}
                <div className="p-2.5 rounded bg-card border space-y-1">
                  <div className="font-semibold text-[11px] text-muted-foreground">معادلة استخراج القيمة:</div>
                  <div className="font-mono text-[11px] bg-muted/80 p-1.5 rounded text-foreground break-words">
                    {cellDetail.formula}
                  </div>
                </div>

                {/* Score & Benchmark Normalization */}
                <div className="p-2.5 rounded bg-card border space-y-1">
                  <div className="font-semibold text-[11px] text-muted-foreground">حساب سكور المؤشر (Score %):</div>
                  <div className="font-mono text-[11px] bg-muted/80 p-1.5 rounded text-primary font-bold">
                    {cellDetail.scoreText}
                  </div>
                </div>

                {/* Weight & Points Earned */}
                <div className="p-2.5 rounded bg-primary/10 border border-primary/20 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{cellDetail.weightLabel}:</span>
                    <span className="font-bold text-primary">{cellDetail.weightPct.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-primary/20">
                    <span>النقاط المكتسبة في الإجمالي:</span>
                    <span>+{cellDetail.pointsEarned.toFixed(2)} pts</span>
                  </div>
                </div>

                {/* Explanation in Arabic */}
                <p className="text-muted-foreground text-[11px] leading-relaxed bg-muted/40 p-2 rounded">
                  {cellDetail.explanation}
                </p>
              </div>

              <DialogFooter className="mt-2">
                <Button size="sm" onClick={() => setCellDetail(null)}>إغلاق (Close)</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Calculation Guide Dialog */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <BookOpen className="h-5 w-5" />
              دليل الحسابات ولوجيك التقييم بالأمثلة (Calculation Guide & Logic)
            </DialogTitle>
            <DialogDescription>
              شرح شامل ومفصل لكيفية حساب كل عمود، تحديد الـ Benchmark، وتوزيع الأوزان حتى استخراج السكور النهائي.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs leading-relaxed text-foreground pt-2">
            {/* Card 1: Overview */}
            <div className="p-3 rounded-lg border bg-muted/40 space-y-2">
              <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" /> 1. منهجية التقييم المعياري (Benchmark Normalization)
              </h4>
              <p>
                لكل مؤشر، يتم مقارنة أداء كل مخزن إما بمستهدف يدوي <strong>(Target)</strong> حدده المستخدم، أو بأداء <strong>أعلى مخزن (Top Performer = 100%)</strong> في نفس الفترة المحددة بالفلتر.
              </p>
              <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                <div className="p-2 rounded bg-card border text-center">
                  <div className="text-muted-foreground font-sans text-[10px]">وزن NMV%</div>
                  <div className="font-bold text-primary">{weights.nmvPct}%</div>
                </div>
                <div className="p-2 rounded bg-card border text-center">
                  <div className="text-muted-foreground font-sans text-[10px]">وزن الإنتاجية (5 مؤشرات)</div>
                  <div className="font-bold text-primary">{weights.productivity}%</div>
                  <div className="text-[9px] text-muted-foreground font-sans">({(weights.productivity / 5).toFixed(1)}% لكل مؤشر)</div>
                </div>
                <div className="p-2 rounded bg-card border text-center">
                  <div className="text-muted-foreground font-sans text-[10px]">وزن العجوزات (Deficits)</div>
                  <div className="font-bold text-primary">{weights.deficits}%</div>
                </div>
                <div className="p-2 rounded bg-card border text-center">
                  <div className="text-muted-foreground font-sans text-[10px]">وزن التذاكر (Tickets)</div>
                  <div className="font-bold text-primary">{weights.tickets || 0}%</div>
                </div>
              </div>
            </div>

            {/* Card 2: NMV% */}
            <div className="p-3 rounded-lg border bg-card space-y-1.5">
              <h4 className="font-bold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> 2. نسبة التسليم المالي (NMV%)
              </h4>
              <div className="font-mono bg-muted p-1.5 rounded text-[11px]">
                NMV% = (∑ NMV ÷ ∑ OFD_VALUE) × 100
              </div>
              <p>
                <strong>طريقة حساب السكور:</strong> (NMV% المخزن ÷ Benchmark) × 100.
              </p>
              <p className="text-muted-foreground">
                <strong>مثال:</strong> مخزن حقق NMV% بقيمة 97.87%، وكان الـ Benchmark هو 99.50%، فإن سكور المؤشر = (97.87 ÷ 99.50) × 100 = <strong>98.36%</strong>. يساهم في الإجمالي بـ: 98.36% × {weights.nmvPct}% = <strong>+{(98.36 * (weights.nmvPct / 100)).toFixed(2)} نقطة</strong>.
              </p>
            </div>

            {/* Card 3: Productivity 5 Factors */}
            <div className="p-3 rounded-lg border bg-card space-y-2">
              <h4 className="font-bold text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Calculator className="h-4 w-4" /> 3. مؤشرات الإنتاجية الـ 5 (Productivity) — وزن إجمالي {weights.productivity}%
              </h4>
              <div className="space-y-1.5 pl-2 border-l-2 border-primary/30">
                <div>
                  <strong>• Avg Value (متوسط قيمة الرحلة):</strong> ∑ OFD_VALUE ÷ عدد الـ Run Sheets.
                </div>
                <div>
                  <strong>• Avg Orders (متوسط طلبات الرحلة):</strong> ∑ OFD_ORDERS ÷ عدد الـ Run Sheets.
                </div>
                <div>
                  <strong>• Avg Weight (متوسط وزن الرحلة):</strong> ∑ WEIGHT ÷ عدد الـ Run Sheets.
                </div>
                <div>
                  <strong>• Orders/Hour (معدل الطلبات بالساعة):</strong> ∑ OFD_ORDERS ÷ ∑ TRIP_TIME_HRS.
                </div>
                <div>
                  <strong>• Weight/Hour (معدل الوزن بالساعة):</strong> ∑ WEIGHT ÷ ∑ TRIP_TIME_HRS.
                </div>
              </div>
              <p className="text-muted-foreground bg-muted/50 p-2 rounded">
                <strong>مثال عملي (Avg Value):</strong> مخزن الشرقية حقق متوسط 77,768 جنيه/رحلة، وأعلى مخزن (المنصورة) حقق 97,510 جنيه/رحلة. السكور = (77,768 ÷ 97,510) × 100 = <strong>79.75%</strong>. النقاط المكتسبة = 79.75% × {(weights.productivity / 5).toFixed(1)}% = <strong>+{(79.75 * ((weights.productivity / 5) / 100)).toFixed(2)} نقطة</strong>.
              </p>
            </div>

            {/* Card 4: Deficits */}
            <div className="p-3 rounded-lg border bg-card space-y-2">
              <h4 className="font-bold text-sm text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> 4. مؤشرات العجوزات (Deficits) — وزن إجمالي {weights.deficits}%
              </h4>
              <p>
                العجوزات مؤشر خسارة (Negative Metric). المخزن صاحب العجز الأقل هو الأفضل.
              </p>
              <div className="space-y-1 font-mono text-[11px] bg-muted p-2 rounded">
                <div>• Pending Deficit = مجموع PENDING_VALUE (حيث المسؤولية Liability = Courier)</div>
                <div>• Damage Deficit = مجموع DAMAGE_VALUE (حيث المسؤولية Liability = Courier)</div>
                <div>• Extra Deficit = مجموع EXTRA_VALUE (حيث المسؤولية Liability = Courier)</div>
                <div>• Total Deficit = Pending + Damage + Extra</div>
              </div>
              <div className="font-mono bg-muted p-1.5 rounded text-[11px]">
                Deficit Score = (1 - (Total Deficit ÷ Max Deficit Benchmark)) × 100
              </div>
              <p className="text-muted-foreground">
                <strong>مثال:</strong> إذا كان عجز المخزن 500 جنيه، وأعلى عجز سجله أسوأ مخزن هو 35,000 جنيه: السكور = (1 - 500 ÷ 35,000) × 100 = <strong>98.57%</strong>. وإذا كان العجز 0 جنيه يأخذ <strong>100% كاملة</strong>.
              </p>
            </div>

            {/* Card 5: Tickets */}
            <div className="p-3 rounded-lg border bg-card space-y-1.5">
              <h4 className="font-bold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> 5. تذاكر الدعم والشكاوى (Support Tickets)
              </h4>
              <p>
                يتم سحب التذاكر من شيت <strong>Ecommerce Max Support Tickets</strong> بناءً على عمود <strong>WAREHOUSE</strong> وتاريخ <strong>DAT</strong> في الفترة المحددة، وعمل <strong>COUNT</strong> لإجمالي عدد التذاكر المسجلة للمخزن.
              </p>
              <div className="font-mono bg-muted p-1.5 rounded text-[11px]">
                Tickets Score = (1 - (Warehouse Tickets ÷ Max Tickets Benchmark)) × 100
              </div>
            </div>

            {/* Card 6: Total Score Formula */}
            <div className="p-3 rounded-lg border bg-primary/10 border-primary/30 space-y-1.5">
              <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
                🏆 6. معادلة التقييم النهائي الإجمالي (Total Performance %)
              </h4>
              <div className="font-mono text-[11px] p-2 bg-background rounded border">
                Total Performance = (NMV_Score × {weights.nmvPct}%) + (Productivity_Avg_Score × {weights.productivity}%) + (Deficits_Score × {weights.deficits}%) + (Tickets_Score × {weights.tickets || 0}%)
              </div>
              <p className="text-muted-foreground text-[11px]">
                حيث أن Productivity_Avg_Score هو متوسط سكورات مؤشرات الإنتاجية الـ 5.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button size="sm" onClick={() => setGuideOpen(false)}>فهمت (Close Guide)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Warehouse className="h-4 w-4" />
        <span>{rows.length} warehouses</span>
        <span className="opacity-60">
          | Weights: NMV% {weights.nmvPct}% · Productivity {weights.productivity}% · Deficits {weights.deficits}%{weights.tickets > 0 ? ` · Tickets ${weights.tickets}%` : ''}
        </span>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[72vh]">
        <table className="text-sm w-max min-w-full">
          <thead className="sticky top-0 z-20">
            <tr>
              <th rowSpan={2} className="table-header-cell sticky left-0 z-30 min-w-[60px] text-center">#</th>
              <th rowSpan={2} className="table-header-cell sticky left-[60px] z-30 min-w-[220px] text-left">Warehouse</th>
              <th rowSpan={2} className="table-header-cell text-center min-w-[130px]">
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
              <th rowSpan={2} className="table-header-cell text-center min-w-[110px] border-r-2 border-primary-foreground/40">
                Tickets
                <span className="block text-[10px] font-normal opacity-70">{weights.tickets > 0 ? `${weights.tickets}%` : 'Count'}</span>
              </th>
              <th rowSpan={2} className="table-header-cell text-center min-w-[150px]">Total Performance</th>
            </tr>
            <tr>
              {PRODUCTIVITY_FACTORS.map((f, idx) => (
                <th
                  key={f.key}
                  className={`table-header-cell text-center min-w-[125px] ${
                    idx === PRODUCTIVITY_FACTORS.length - 1 ? 'border-r-2 border-primary-foreground/40' : ''
                  }`}
                >
                  {f.label}
                  <span className="block text-[10px] font-normal opacity-70">
                    {(weights.productivity / PRODUCTIVITY_FACTORS.length).toFixed(1)}%
                  </span>
                </th>
              ))}
              <th className="table-header-cell text-center min-w-[135px]">
                Pending Deficit
                <span className="block text-[10px] font-normal opacity-70">Part of {weights.deficits}%</span>
              </th>
              <th className="table-header-cell text-center min-w-[135px]">
                Damage Deficit
                <span className="block text-[10px] font-normal opacity-70">Part of {weights.deficits}%</span>
              </th>
              <th className="table-header-cell text-center min-w-[135px] border-r-2 border-primary-foreground/40">
                Extra Deficit
                <span className="block text-[10px] font-normal opacity-70">Part of {weights.deficits}%</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const prodWeightPerFactor = weights.productivity / PRODUCTIVITY_FACTORS.length;
              return (
                <tr key={r.warehouse} className="hover:bg-muted/50">
                  <td className="table-cell sticky left-0 bg-card z-10 text-center font-medium">{i + 1}</td>
                  <td className="table-cell sticky left-[60px] bg-card z-10 font-medium">{r.warehouse}</td>

                  {/* NMV% Cell with Click Details */}
                  <td
                    onClick={() => setCellDetail({
                      title: 'NMV% (نسبة التسليم المالي)',
                      warehouse: r.warehouse,
                      actualLabel: 'نسبة NMV% المحققة',
                      actualValue: `${r.values.nmvPct.toFixed(2)}%`,
                      formula: `NMV: ${r.nmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP ÷ OFD: ${r.ofd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP = ${r.values.nmvPct.toFixed(2)}%`,
                      benchmarkLabel: r.benchmark.nmvPct.isManual ? 'المستهدف اليدوي' : 'النسبة المئوية المحققة',
                      benchmarkValue: r.benchmark.nmvPct.isManual ? `${r.benchmark.nmvPct.value}%` : '100%',
                      scoreText: r.benchmark.nmvPct.isManual ? `(${r.values.nmvPct.toFixed(2)}% ÷ ${r.benchmark.nmvPct.value}%) × 100 = ${r.scores.nmvPct.toFixed(1)}%` : `${r.values.nmvPct.toFixed(2)}%`,
                      scorePct: r.scores.nmvPct,
                      weightLabel: 'وزن NMV% في التقييم',
                      weightPct: weights.nmvPct,
                      pointsEarned: r.nmvPoints,
                      explanation: `نسبة التسليم المالي = (إجمالي قيمة NMV المُسلّمة ÷ إجمالي قيمة OFD الخارجة للتسليم) × 100%. وتساهم بـ +${r.nmvPoints.toFixed(2)} نقطة في السكور النهائي.`,
                    })}
                    className="table-cell text-center whitespace-nowrap cursor-pointer hover:bg-primary/10 transition-colors"
                  >
                    <span className="font-semibold text-foreground">{r.values.nmvPct.toFixed(2)}%</span>
                    {r.benchmark.nmvPct.isManual && (
                      <span className="text-[11px] font-semibold text-primary/80 ml-1.5 underline decoration-primary/40 underline-offset-2">
                        ({r.scores.nmvPct.toFixed(1)}%)
                      </span>
                    )}
                  </td>

                  {/* Productivity Cells with Click Details */}
                  {PRODUCTIVITY_FACTORS.map((f, idx) => {
                    const factorScore = r.scores[f.key];
                    const factorPts = (factorScore * (prodWeightPerFactor / 100));
                    let formulaText = '';
                    if (f.key === 'avgValue') formulaText = `OFD Value: ${r.ofd.toLocaleString()} EGP ÷ ${r.runSheets} Run Sheets = ${r.values.avgValue.toLocaleString()} EGP`;
                    else if (f.key === 'avgOrders') formulaText = `OFD Orders: ${r.orders.toLocaleString()} ÷ ${r.runSheets} Run Sheets = ${r.values.avgOrders.toFixed(2)} Orders`;
                    else if (f.key === 'avgWeight') formulaText = `Total Weight: ${r.weight.toLocaleString()} KG ÷ ${r.runSheets} Run Sheets = ${r.values.avgWeight.toLocaleString()} KG`;
                    else if (f.key === 'ordersPerHour') formulaText = `OFD Orders: ${r.orders.toLocaleString()} ÷ ${r.tripTimeHrs.toFixed(1)} Trip Hours = ${r.values.ordersPerHour.toFixed(2)} Orders/hr`;
                    else if (f.key === 'weightPerHour') formulaText = `Total Weight: ${r.weight.toLocaleString()} KG ÷ ${r.tripTimeHrs.toFixed(1)} Trip Hours = ${r.values.weightPerHour.toFixed(1)} KG/hr`;

                    return (
                      <td
                        key={f.key}
                        onClick={() => setCellDetail({
                          title: `${f.label} (مؤشر إنتاجية)`,
                          warehouse: r.warehouse,
                          actualLabel: `قيمة ${f.label} المحققة`,
                          actualValue: f.fmt(r.values[f.key]),
                          formula: formulaText,
                          benchmarkLabel: r.benchmark[f.key].isManual ? 'المستهدف اليدوي' : 'أعلى مخزن تم تحقيقه',
                          benchmarkValue: r.benchmark[f.key].label,
                          scoreText: `(${f.fmt(r.values[f.key])} ÷ ${r.benchmark[f.key].value.toLocaleString()}) × 100 = ${factorScore.toFixed(1)}%`,
                          scorePct: factorScore,
                          weightLabel: 'حصة المؤشر من وزن الإنتاجية',
                          weightPct: prodWeightPerFactor,
                          pointsEarned: factorPts,
                          explanation: `تم قسمة أداء المخزن على الـ Benchmark (${r.benchmark[f.key].label}) للحصول على سكور ${factorScore.toFixed(1)}%، ومساهمة +${factorPts.toFixed(2)} نقطة في التقييم الكلي.`,
                        })}
                        className={`table-cell text-center whitespace-nowrap cursor-pointer hover:bg-primary/10 transition-colors ${
                          idx === PRODUCTIVITY_FACTORS.length - 1 ? 'border-r-2 border-border/80' : ''
                        }`}
                      >
                        <span className="font-medium text-foreground">{f.fmt(r.values[f.key])}</span>
                        <span className="text-[11px] font-semibold text-primary/80 ml-1.5 underline decoration-primary/40 underline-offset-2">
                          ({factorScore.toFixed(1)}%)
                        </span>
                      </td>
                    );
                  })}

                  {/* Pending Deficit with Click Details */}
                  <td
                    onClick={() => setCellDetail({
                      title: 'Pending Deficit (عجز المعلقات)',
                      warehouse: r.warehouse,
                      actualLabel: 'إجمالي قيمة عجز المعلقات',
                      actualValue: `${r.pendingDeficit.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP`,
                      formula: `∑ PENDING_VALUE من شيت Pending بشرط Liability = Courier`,
                      benchmarkLabel: 'المقياس (مؤشر سلبي)',
                      benchmarkValue: 'العجز = 0 يأخذ 100%',
                      scoreText: `سكور الفئة: ${r.pendingScore.toFixed(1)}%`,
                      scorePct: r.pendingScore,
                      weightLabel: 'مجموعة العجوزات (Deficit Pool)',
                      weightPct: weights.deficits,
                      pointsEarned: r.defPoints,
                      explanation: `كلما قل عجز المعلقات كان الأداء أفضل. المخزن الذي ليس لديه أي عجز معلقات يحصل على 100%.`,
                    })}
                    className="table-cell text-right font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap cursor-pointer hover:bg-primary/10 transition-colors"
                  >
                    <span>{r.pendingDeficit > 0 ? r.pendingDeficit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span>
                    <span className="text-[11px] font-semibold text-primary/80 ml-1.5 underline decoration-primary/40 underline-offset-2">
                      ({r.pendingScore.toFixed(1)}%)
                    </span>
                  </td>

                  {/* Damage Deficit with Click Details */}
                  <td
                    onClick={() => setCellDetail({
                      title: 'Damage Deficit (عجز التوالف)',
                      warehouse: r.warehouse,
                      actualLabel: 'إجمالي قيمة عجز التوالف',
                      actualValue: `${r.damageDeficit.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP`,
                      formula: `∑ DAMAGE_VALUE من شيت Damage بشرط Liability = Courier`,
                      benchmarkLabel: 'المقياس (مؤشر سلبي)',
                      benchmarkValue: 'العجز = 0 يأخذ 100%',
                      scoreText: `سكور الفئة: ${r.damageScore.toFixed(1)}%`,
                      scorePct: r.damageScore,
                      weightLabel: 'مجموعة العجوزات (Deficit Pool)',
                      weightPct: weights.deficits,
                      pointsEarned: r.defPoints,
                      explanation: `المخزن الأقل في عجز التوالف يحصل على السكور الأعلى، ويحصل على 100% إذا كان عجز التوالف 0 جنيه.`,
                    })}
                    className="table-cell text-right font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap cursor-pointer hover:bg-primary/10 transition-colors"
                  >
                    <span>{r.damageDeficit > 0 ? r.damageDeficit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span>
                    <span className="text-[11px] font-semibold text-primary/80 ml-1.5 underline decoration-primary/40 underline-offset-2">
                      ({r.damageScore.toFixed(1)}%)
                    </span>
                  </td>

                  {/* Extra Deficit with Click Details */}
                  <td
                    onClick={() => setCellDetail({
                      title: 'Extra Deficit & Total Deficit Pool',
                      warehouse: r.warehouse,
                      actualLabel: 'إجمالي العجوزات (Pending + Damage + Extra)',
                      actualValue: `${r.totalDeficit.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP`,
                      formula: `Pending (${r.pendingDeficit.toFixed(2)}) + Damage (${r.damageDeficit.toFixed(2)}) + Extra (${r.extraDeficit.toFixed(2)}) = ${r.totalDeficit.toFixed(2)} EGP`,
                      benchmarkLabel: 'الحد الأقصى للعجز (Max Deficit)',
                      benchmarkValue: `${r.benchmarkMaxDeficit.toLocaleString()} EGP`,
                      scoreText: `(1 - ${r.totalDeficit.toFixed(2)} ÷ ${r.benchmarkMaxDeficit.toFixed(2)}) × 100 = ${r.deficitScore.toFixed(1)}%`,
                      scorePct: r.deficitScore,
                      weightLabel: 'وزن العجوزات الإجمالي',
                      weightPct: weights.deficits,
                      pointsEarned: r.defPoints,
                      explanation: `يتم تجميع كل أنواع العجوزات ومقارنتها بأقصى عجز في الفترة (${r.benchmarkMaxDeficit.toLocaleString()} جنيه). سكور العجوزات المكتسب هو ${r.deficitScore.toFixed(1)}% ليساهم بـ +${r.defPoints.toFixed(2)} نقطة.`,
                    })}
                    className="table-cell text-right font-medium text-red-600 dark:text-red-400 border-r-2 border-border/80 whitespace-nowrap cursor-pointer hover:bg-primary/10 transition-colors"
                  >
                    <span>{r.extraDeficit > 0 ? r.extraDeficit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span>
                    <span className="text-[11px] font-semibold text-primary/80 ml-1.5 underline decoration-primary/40 underline-offset-2">
                      ({r.extraScore.toFixed(1)}%)
                    </span>
                  </td>

                  {/* Support Tickets Column with Click Details */}
                  <td
                    onClick={() => setCellDetail({
                      title: 'Support Tickets (تذاكر الدعم والشكاوى)',
                      warehouse: r.warehouse,
                      actualLabel: 'عدد التذاكر المسجلة في الفترة',
                      actualValue: `${r.tickets.toLocaleString()} تذكرة`,
                      formula: `Count للتذاكر من شيت Ecommerce Max Support Tickets المربوطة بـ ${r.warehouse}`,
                      benchmarkLabel: 'الحد الأقصى للتذاكر (Max Tickets)',
                      benchmarkValue: `${r.benchmarkMaxTickets.toLocaleString()} تذكرة`,
                      scoreText: `(1 - ${r.tickets} ÷ ${r.benchmarkMaxTickets}) × 100 = ${r.ticketsScore.toFixed(1)}%`,
                      scorePct: r.ticketsScore,
                      weightLabel: 'وزن التذاكر في التقييم',
                      weightPct: weights.tickets || 0,
                      pointsEarned: r.ticketsPoints,
                      explanation: `كلما قل عدد التذاكر للمخزن كان مؤشر الجودة أفضل. إذا كان وزن التذاكر أكبر من 0%، فإن السكور يساهم بـ +${r.ticketsPoints.toFixed(2)} نقطة في الإجمالي.`,
                    })}
                    className="table-cell text-center font-medium text-amber-600 dark:text-amber-400 border-r-2 border-border/80 whitespace-nowrap cursor-pointer hover:bg-primary/10 transition-colors"
                  >
                    <span>{r.tickets.toLocaleString()}</span>
                    <span className="text-[11px] font-semibold text-primary/80 ml-1.5 underline decoration-primary/40 underline-offset-2">
                      ({r.ticketsScore.toFixed(1)}%)
                    </span>
                  </td>

                  {/* Total Performance with Click Details */}
                  <td
                    onClick={() => setCellDetail({
                      title: 'Total Performance Score (التقييم الإجمالي)',
                      warehouse: r.warehouse,
                      actualLabel: 'السكور النهائي المكتسب',
                      actualValue: `${r.score.toFixed(1)}%`,
                      formula: `NMV (${r.nmvPoints.toFixed(2)}) + Productivity (${r.prodPoints.toFixed(2)}) + Deficits (${r.defPoints.toFixed(2)})${weights.tickets > 0 ? ` + Tickets (${r.ticketsPoints.toFixed(2)})` : ''} = ${r.score.toFixed(1)}%`,
                      benchmarkLabel: 'الهدف الكلي',
                      benchmarkValue: '100% Performance',
                      scoreText: `إجمالي النقاط المكتسبة: ${r.score.toFixed(1)} / 100`,
                      scorePct: r.score,
                      weightLabel: 'إجمالي الأوزان',
                      weightPct: 100,
                      pointsEarned: r.score,
                      explanation: `التقييم الإجمالي يمثل مجموع النقاط المكتسبة من كل الفئات بناءً على أوزانها المحددة.`,
                    })}
                    className="table-cell text-center whitespace-nowrap cursor-pointer hover:bg-primary/10 transition-colors"
                  >
                    <span className={`inline-block px-2.5 py-0.5 rounded font-bold ${scoreColor(r.score)}`}>
                      {r.score.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={2 + 1 + PRODUCTIVITY_FACTORS.length + 3 + 1 + 1} className="table-cell text-center text-muted-foreground py-8">
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
