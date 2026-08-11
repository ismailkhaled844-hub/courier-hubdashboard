import { useMemo, useState, Fragment } from 'react';
import { SalaryRow } from '@/lib/google-sheets';
import { exportToExcel } from '@/lib/export-excel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';

interface Props {
  data: SalaryRow[];
  allData: SalaryRow[];
}

export default function CourierDailyPerformance({ data, allData }: Props) {
  const [search, setSearch] = useState('');
  const [whFilter, setWhFilter] = useState('all');

  const warehouses = useMemo(() => [...new Set(data.map(r => r.TEAM_NAME))].filter(Boolean).sort(), [data]);

  const dates = useMemo(() => {
    const d = [...new Set(data.map(r => r.DATE))];
    d.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return d;
  }, [data]);

  const firstDate = dates[0] || null;

  const couriers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; wh: string }>();
    data.forEach(r => {
      if (!map.has(r.PARTNER_ID)) {
        map.set(r.PARTNER_ID, { id: r.PARTNER_ID, name: r.PARTNER_NAME, wh: r.TEAM_NAME });
      }
    });
    return [...map.values()];
  }, [data]);

  const dataMap = useMemo(() => {
    const m = new Map<string, SalaryRow>();
    data.forEach(r => m.set(`${r.PARTNER_ID}_${r.DATE}`, r));
    return m;
  }, [data]);

  // Build partner->dates map for hiring/leaving logic
  const partnerDates = useMemo(() => {
    const m = new Map<string, Set<string>>();
    data.forEach(r => {
      if (!m.has(r.PARTNER_ID)) m.set(r.PARTNER_ID, new Set());
      m.get(r.PARTNER_ID)!.add(r.DATE);
    });
    return m;
  }, [data]);

  // Hiring date: first date the courier appears, but ONLY if it's after the first date in the range
  // Leaving date: last date the courier appears, but ONLY if it's before the last date in the range
  const lastDate = dates[dates.length - 1] || null;

  const getHiringDate = (partnerId: string): string | null => {
    if (!firstDate || dates.length < 2) return null;
    const pDates = partnerDates.get(partnerId);
    if (!pDates) return null;
    // Check if courier was present on the first day
    if (pDates.has(firstDate)) return null;
    // Find first appearance
    for (const d of dates) {
      if (pDates.has(d)) return d;
    }
    return null;
  };

  const getLeavingDate = (partnerId: string): string | null => {
    if (!lastDate || dates.length < 2) return null;
    const pDates = partnerDates.get(partnerId);
    if (!pDates) return null;
    // Check if courier is present on the last day
    if (pDates.has(lastDate)) return null;
    // Find last appearance
    for (let i = dates.length - 1; i >= 0; i--) {
      if (pDates.has(dates[i])) return dates[i];
    }
    return null;
  };

  const filtered = useMemo(() => {
    return couriers
      .filter(c => {
        if (whFilter !== 'all' && c.wh !== whFilter) return false;
        if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.id.includes(search)) return false;
        return true;
      })
      .sort((a, b) => a.wh.localeCompare(b.wh));
  }, [couriers, search, whFilter]);

  const handleExport = () => {
    const rows: Record<string, unknown>[] = [];
    filtered.forEach(c => {
      const hiringDate = getHiringDate(c.id);
      const leavingDate = getLeavingDate(c.id);
      dates.forEach(d => {
        const row = dataMap.get(`${c.id}_${d}`);
        rows.push({
          'Partner ID': c.id,
          'Partner Name': c.name,
          'Warehouse': c.wh,
          'Hiring Date': hiringDate ? new Date(hiringDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
          'Leaving Date': leavingDate ? new Date(leavingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
          'Date': d,
          'Status': row?.STATUS || '-',
          'Orders': row?.DELIVERED_ORDERS || 0,
          'Weight': row?.DELIVERED_WEIGHT || 0,
          'Total Salary': row?.CALC_SALARY ? +row.CALC_SALARY.toFixed(2) : 0,
        });
      });
    });
    exportToExcel(rows, 'Courier_Daily_Performance');
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div className="space-y-2">
      <div className="flex gap-3 flex-wrap items-center">
        <Input
          placeholder="Search by name or ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <Select value={whFilter} onValueChange={setWhFilter}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="All Warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {warehouses.map(w => (
              <SelectItem key={w} value={w}>{w}</SelectItem>
            ))}
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
              <th rowSpan={2} className="table-header-cell sticky left-0 z-30 min-w-[80px]">ID</th>
              <th rowSpan={2} className="table-header-cell sticky left-[80px] z-30 min-w-[180px]">Name</th>
              <th rowSpan={2} className="table-header-cell sticky left-[260px] z-30 min-w-[120px]">Warehouse</th>
              <th rowSpan={2} className="table-header-cell sticky left-[380px] z-30 min-w-[100px]">Hiring Date</th>
              <th rowSpan={2} className="table-header-cell sticky left-[480px] z-30 min-w-[100px]">Leaving Date</th>
              {dates.map(d => (
                <th key={d} colSpan={4} className="table-header-cell text-center border-l border-primary-foreground/20">
                  {fmtDate(d)}
                </th>
              ))}
            </tr>
            <tr>
              {dates.map(d => (
                <Fragment key={d}>
                  <th className="table-subheader-cell border-l">Status</th>
                  <th className="table-subheader-cell">Orders</th>
                  <th className="table-subheader-cell">Weight</th>
                  <th className="table-subheader-cell">Salary</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const hiringDate = getHiringDate(c.id);
              const leavingDate = getLeavingDate(c.id);
              return (
                <tr key={c.id} className="hover:bg-muted/50">
                  <td className="table-cell sticky left-0 bg-card z-10 font-medium">{c.id}</td>
                  <td className="table-cell sticky left-[80px] bg-card z-10">{c.name}</td>
                  <td className="table-cell sticky left-[260px] bg-card z-10">{c.wh}</td>
                  <td className="table-cell sticky left-[380px] bg-card z-10 text-center">
                    {hiringDate ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/15 text-success">{fmtDate(hiringDate)}</span>
                    ) : '-'}
                  </td>
                  <td className="table-cell sticky left-[480px] bg-card z-10 text-center">
                    {leavingDate ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/15 text-destructive">{fmtDate(leavingDate)}</span>
                    ) : '-'}
                  </td>
                  {dates.map(d => {
                    const row = dataMap.get(`${c.id}_${d}`);
                    return (
                      <Fragment key={d}>
                        <td className="table-cell border-l">
                          <StatusBadge status={row?.STATUS} />
                        </td>
                        <td className="table-cell text-center">{row?.DELIVERED_ORDERS || '-'}</td>
                        <td className="table-cell text-center">{row?.DELIVERED_WEIGHT ? row.DELIVERED_WEIGHT.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '-'}</td>
                        <td className="table-cell text-center font-medium">{row?.CALC_SALARY ? row.CALC_SALARY.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '-'}</td>
                      </Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-muted-foreground">-</span>;
  const colors: Record<string, string> = {
    LATE: 'bg-warning/15 text-warning',
    OFF: 'bg-muted text-muted-foreground',
    CHECKED_IN: 'bg-success/15 text-success',
    SICK: 'bg-info/15 text-info',
    NO_SHOW: 'bg-destructive/15 text-destructive',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}
