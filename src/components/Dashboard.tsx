import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSalaryData, fetchReconData, fetchLastUpdateDates, fetchOnDemandData, fetchFleetOperationData, SalaryRow } from '@/lib/google-sheets';
import { exportToExcel } from '@/lib/export-excel';
import CourierDailyPerformance from './CourierDailyPerformance';
import CourierFinancialDetails from './CourierFinancialDetails';
import AnalyticsTab from './AnalyticsTab';
import MTDSummary from './MTDSummary';
import OperationsMetrics from './OperationsMetrics';
import HRDataMatcher from './HRDataMatcher';
import OnDemandRegional from './OnDemandRegional';
import RegionsManpowerSheet from './RegionsManpowerSheet';
import ManpowerPapers from './ManpowerPapers';
import CapacityTab from './CapacityTab';
import WarehousesPerformance from './WarehousesPerformance';
import OMSBreakdown, { OmsEmployee, OmsPayroll } from './OMSBreakdown';
import DateRangeFilter from './DateRangeFilter';
import { Loader2, TruckIcon, BarChart3, Users, PieChart, Maximize, Minimize, DollarSign, ClipboardCheck, ExternalLink, Clock, AlertTriangle, ShieldAlert, Download, ChevronDown, ChevronUp, Package, Radio, MapPin, FileSpreadsheet, RefreshCw, Wallet, Activity, FolderArchive, Home, ArrowRight, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';


type TabId = 'home' | 'daily' | 'financial' | 'mtd' | 'ops' | 'analytics' | 'hr' | 'ondemand' | 'helicopter' | 'ofd-live' | 'manpower' | 'papers' | 'oms' | 'capacity' | 'warehouses';

interface HomeChild { id: TabId; label: string; desc: string; icon: any }
interface HomeCard { id: string; title: string; desc: string; icon: any; tone: string; tab?: TabId; children?: HomeChild[] }

const HOME_CARDS: HomeCard[] = [
  {
    id: 'salary', title: 'Salary', desc: 'Courier salary & financial breakdown', icon: Wallet, tone: 'indigo',
    children: [
      { id: 'daily', label: 'Courier Daily', desc: 'Daily courier performance & salary', icon: Users },
      { id: 'financial', label: 'Financial Details', desc: 'Courier financial breakdown', icon: DollarSign },
    ],
  },
  {
    id: 'ops', title: 'Operations & Analytics', desc: 'Operational metrics, analytics & HR audit', icon: Activity, tone: 'emerald',
    children: [
      { id: 'mtd', label: 'MTD Summary', desc: 'Month-to-date operational summary', icon: BarChart3 },
      { id: 'ops', label: 'Operations', desc: 'Operations metrics per warehouse', icon: TruckIcon },
      { id: 'analytics', label: 'Analytics', desc: 'Charts and trend analysis', icon: PieChart },
      { id: 'hr', label: 'HR Audit', desc: 'Match HR payroll with salary data', icon: ClipboardCheck },
    ],
  },
  { id: 'ondemand', tab: 'ondemand', title: 'On Demand (GC)', desc: 'On demand regional breakdown', icon: Package, tone: 'amber' },
  { id: 'ofd-live', tab: 'ofd-live', title: 'OFD Live Tracking', desc: 'Live out-for-delivery tracking', icon: MapPin, tone: 'teal' },
  { id: 'helicopter', tab: 'helicopter', title: 'Helicopter View', desc: 'Fleet vision overview', icon: ExternalLink, tone: 'violet' },
  { id: 'manpower', tab: 'manpower', title: 'Manpower Sheet', desc: 'Regions manpower & uploaded papers', icon: FileSpreadsheet, tone: 'emerald' },
  { id: 'oms', tab: 'oms', title: 'OMS Breakdown', desc: 'Employees payroll breakdown', icon: Database, tone: 'indigo' },
  { id: 'warehouses', tab: 'warehouses', title: 'Warehouses', desc: 'Warehouse performance scoring', icon: TruckIcon, tone: 'teal' },
  { id: 'capacity', tab: 'capacity', title: 'Capacity', desc: 'Daily & monthly fleet capacity', icon: Activity, tone: 'rose' },
];

function findCardForTab(tab: TabId): HomeCard | undefined {
  return HOME_CARDS.find(c => c.tab === tab || c.children?.some(ch => ch.id === tab));
}

const TONES: Record<string, { card: string; iconWrap: string; icon: string; link: string }> = {
  indigo: { card: 'border-indigo-200 hover:border-indigo-400 hover:shadow-indigo-100', iconWrap: 'bg-indigo-100', icon: 'text-indigo-600', link: 'text-indigo-600' },
  emerald: { card: 'border-emerald-200 hover:border-emerald-400 hover:shadow-emerald-100', iconWrap: 'bg-emerald-100', icon: 'text-emerald-600', link: 'text-emerald-600' },
  amber: { card: 'border-amber-200 hover:border-amber-400 hover:shadow-amber-100', iconWrap: 'bg-amber-100', icon: 'text-amber-600', link: 'text-amber-600' },
  teal: { card: 'border-teal-200 hover:border-teal-400 hover:shadow-teal-100', iconWrap: 'bg-teal-100', icon: 'text-teal-600', link: 'text-teal-600' },
  violet: { card: 'border-violet-200 hover:border-violet-400 hover:shadow-violet-100', iconWrap: 'bg-violet-100', icon: 'text-violet-600', link: 'text-violet-600' },
  rose: { card: 'border-rose-200 hover:border-rose-400 hover:shadow-rose-100', iconWrap: 'bg-rose-100', icon: 'text-rose-600', link: 'text-rose-600' },
};

function getDefaultDateRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  // From: 21st of previous month
  const from = new Date(year, month - 1, 21);
  // To: 20th of current month
  const to = new Date(year, month, 20);
  return { from, to };
}

