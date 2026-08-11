import { useState, useMemo } from 'react';
import { OnDemandRow } from '@/lib/google-sheets';
import { exportToExcel } from '@/lib/export-excel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Download, Maximize, Minimize, DollarSign, TrendingUp, Calculator, Award, Wallet, Users, Search, FileSpreadsheet } from 'lucide-react';

interface Props {
  data: OnDemandRow[];
  fromDate?: Date;
  toDate?: Date;
}

interface WarehouseGroup {
  wh: string;
  count: number;
  ofd: number;
  nmv: number;
  nmvPctAvg: number;
  fixed: number;
  variable: number;
  total: number;
  commission: number;
  totalWithCommission: number;
}

export default function OnDemandRegional({ data, fromDate, toDate }: Props) {
  const [whFilter, setWhFilter] = useState('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedWh, setSelectedWh] = useState<string | null>(null);
  const [detailSearch, setDetailSearch] = useState('');

  const parseDate = (d: string) => {
    const t = new Date(d);
    return isNaN(t.getTime()) ? null : t;
  };

  const warehouses = useMemo(() => [...new Set(data.map(r => r.WH).filter(Boolean))].sort(), [data]);

  const filtered = useMemo(() => {
    let result = data;
    
    // Date Filtering
    if (fromDate || toDate) {
      result = result.filter(r => {
        const d = parseDate(r.Date);
        if (!d) return false;
        if (fromDate) {
          const from = new Date(fromDate);
          from.setHours(0, 0, 0, 0);
          if (d < from) return false;
        }
        if (toDate) {
          const to = new Date(toDate);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
        return true;
      });
    }

    // Warehouse Filtering
    if (whFilter !== 'all') {
      result = result.filter(r => r.WH === whFilter);
    }
    
    return result;
  }, [data, whFilter, fromDate, toDate]);

  const grouped = useMemo((): WarehouseGroup[] => {
    const map = new Map<string, OnDemandRow[]>();
    filtered.forEach(r => {
      if (!r.WH) return;
      if (!map.has(r.WH)) map.set(r.WH, []);
      map.get(r.WH)!.push(r);
    });
    return [...map.entries()].map(([wh, rows]) => ({
      wh,
      count: [...new Set(rows.map(r => r.Name))].length, // Unique courier count
      ofd: rows.reduce((s, r) => s + r.Ofd, 0),
      nmv: rows.reduce((s, r) => s + r.NMV, 0),
      nmvPctAvg: rows.reduce((s, r) => s + r.NMV_PCT, 0) / (rows.length || 1),
      fixed: rows.reduce((s, r) => s + r.Fixed, 0),
      variable: rows.reduce((s, r) => s + r.Variable, 0),
      total: rows.reduce((s, r) => s + r.Total, 0),
      commission: rows.reduce((s, r) => s + r.Commission, 0),
      totalWithCommission: rows.reduce((s, r) => s + r.TotalWithCommission, 0),
    })).sort((a, b) => b.totalWithCommission - a.totalWithCommission);
  }, [filtered]);

  const totals = useMemo(() => ({
    fixed: filtered.reduce((s, r) => s + r.Fixed, 0),
    variable: filtered.reduce((s, r) => s + r.Variable, 0),
    total: filtered.reduce((s, r) => s + r.Total, 0),
    commission: filtered.reduce((s, r) => s + r.Commission, 0),
    totalWithCommission: filtered.reduce((s, r) => s + r.TotalWithCommission, 0),
  }), [filtered]);

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtPct = (n: number) => n.toFixed(1) + '%';

  const summaryCards = [
    { label: 'Fixed', value: fmt(totals.fixed), icon: DollarSign, color: 'text-blue-600 bg-blue-50' },
    { label: 'Variable', value: fmt(totals.variable), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Total', value: fmt(totals.total), icon: Calculator, color: 'text-purple-600 bg-purple-50' },
    { label: 'Commission', value: fmt(totals.commission), icon: Award, color: 'text-amber-600 bg-amber-50' },
    { label: 'Total + Commission', value: fmt(totals.totalWithCommission), icon: Wallet, color: 'text-rose-600 bg-rose-50' },
  ];

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleExport = () => {
    exportToExcel(grouped.map(g => ({
      'Warehouse': g.wh,
      'Couriers': g.count,
      'OFD': g.ofd,
      'NMV': g.nmv,
      'NMV %': fmtPct(g.nmvPctAvg),
      'Fixed': g.fixed,
      'Variable': g.variable,
      'Total': g.total,
      'Commission': g.commission,
      'Total + Commission': g.totalWithCommission,
    })), 'OnDemand_Regional_Summary');
  };

  const warehouseDetails = useMemo(() => {
    if (!selectedWh) return [];
    const rows = filtered.filter(r => r.WH === selectedWh);
    
    // Group by Courier Name for the detail view
    const courierMap = new Map<string, any>();
    rows.forEach(r => {
      if (!courierMap.has(r.Name)) {
        courierMap.set(r.Name, {
          Name: r.Name,
          WH: r.WH,
          Days: 0,
          Ofd: 0,
          NMV: 0,
          Fixed: 0,
          Variable: 0,
          Total: 0,
          Commission: 0,
          TotalWithCommission: 0
        });
      }
      const c = courierMap.get(r.Name);
      c.Days += 1;
      c.Ofd += r.Ofd;
      c.NMV += r.NMV;
      c.Fixed += r.Fixed;
      c.Variable += r.Variable;
      c.Total += r.Total;
      c.Commission += r.Commission;
      c.TotalWithCommission += r.TotalWithCommission;
    });

    const result = Array.from(courierMap.values());
    if (detailSearch) {
      const s = detailSearch.toLowerCase();
      return result.filter(c => c.Name.toLowerCase().includes(s));
    }
    return result;
  }, [selectedWh, filtered, detailSearch]);

  const exportWhDetails = () => {
    if (!selectedWh) return;
    exportToExcel(warehouseDetails.map(c => ({
      'Courier Name': c.Name,
      'Warehouse': c.WH,
      'Active Days': c.Days,
      'OFD': c.Ofd,
      'NMV': c.NMV,
      'Fixed': c.Fixed,
      'Variable': c.Variable,
      'Total': c.Total,
      'Commission': c.Commission,
      'Total + Commission': c.TotalWithCommission,
    })), `OnDemand_Details_${selectedWh}`);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={whFilter} onValueChange={setWhFilter}>
            <SelectTrigger className="w-[200px] h-9 text-xs">
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded">
            {fromDate?.toLocaleDateString()} - {toDate?.toLocaleDateString()}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="h-9 font-semibold">
            <Download className="h-4 w-4 mr-1.5" /> Export Summary
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="border shadow-sm overflow-hidden">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-xl ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{card.label}</p>
                  <p className="text-lg font-extrabold text-foreground">{card.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Table */}
      <Card className="shadow-sm border">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-tight">Warehouse</th>
                <th className="text-center px-4 py-3 font-bold text-muted-foreground uppercase tracking-tight">Couriers</th>
                <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase tracking-tight">OFD</th>
                <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase tracking-tight">NMV</th>
                <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase tracking-tight">NMV %</th>
                <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase tracking-tight">Fixed</th>
                <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase tracking-tight">Variable</th>
                <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase tracking-tight">Total</th>
                <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase tracking-tight">Commission</th>
                <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase tracking-tight bg-primary/5">Total + Comm</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {grouped.map(g => (
                <tr key={g.wh} className="group hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <button 
                      onClick={() => setSelectedWh(g.wh)}
                      className="text-indigo-600 font-bold hover:underline decoration-2 underline-offset-4 flex items-center gap-1.5"
                    >
                      {g.wh}
                      <Maximize className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-slate-600">{g.count}</td>
                  <td className="px-4 py-3 text-right">{fmt(g.ofd)}</td>
                  <td className="px-4 py-3 text-right">{fmt(g.nmv)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{fmtPct(g.nmvPctAvg)}</td>
                  <td className="px-4 py-3 text-right">{fmt(g.fixed)}</td>
                  <td className="px-4 py-3 text-right">{fmt(g.variable)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">{fmt(g.total)}</td>
                  <td className="px-4 py-3 text-right text-amber-600">{fmt(g.commission)}</td>
                  <td className="px-4 py-3 text-right font-extrabold text-primary bg-primary/5">{fmt(g.totalWithCommission)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                <td className="px-4 py-3 uppercase tracking-wider text-[10px] text-slate-500">Grand Total</td>
                <td className="px-4 py-3 text-center">{grouped.reduce((s, g) => s + g.count, 0)}</td>
                <td className="px-4 py-3 text-right">{fmt(grouped.reduce((s, g) => s + g.ofd, 0))}</td>
                <td className="px-4 py-3 text-right">{fmt(grouped.reduce((s, g) => s + g.nmv, 0))}</td>
                <td className="px-4 py-3 text-right">-</td>
                <td className="px-4 py-3 text-right">{fmt(totals.fixed)}</td>
                <td className="px-4 py-3 text-right">{fmt(totals.variable)}</td>
                <td className="px-4 py-3 text-right text-slate-900">{fmt(totals.total)}</td>
                <td className="px-4 py-3 text-right text-amber-600">{fmt(totals.commission)}</td>
                <td className="px-4 py-3 text-right text-primary bg-primary/10">{fmt(totals.totalWithCommission)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!selectedWh} onOpenChange={(open) => !open && setSelectedWh(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
          <div className="p-6 border-b bg-white">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2 text-indigo-700 text-xl font-extrabold">
                    <Users className="w-6 h-6" /> {selectedWh} Details
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    Courier-level performance breakdown for the selected period.
                  </DialogDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Search couriers..." 
                      value={detailSearch}
                      onChange={e => setDetailSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 w-full text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <Button onClick={exportWhDetails} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold rounded-xl shadow-lg shadow-emerald-500/20">
                    <FileSpreadsheet className="w-4 h-4" /> Export Excel
                  </Button>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
            <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b z-10">
                  <tr>
                    <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap">Courier Name</th>
                    <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap text-center">Days</th>
                    <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap text-right">OFD</th>
                    <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap text-right">NMV</th>
                    <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap text-right">Fixed</th>
                    <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap text-right">Variable</th>
                    <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap text-right">Total</th>
                    <th className="p-3 font-bold text-slate-600 border-r whitespace-nowrap text-right">Comm.</th>
                    <th className="p-3 font-bold text-slate-600 text-right bg-indigo-50">Total + Comm</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {warehouseDetails.map((c, i) => (
                    <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="p-3 border-r font-bold text-slate-900">{c.Name}</td>
                      <td className="p-3 border-r text-center text-slate-500">{c.Days}</td>
                      <td className="p-3 border-r text-right font-medium">{fmt(c.Ofd)}</td>
                      <td className="p-3 border-r text-right text-slate-600">{fmt(c.NMV)}</td>
                      <td className="p-3 border-r text-right text-slate-600">{fmt(c.Fixed)}</td>
                      <td className="p-3 border-r text-right text-slate-600">{fmt(c.Variable)}</td>
                      <td className="p-3 border-r text-right font-bold text-slate-800">{fmt(c.Total)}</td>
                      <td className="p-3 border-r text-right text-amber-600 font-bold">{fmt(c.Commission)}</td>
                      <td className="p-3 text-right font-extrabold text-indigo-700 bg-indigo-50/50">{fmt(c.TotalWithCommission)}</td>
                    </tr>
                  ))}
                  {warehouseDetails.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400 italic">No couriers found matching your search.</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 font-extrabold text-[12px]">
                  <tr>
                    <td className="p-3 border-r">TOTAL</td>
                    <td className="p-3 border-r text-center">{warehouseDetails.reduce((s, c) => s + c.Days, 0)}</td>
                    <td className="p-3 border-r text-right">{fmt(warehouseDetails.reduce((s, c) => s + c.Ofd, 0))}</td>
                    <td className="p-3 border-r text-right">{fmt(warehouseDetails.reduce((s, c) => s + c.NMV, 0))}</td>
                    <td className="p-3 border-r text-right">{fmt(warehouseDetails.reduce((s, c) => s + c.Fixed, 0))}</td>
                    <td className="p-3 border-r text-right">{fmt(warehouseDetails.reduce((s, c) => s + c.Variable, 0))}</td>
                    <td className="p-3 border-r text-right">{fmt(warehouseDetails.reduce((s, c) => s + c.Total, 0))}</td>
                    <td className="p-3 border-r text-right text-amber-600">{fmt(warehouseDetails.reduce((s, c) => s + c.Commission, 0))}</td>
                    <td className="p-3 text-right text-indigo-700 bg-indigo-50">{fmt(warehouseDetails.reduce((s, c) => s + c.TotalWithCommission, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
