import { useMemo, useState } from 'react';
import { SalaryRow } from '@/lib/google-sheets';
import { exportToExcel } from '@/lib/export-excel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowUp, ArrowDown, Download, Users, Activity, UserPlus, UserMinus, Clock, AlertTriangle, CalendarOff, Stethoscope, BanknoteIcon, Maximize, Minimize } from 'lucide-react';

interface Props {
  data: SalaryRow[];
  allData: SalaryRow[];
  fromDate?: Date;
  toDate?: Date;
}

interface DayMetrics {
  totalCapacity: number;
  totalActive: number;
  activePercent: number;
  checkedIn: number;
  late: number;
  annualLeave: number;
  sickLeave: number;
  unpaidLeave: number;
  noShow: number;
  newHires: number;
  leavers: number;
}

const METRIC_CONFIG: { key: keyof DayMetrics; label: string; tooltip: string; isPercent?: boolean; icon: any; color: string }[] = [
  { key: 'totalCapacity', label: 'Total Capacity', tooltip: 'Total number of records logged for this day - any courier with a record counts toward capacity', icon: Users, color: 'text-primary' },
  { key: 'totalActive', label: 'Total Active', tooltip: 'Number of couriers whose status is not NO_SHOW on this day', icon: Activity, color: 'text-success' },
  { key: 'activePercent', label: 'Active %', tooltip: 'Active % = (Active couriers ÷ Total Capacity) × 100', isPercent: true, icon: Activity, color: 'text-accent' },
  { key: 'checkedIn', label: 'CHECKED_IN', tooltip: 'Number of couriers who checked in on time', icon: Clock, color: 'text-success' },
  { key: 'late', label: 'LATE', tooltip: 'Number of couriers who arrived late for their shift', icon: AlertTriangle, color: 'text-warning' },
  { key: 'annualLeave', label: 'Annual Leave (Paid)', tooltip: 'Number of couriers on paid annual leave - status Annual-Leave', icon: CalendarOff, color: 'text-info' },
  { key: 'sickLeave', label: 'Sick Leave', tooltip: 'Number of couriers on sick leave - status Sick-Leave', icon: Stethoscope, color: 'text-info' },
  { key: 'unpaidLeave', label: 'Unpaid Leave', tooltip: 'Number of couriers on unpaid leave - status Unpaid-Leave', icon: BanknoteIcon, color: 'text-muted-foreground' },
  { key: 'noShow', label: 'NO_SHOW', tooltip: 'Number of couriers who did not show up and logged no status - status NO_SHOW', icon: AlertTriangle, color: 'text-destructive' },
  { key: 'newHires', label: 'New Hires', tooltip: 'Couriers whose names appeared for the first time today and were not present the previous day', icon: UserPlus, color: 'text-success' },
  { key: 'leavers', label: 'Leavers', tooltip: 'Couriers whose names were present yesterday and are missing today', icon: UserMinus, color: 'text-destructive' },
];

interface DetailPanel {
  title: string;
  tooltip: string;
  metricKey: keyof DayMetrics;
  date: string;
  names: { id: string; name: string; wh: string; status: string; value: string }[];
}