function parseDate(d: string): Date | null {
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t;
}

interface DataAlert {
  type: 'warning' | 'error';
  message: string;
  count: number;
  details: string[];
  records: { id: string; name: string; warehouse: string; date: string; status: string }[];
}

function detectDataAlerts(salaryData: SalaryRow[]): DataAlert[] {
  const alerts: DataAlert[] = [];
  
  const toRecord = (r: SalaryRow) => ({ id: r.PARTNER_ID, name: r.PARTNER_NAME, warehouse: r.TEAM_NAME || '-', date: r.DATE, status: r.STATUS || '-' });
  
  const noWarehouse = salaryData.filter(r => !r.TEAM_NAME || r.TEAM_NAME.trim() === '' || r.TEAM_NAME === '-');
  if (noWarehouse.length > 0) {
    const uniqueIds = new Set<string>();
    const recs = noWarehouse.filter(r => { if (uniqueIds.has(r.PARTNER_ID)) return false; uniqueIds.add(r.PARTNER_ID); return true; });
    alerts.push({ type: 'error', message: 'Couriers without a warehouse', count: recs.length, details: recs.slice(0, 5).map(r => r.PARTNER_NAME || r.PARTNER_ID), records: recs.map(toRecord) });
  }
  
  const noId = salaryData.filter(r => !r.PARTNER_ID || r.PARTNER_ID.trim() === '');
  if (noId.length > 0) {
    alerts.push({ type: 'error', message: 'Couriers without a partner ID', count: noId.length, details: noId.slice(0, 5).map(r => r.PARTNER_NAME || '(No name)'), records: noId.map(toRecord) });
  }
  
  const noName = salaryData.filter(r => !r.PARTNER_NAME || r.PARTNER_NAME.trim() === '');
  if (noName.length > 0) {
    const uniqueIds = new Set<string>();
    const recs = noName.filter(r => { if (uniqueIds.has(r.PARTNER_ID)) return false; uniqueIds.add(r.PARTNER_ID); return true; });
    alerts.push({ type: 'warning', message: 'Couriers without a name', count: recs.length, details: recs.slice(0, 5).map(r => r.PARTNER_ID), records: recs.map(toRecord) });
  }
  
  const zeroSalary = salaryData.filter(r => r.FIXED_SALARY === 0 && r.STATUS?.toLowerCase() !== 'absent');
  if (zeroSalary.length > 0) {
    const uniqueIds = new Set<string>();
    const recs = zeroSalary.filter(r => { if (uniqueIds.has(r.PARTNER_ID)) return false; uniqueIds.add(r.PARTNER_ID); return true; });
    alerts.push({ type: 'warning', message: 'Couriers with fixed salary = 0 (not absent)', count: recs.length, details: recs.slice(0, 5).map(r => r.PARTNER_NAME || r.PARTNER_ID), records: recs.map(toRecord) });
  }

  const duplicates = new Map<string, Set<string>>();
  salaryData.forEach(r => {
    if (!r.PARTNER_ID) return;
    const key = `${r.PARTNER_ID}_${r.DATE}`;
    if (!duplicates.has(key)) duplicates.set(key, new Set());
    duplicates.get(key)!.add(r.TEAM_NAME);
  });
  const multiWh = [...duplicates.entries()].filter(([, whs]) => whs.size > 1);
  if (multiWh.length > 0) {
    const ids = [...new Set(multiWh.map(([k]) => k.split('_')[0]))];
    const recs = ids.map(id => {
      const r = salaryData.find(s => s.PARTNER_ID === id);
      return { id, name: r?.PARTNER_NAME || '', warehouse: '(Multiple)', date: '-', status: '-' };
    });
    alerts.push({ type: 'warning', message: 'Couriers logged in more than one warehouse on the same day', count: multiWh.length, details: ids.slice(0, 5), records: recs });
  }

  return alerts;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const defaults = getDefaultDateRange();
  const [fromDate, setFromDate] = useState<Date | undefined>(defaults.from);
  const [toDate, setToDate] = useState<Date | undefined>(defaults.to);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const activeCard = useMemo(() => (activeTab === 'home' ? undefined : findCardForTab(activeTab)), [activeTab]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Keep the fullscreen icon in sync with the real browser state
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Auto fullscreen: browsers require a user gesture, so trigger on the first interaction
  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      cleanup();
    };
    const cleanup = () => {
      document.removeEventListener('pointerdown', go);
      document.removeEventListener('keydown', go);
    };
    document.documentElement.requestFullscreen?.().catch(() => {
      document.addEventListener('pointerdown', go);
      document.addEventListener('keydown', go);
    });
    return cleanup;
  }, []);


  const { data: salaryData, isLoading: salaryLoading, error: salaryError } = useQuery({
    queryKey: ['salary-data'],
    queryFn: fetchSalaryData,
    staleTime: 0,
    refetchInterval: 30000,
  });

  const { data: reconData, isLoading: reconLoading } = useQuery({
    queryKey: ['recon-data'],
    queryFn: fetchReconData,
    staleTime: 0,
    refetchInterval: 30000,
  });

  const { data: lastUpdates } = useQuery({
    queryKey: ['last-updates'],
    queryFn: fetchLastUpdateDates,
    staleTime: 0,
    refetchInterval: 30000,
  });

  const { data: onDemandData, isLoading: onDemandLoading } = useQuery({
    queryKey: ['ondemand-data'],
    queryFn: fetchOnDemandData,
    staleTime: 0,
    refetchInterval: 30000,
  });

  const { data: fleetOpData } = useQuery({
    queryKey: ['fleet-op-data'],
    queryFn: fetchFleetOperationData,
    staleTime: 0,
    refetchInterval: 30000,
  });

  const { data: omsEmployees, isLoading: omsEmployeesLoading, refetch: refetchOmsEmployees } = useQuery({
    queryKey: ['oms-employees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('oms_employees').select('*').order('created_at', { ascending: false }).limit(50000);
      if (error) throw error;
      return data as OmsEmployee[];
    },
    staleTime: 300000, // 5 minutes
  });

  const { data: omsPayroll, isLoading: omsPayrollLoading, refetch: refetchOmsPayroll } = useQuery({
    queryKey: ['oms-payroll'],
    queryFn: async () => {
      const { data, error } = await supabase.from('oms_payroll').select('*').limit(50000);
      if (error) throw error;
      return data as OmsPayroll[];
    },
    staleTime: 300000, // 5 minutes
  });

  const omsPayrollMap = useMemo(() => {
    const m = new Map<string, OmsPayroll>();
    (omsPayroll || []).forEach(r => { if (r.national_id) m.set(String(r.national_id).trim(), r as OmsPayroll); });
    return m;
  }, [omsPayroll]);

  const isLoading = salaryLoading || reconLoading || onDemandLoading;

  const filteredSalary = useMemo(() => {
    if (!salaryData) return [];
    return salaryData.filter(r => {
      const d = parseDate(r.DATE);
      if (!d) return false;
      if (fromDate) { const from = new Date(fromDate); from.setHours(0,0,0,0); if (d < from) return false; }
      if (toDate) { const to = new Date(toDate); to.setHours(23,59,59,999); if (d > to) return false; }
      return true;
    });
  }, [salaryData, fromDate, toDate]);

  const filteredRecon = useMemo(() => {
    if (!reconData) return [];
    return reconData.filter(r => {
      const dateStr = r._col5 || '';
      const d = parseDate(dateStr);
      if (!d) return true;
      if (fromDate) { const from = new Date(fromDate); from.setHours(0,0,0,0); if (d < from) return false; }
      if (toDate) { const to = new Date(toDate); to.setHours(23,59,59,999); if (d > to) return false; }
      return true;
    });
  }, [reconData, fromDate, toDate]);

  const dataAlerts = useMemo(() => {
    if (!filteredSalary.length) return [];
    return detectDataAlerts(filteredSalary);
  }, [filteredSalary]);

  const showReconUpdate = activeTab === 'financial' || activeTab === 'mtd';

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-40">
        <div className="w-full px-4 py-2 flex items-center gap-3">
          <div className="bg-primary rounded-lg p-1.5">
            <TruckIcon className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">Logistics Control Tower</h1>
            {lastUpdates && (
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Salary: {lastUpdates.salaryLastUpdate}
                </span>
                {showReconUpdate && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Recon: {lastUpdates.reconLastUpdate}
                  </span>
                )}
              </div>
            )}
          </div>
          {activeTab !== 'home' && (
            <Button variant="outline" size="sm" className="icon-btn h-9 px-3 gap-1.5 font-semibold" onClick={() => setActiveTab('home')} title="Home">
              <Home className="h-4 w-4" />
              Home
            </Button>
          )}
          <div className="mr-auto" />

          {activeTab !== 'home' && activeTab !== 'helicopter' && activeTab !== 'ofd-live' && (
            <DateRangeFilter fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} />
          )}
          {dataAlerts.length > 0 && activeTab !== 'home' && activeTab !== 'helicopter' && activeTab !== 'ofd-live' && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 relative border-destructive/50">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                  <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[9px]">
                    {dataAlerts.length}
                  </Badge>
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
                <SheetHeader>
                  <div className="flex items-center justify-between">
                    <SheetTitle className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-destructive" />
                      Data Quality Alerts ({dataAlerts.length})
                    </SheetTitle>
                    <Button variant="outline" size="sm" onClick={() => {
                      const allRecords = dataAlerts.flatMap(a => a.records.map(r => ({ 'Alert Type': a.message, 'ID': r.id, 'Name': r.name, 'Warehouse': r.warehouse, 'Date': r.date, 'Status': r.status })));
                      exportToExcel(allRecords, 'Data_Quality_Alerts');
                    }}>
                      <Download className="h-4 w-4 mr-1" /> Export All
                    </Button>
                  </div>
                </SheetHeader>
                <div className="space-y-3 mt-4">
                  {dataAlerts.map(alert => {
                    const isExpanded = expandedAlert === alert.message;
                    return (
                      <div key={alert.message} className={`rounded-lg border ${alert.type === 'error' ? 'border-destructive/50 bg-destructive/5' : 'border-amber-300/50 bg-amber-50/50'}`}>
                        <div className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <AlertTriangle className={`h-4 w-4 ${alert.type === 'error' ? 'text-destructive' : 'text-amber-500'}`} />
                              {alert.message} ({alert.count})
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => {
                                exportToExcel(alert.records.map(r => ({ 'ID': r.id, 'Name': r.name, 'Warehouse': r.warehouse, 'Date': r.date, 'Status': r.status })), `Alert_${alert.message}`);
                              }}>
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setExpandedAlert(isExpanded ? null : alert.message)}>
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Examples: {alert.details.join(', ')}{alert.count > 5 ? '...' : ''}
                          </p>
                        </div>
                        {isExpanded && (
                          <div className="border-t px-3 pb-3 pt-2 max-h-[300px] overflow-auto">
                            <table className="text-xs w-full">
                              <thead>
                                <tr>
                                  <th className="text-left px-2 py-1 font-semibold text-muted-foreground">Name</th>
                                  <th className="text-left px-2 py-1 font-semibold text-muted-foreground">ID</th>
                                  <th className="text-left px-2 py-1 font-semibold text-muted-foreground">Warehouse</th>
                                </tr>
                              </thead>
                              <tbody>
                                {alert.records.map((r, i) => (
                                  <tr key={i} className="hover:bg-muted/50 border-b border-border/50">
                                    <td className="px-2 py-1">{r.name || '-'}</td>
                                    <td className="px-2 py-1 text-muted-foreground">{r.id || '-'}</td>
                                    <td className="px-2 py-1">{r.warehouse}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          )}
          <Button variant="default" size="sm" className="icon-btn h-9 px-3 gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            Update
          </Button>
          <Button variant="outline" size="icon" className="icon-btn h-9 w-9" onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
        {activeTab !== 'home' && activeCard?.children && activeCard.children.length > 1 && (
          <div className="w-full px-4">
            <nav className="flex overflow-x-auto items-center gap-1.5 py-1.5">
              {activeCard.children.map(child => {
                const Icon = child.icon;
                const isActive = activeTab === child.id;
                return (
                  <button
                    key={child.id}
                    onClick={() => setActiveTab(child.id)}
                    className={`icon-btn flex items-center gap-1.5 py-1.5 px-3 text-xs rounded-full font-semibold transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/70 border'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {child.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </header>




      <main className="w-full px-4 py-3">
        {activeTab === 'home' ? (
          <section className="max-w-6xl mx-auto py-10">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-foreground">Logistics Control Tower</h2>
              <p className="text-sm text-muted-foreground mt-2">Select the section you want to open</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {HOME_CARDS.map(card => {
                const Icon = card.icon;
                const tone = TONES[card.tone];
                const isOpen = openCard === card.id;
                return (
                  <div
                    key={card.id}
                    className={`bg-card rounded-xl border-2 p-6 shadow-sm transition-all ${tone.card} ${isOpen ? 'sm:col-span-2 lg:col-span-1' : 'hover:shadow-lg hover:-translate-y-0.5'}`}
                  >
                    <button
                      className="text-left w-full"
                      onClick={() => card.children ? setOpenCard(isOpen ? null : card.id) : setActiveTab(card.tab!)}
                    >
                      <div className={`h-14 w-14 rounded-xl flex items-center justify-center mb-4 ${tone.iconWrap}`}>
                        <Icon className={`h-7 w-7 ${tone.icon}`} />
                      </div>
                      <h3 className="text-base font-bold text-foreground">{card.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{card.desc}</p>
                      <span className={`mt-4 inline-flex items-center gap-1 text-xs font-semibold ${tone.link}`}>
                        {card.children ? (
                          <>
                            {isOpen ? 'Hide' : `${card.children.length} sections`}
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </>
                        ) : (
                          <>Open <ArrowRight className="h-3.5 w-3.5" /></>
                        )}
                      </span>
                    </button>
                    {isOpen && card.children && (
                      <div className="mt-4 pt-4 border-t space-y-1.5 animate-in fade-in slide-in-from-top-1">
                        {card.children.map(child => {
                          const ChildIcon = child.icon;
                          return (
                            <button
                              key={child.id}
                              onClick={() => setActiveTab(child.id)}
                              className="w-full text-left flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors"
                            >
                              <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${tone.iconWrap}`}>
                                <ChildIcon className={`h-4 w-4 ${tone.icon}`} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-foreground">{child.label}</span>
                                <span className="block text-[11px] text-muted-foreground truncate">{child.desc}</span>
                              </span>
                              <ArrowRight className={`h-4 w-4 ml-auto shrink-0 ${tone.link}`} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : activeTab === 'helicopter' ? (
          <div className="h-[calc(100vh-100px)] w-full rounded-lg overflow-hidden border">
            <iframe src="https://fleet-vision-sheets.lovable.app/" className="w-full h-full border-0" title="Helicopter View" allow="fullscreen" />
          </div>
        ) : activeTab === 'ofd-live' ? (
          <div className="h-[calc(100vh-100px)] w-full rounded-lg overflow-hidden border">
            <iframe src="https://google-sheet-logistics-hub.lovable.app/" className="w-full h-full border-0" title="OFD Live Tracking" allow="fullscreen" />
          </div>
        ) : activeTab === 'manpower' ? (
          <div className="min-h-[800px] h-[calc(100vh-100px)] w-full rounded-lg overflow-hidden border shadow-sm">
            <RegionsManpowerSheet />
          </div>
        ) : activeTab === 'oms' ? (
          <div className="min-h-[800px] h-[calc(100vh-100px)] w-full rounded-lg overflow-hidden border shadow-sm">
            <OMSBreakdown 
              initialEmployees={omsEmployees || []} 
              initialPayrollMap={omsPayrollMap}
              isLoading={omsEmployeesLoading || omsPayrollLoading}
              onRefresh={async () => {
                await Promise.all([refetchOmsEmployees(), refetchOmsPayroll()]);
              }}
            />
          </div>
        ) : activeTab === 'capacity' ? (
          <CapacityTab />
        ) : activeTab === 'warehouses' ? (
          <WarehousesPerformance salaryData={salaryData || []} reconData={reconData || []} onDemandData={onDemandData || []} fleetOpData={fleetOpData || []} />
        ) : (
          <>
            {activeTab === 'daily' && <CourierDailyPerformance data={filteredSalary} allData={salaryData || []} />}
            {activeTab === 'financial' && <CourierFinancialDetails salaryData={filteredSalary} reconData={filteredRecon} allData={salaryData || []} />}
            {activeTab === 'mtd' && <MTDSummary salaryData={filteredSalary} reconData={filteredRecon} />}
            {activeTab === 'ops' && <OperationsMetrics data={filteredSalary} allData={salaryData || []} />}
            {activeTab === 'analytics' && <AnalyticsTab data={filteredSalary} />}
            {activeTab === 'ondemand' && <OnDemandRegional data={onDemandData || []} fromDate={fromDate} toDate={toDate} />}
            {activeTab === 'hr' && <HRDataMatcher salaryData={filteredSalary} />}
          </>
        )}
      </main>
    </div>
  );
}