export default function OperationsMetrics({ data }: Props) {
  const [detailPanel, setDetailPanel] = useState<DetailPanel | null>(null);
  const [panelSearch, setPanelSearch] = useState('');
  const [panelFullscreen, setPanelFullscreen] = useState(false);

  const dates = useMemo(() => {
    const d = [...new Set(data.map(r => r.DATE))];
    d.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return d;
  }, [data]);

  const partnersByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    data.forEach(r => {
      if (!map.has(r.DATE)) map.set(r.DATE, new Set());
      map.get(r.DATE)!.add(r.PARTNER_ID);
    });
    return map;
  }, [data]);

  const partnerDetails = useMemo(() => {
    const map = new Map<string, { id: string; name: string; wh: string }>();
    data.forEach(r => {
      if (!map.has(r.PARTNER_ID)) map.set(r.PARTNER_ID, { id: r.PARTNER_ID, name: r.PARTNER_NAME, wh: r.TEAM_NAME });
    });
    return map;
  }, [data]);

  const rowsByDate = useMemo(() => {
    const map = new Map<string, SalaryRow[]>();
    data.forEach(r => {
      if (!map.has(r.DATE)) map.set(r.DATE, []);
      map.get(r.DATE)!.push(r);
    });
    return map;
  }, [data]);

  const metrics = useMemo(() => {
    const map = new Map<string, DayMetrics>();
    dates.forEach((date, idx) => {
      const dayRows = rowsByDate.get(date) || [];
      const todayPartners = partnersByDate.get(date) || new Set<string>();
      const prevDate = idx > 0 ? dates[idx - 1] : null;
      const prevPartners = prevDate ? (partnersByDate.get(prevDate) || new Set<string>()) : new Set<string>();

      const totalCapacity = todayPartners.size;
      const noShowCount = dayRows.filter(r => r.STATUS === 'NO_SHOW').length;
      const totalActive = totalCapacity - noShowCount;

      map.set(date, {
        totalCapacity,
        totalActive,
        activePercent: totalCapacity ? (totalActive / totalCapacity) * 100 : 0,
        checkedIn: dayRows.filter(r => r.STATUS === 'CHECKED_IN').length,
        late: dayRows.filter(r => r.STATUS === 'LATE').length,
        annualLeave: dayRows.filter(r => r.STATUS === 'Annual-Leave').length,
        sickLeave: dayRows.filter(r => r.STATUS === 'Sick-Leave').length,
        unpaidLeave: dayRows.filter(r => r.STATUS === 'Unpaid-Leave').length,
        noShow: noShowCount,
        newHires: [...todayPartners].filter(p => !prevPartners.has(p)).length,
        leavers: [...prevPartners].filter(p => !todayPartners.has(p)).length,
      });
    });
    return map;
  }, [data, dates, partnersByDate, rowsByDate]);

  const getPartnerList = (date: string, key: keyof DayMetrics): DetailPanel['names'] => {
    const dayRows = rowsByDate.get(date) || [];
    const todayPartners = partnersByDate.get(date) || new Set<string>();
    const idx = dates.indexOf(date);
    const prevDate = idx > 0 ? dates[idx - 1] : null;
    const prevPartners = prevDate ? (partnersByDate.get(prevDate) || new Set<string>()) : new Set<string>();

    let rows: SalaryRow[] = [];
    let ids: string[] = [];
    switch (key) {
      case 'totalCapacity': ids = [...todayPartners]; break;
      case 'totalActive': rows = dayRows.filter(r => r.STATUS !== 'NO_SHOW'); ids = rows.map(r => r.PARTNER_ID); break;
      case 'checkedIn': rows = dayRows.filter(r => r.STATUS === 'CHECKED_IN'); ids = rows.map(r => r.PARTNER_ID); break;
      case 'late': rows = dayRows.filter(r => r.STATUS === 'LATE'); ids = rows.map(r => r.PARTNER_ID); break;
      case 'annualLeave': rows = dayRows.filter(r => r.STATUS === 'Annual-Leave'); ids = rows.map(r => r.PARTNER_ID); break;
      case 'sickLeave': rows = dayRows.filter(r => r.STATUS === 'Sick-Leave'); ids = rows.map(r => r.PARTNER_ID); break;
      case 'unpaidLeave': rows = dayRows.filter(r => r.STATUS === 'Unpaid-Leave'); ids = rows.map(r => r.PARTNER_ID); break;
      case 'noShow': rows = dayRows.filter(r => r.STATUS === 'NO_SHOW'); ids = rows.map(r => r.PARTNER_ID); break;
      case 'newHires': ids = [...todayPartners].filter(p => !prevPartners.has(p)); break;
      case 'leavers': ids = [...prevPartners].filter(p => !todayPartners.has(p)); break;
      default: ids = [];
    }

    const dayRowMap = new Map<string, SalaryRow>();
    dayRows.forEach(r => dayRowMap.set(r.PARTNER_ID, r));

    const m = metrics.get(date);
    const metricVal = m ? m[key] : 0;
    const valStr = typeof metricVal === 'number' ? (key === 'activePercent' ? `${metricVal.toFixed(1)}%` : String(metricVal)) : String(metricVal);

    return [...new Set(ids)].map(id => {
      const detail = partnerDetails.get(id);
      const row = dayRowMap.get(id);
      return {
        id,
        name: detail?.name || id,
        wh: detail?.wh || '-',
        status: row?.STATUS || '-',
        value: valStr,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleCellClick = (date: string, key: keyof DayMetrics, label: string, tooltip: string) => {
    const names = getPartnerList(date, key);
    const dateLabel = new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    setDetailPanel({ title: `${label} - ${dateLabel}`, tooltip, metricKey: key, date, names });
    setPanelSearch('');
  };

  const exportPanelToExcel = () => {
    if (!detailPanel) return;
    const filtered = detailPanel.names.filter(n =>
      n.name.toLowerCase().includes(panelSearch.toLowerCase()) || n.id.includes(panelSearch)
    );
    exportToExcel(
      filtered.map(n => ({ 'Partner ID': n.id, 'Partner Name': n.name, 'Warehouse': n.wh, 'Status': n.status })),
      detailPanel.title
    );
  };

  const handleTableExport = () => {
    const rows: Record<string, unknown>[] = [];
    METRIC_CONFIG.forEach(({ key, label, isPercent }) => {
      const row: Record<string, unknown> = { Metric: label };
      dates.forEach(d => {
        const m = metrics.get(d);
        const val = m ? m[key] : 0;
        row[d] = isPercent ? `${(val as number).toFixed(1)}%` : val;
      });
      rows.push(row);
    });
    exportToExcel(rows, 'Operations_Metrics');
  };

  const latestDate = dates[dates.length - 1];
  const latestMetrics = latestDate ? metrics.get(latestDate) : null;
  const prevDate = dates.length > 1 ? dates[dates.length - 2] : null;
  const prevMetrics = prevDate ? metrics.get(prevDate) : null;

  const kpiCards: { key: keyof DayMetrics; label: string; icon: any; color: string }[] = [
    { key: 'totalCapacity', label: 'Total Capacity', icon: Users, color: 'text-primary' },
    { key: 'totalActive', label: 'Total Active', icon: Activity, color: 'text-success' },
    { key: 'noShow', label: 'NO_SHOW', icon: AlertTriangle, color: 'text-destructive' },
    { key: 'newHires', label: 'New Hires', icon: UserPlus, color: 'text-success' },
    { key: 'leavers', label: 'Leavers', icon: UserMinus, color: 'text-destructive' },
  ];

  const filteredPanelNames = detailPanel?.names.filter(n =>
    n.name.toLowerCase().includes(panelSearch.toLowerCase()) || n.id.includes(panelSearch)
  ) || [];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {latestMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {kpiCards.map(({ key, label, icon: Icon, color }) => {
              const val = latestMetrics[key];
              const prev = prevMetrics ? prevMetrics[key] : null;
              const diff = prev !== null ? (val as number) - (prev as number) : 0;
              return (
                <div key={key} className="metric-card cursor-pointer" onClick={() => latestDate && handleCellClick(latestDate, key, label, METRIC_CONFIG.find(m => m.key === key)?.tooltip || '')}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">{label}</span>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold">{key === 'activePercent' ? `${(val as number).toFixed(1)}%` : val}</span>
                    {diff !== 0 && (
                      <span className={`flex items-center text-xs font-medium ${diff > 0 ? 'text-success' : 'text-destructive'}`}>
                        {diff > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {Math.abs(diff)}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {latestDate && new Date(latestDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleTableExport}>
            <Download className="h-4 w-4 mr-1" /> Export Excel
          </Button>
        </div>

        <div className="border rounded-lg overflow-auto max-h-[60vh]">
          <table className="text-sm w-max min-w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="table-header-cell sticky left-0 z-20 min-w-[160px]">Metric</th>
                {dates.map(d => (
                  <th key={d} className="table-header-cell text-center min-w-[100px]">
                    {new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_CONFIG.map(({ key, label, tooltip, isPercent, icon: Icon, color }) => (
                <tr key={key} className="hover:bg-muted/50">
                  <td className="table-cell sticky left-0 bg-card z-10">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 font-medium cursor-help">
                          <Icon className={`h-3.5 w-3.5 ${color}`} />
                          {label}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[280px] text-right font-['Tajawal']" dir="rtl">
                        <p className="text-xs">{tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  {dates.map((d, idx) => {
                    const m = metrics.get(d);
                    const val = m ? m[key] : 0;
                    const prevM = idx > 0 ? metrics.get(dates[idx - 1]) : null;
                    const prevVal = prevM ? prevM[key] : null;
                    const diff = prevVal !== null ? (val as number) - (prevVal as number) : 0;

                    return (
                      <td
                        key={d}
                        className="table-cell text-center cursor-pointer hover:bg-primary/5 transition-colors"
                        onClick={() => handleCellClick(d, key, label, tooltip)}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center justify-center gap-1">
                              <span>{isPercent ? `${(val as number).toFixed(1)}%` : val}</span>
                              {diff !== 0 && (
                                <span className={`${diff > 0 ? 'text-success' : 'text-destructive'}`}>
                                  {diff > 0 ? <ArrowUp className="h-3 w-3 inline" /> : <ArrowDown className="h-3 w-3 inline" />}
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent dir="rtl" className="font-['Tajawal'] text-right">
                            <p className="text-xs">{tooltip}</p>
                            {diff !== 0 && <p className="text-xs mt-1">Change from yesterday: {diff > 0 ? '+' : ''}{isPercent ? diff.toFixed(1) + '%' : diff}</p>}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Sheet open={!!detailPanel} onOpenChange={open => { if (!open) { setDetailPanel(null); setPanelFullscreen(false); } }}>
          <SheetContent className={panelFullscreen ? "w-full sm:w-full sm:max-w-full" : "w-[600px] sm:w-[800px] sm:max-w-[800px]"}>
            <SheetHeader>
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg">{detailPanel?.title}</SheetTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPanelFullscreen(f => !f)} title={panelFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                  {panelFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground font-['Tajawal'] text-right" dir="rtl">{detailPanel?.tooltip}</p>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name or ID..."
                  value={panelSearch}
                  onChange={e => setPanelSearch(e.target.value)}
                  className="font-['Tajawal']"
                  dir="rtl"
                />
                <Button variant="outline" size="icon" onClick={exportPanelToExcel} title="Export Excel">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">{filteredPanelNames.length} couriers</div>
              <div className="max-h-[calc(100vh-220px)] overflow-auto">
                <table className="text-sm w-full">
                  <thead className="sticky top-0 bg-card">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">ID</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Warehouse</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPanelNames.map(n => (
                      <tr key={n.id} className="hover:bg-muted/50 border-b border-border">
                        <td className="px-3 py-2 font-medium whitespace-normal min-w-[200px]">{n.name}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{n.id}</td>
                        <td className="px-3 py-2 text-xs">{n.wh}</td>
                        <td className="px-3 py-2 text-xs">{n.status}</td>
                      </tr>
                    ))}
                    {filteredPanelNames.length === 0 && (
                      <tr><td colSpan={4} className="text-center text-muted-foreground py-8 text-sm">No results</td></tr>
                    )}
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
