import { useMemo } from 'react';
import { SalaryRow } from '@/lib/google-sheets';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area,
} from 'recharts';

interface Props {
  data: SalaryRow[];
}

const COLORS = [
  'hsl(210, 78%, 40%)',
  'hsl(142, 60%, 40%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(168, 60%, 42%)',
  'hsl(210, 78%, 60%)',
  'hsl(280, 60%, 50%)',
  'hsl(30, 80%, 50%)',
];

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function AnalyticsTab({ data }: Props) {
  const whSalaryData = useMemo(() => {
    const map = new Map<string, { wh: string; fixedSalary: number; extraShift: number; variables: number; deductions: number; totalSalary: number; couriers: Set<string> }>();
    data.forEach(r => {
      if (!r.TEAM_NAME) return;
      if (!map.has(r.TEAM_NAME)) map.set(r.TEAM_NAME, { wh: r.TEAM_NAME, fixedSalary: 0, extraShift: 0, variables: 0, deductions: 0, totalSalary: 0, couriers: new Set() });
      const m = map.get(r.TEAM_NAME)!;
      m.fixedSalary += r.FIXED_SALARY;
      m.extraShift += r.EXTRA_SHIFT_VALUE;
      m.variables += r.VARIABLES;
      m.deductions += r.DEDUCTIONS;
      m.totalSalary += r.TOTAL_SALARIES;
      m.couriers.add(r.PARTNER_ID);
    });
    return [...map.values()].map(m => ({
      wh: m.wh,
      fixedSalary: Math.round(m.fixedSalary),
      extraShift: Math.round(m.extraShift),
      variables: Math.round(m.variables),
      deductions: Math.round(m.deductions),
      totalSalary: Math.round(m.totalSalary),
      couriers: m.couriers.size,
    })).sort((a, b) => b.totalSalary - a.totalSalary);
  }, [data]);

  const dailySalaryTrend = useMemo(() => {
    const map = new Map<string, { date: string; totalSalary: number; fixedSalary: number; variables: number; deductions: number }>();
    data.forEach(r => {
      if (!r.DATE) return;
      if (!map.has(r.DATE)) map.set(r.DATE, { date: r.DATE, totalSalary: 0, fixedSalary: 0, variables: 0, deductions: 0 });
      const m = map.get(r.DATE)!;
      m.totalSalary += r.TOTAL_SALARIES;
      m.fixedSalary += r.FIXED_SALARY;
      m.variables += r.VARIABLES;
      m.deductions += r.DEDUCTIONS;
    });
    return [...map.values()]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(m => ({
        date: new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        totalSalary: Math.round(m.totalSalary),
        fixedSalary: Math.round(m.fixedSalary),
        variables: Math.round(m.variables),
        deductions: Math.round(m.deductions),
      }));
  }, [data]);

  const salaryComposition = useMemo(() => {
    let fixed = 0, extra = 0, vars = 0, ded = 0, offsetD = 0, offsetR = 0;
    data.forEach(r => {
      fixed += r.FIXED_SALARY;
      extra += r.EXTRA_SHIFT_VALUE;
      vars += r.VARIABLES;
      ded += r.DEDUCTIONS;
      offsetD += r.OFFSET_DEDUCTION;
      offsetR += r.OFFSET_RAISE;
    });
    return [
      { name: 'Fixed Salary', value: Math.round(fixed) },
      { name: 'Extra Shift', value: Math.round(extra) },
      { name: 'Variables', value: Math.round(vars) },
      { name: 'Deductions', value: Math.round(Math.abs(ded)) },
      { name: 'Offset Deduction', value: Math.round(Math.abs(offsetD)) },
      { name: 'Offset Raise', value: Math.round(offsetR) },
    ].filter(i => i.value > 0);
  }, [data]);

  const avgSalaryPerCourier = useMemo(() => {
    return whSalaryData.map(w => ({
      wh: w.wh.length > 15 ? w.wh.slice(0, 15) + '…' : w.wh,
      avgSalary: w.couriers > 0 ? Math.round(w.totalSalary / w.couriers) : 0,
      couriers: w.couriers,
    })).sort((a, b) => b.avgSalary - a.avgSalary);
  }, [whSalaryData]);

  const kpis = useMemo(() => {
    const totalSalary = data.reduce((s, r) => s + r.TOTAL_SALARIES, 0);
    const totalFixed = data.reduce((s, r) => s + r.FIXED_SALARY, 0);
    const totalVars = data.reduce((s, r) => s + r.VARIABLES, 0);
    const totalDed = data.reduce((s, r) => s + r.DEDUCTIONS, 0);
    const totalExtra = data.reduce((s, r) => s + r.EXTRA_SHIFT_VALUE, 0);
    const uniqueCouriers = new Set(data.map(r => r.PARTNER_ID)).size;
    return { totalSalary, totalFixed, totalVars, totalDed, totalExtra, uniqueCouriers };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Salaries', value: fmt(kpis.totalSalary), tooltip: 'Fixed salary + (Orders × 5) + (Total Weight × 0.05)' },
          { label: 'Fixed Salary', value: fmt(kpis.totalFixed) },
          { label: 'Variables', value: fmt(kpis.totalVars) },
          { label: 'Deductions', value: fmt(Math.abs(kpis.totalDed)) },
          { label: 'Extra Shift', value: fmt(kpis.totalExtra) },
          { label: 'Couriers', value: kpis.uniqueCouriers.toString() },
        ].map(kpi => (
          <div key={kpi.label} className="metric-card" title={('tooltip' in kpi && kpi.tooltip) ? kpi.tooltip as string : undefined}>
            <span className="text-xs text-muted-foreground">{kpi.label}</span>
            <span className="text-xl font-bold">{kpi.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="dashboard-card">
          <h3 className="text-sm font-semibold mb-4">Daily Salary Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={dailySalaryTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 15%, 90%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="fixedSalary" name="Fixed" fill="hsl(210, 78%, 40%)" fillOpacity={0.1} stroke="hsl(210, 78%, 40%)" />
              <Line type="monotone" dataKey="totalSalary" name="Total" stroke="hsl(142, 60%, 40%)" strokeWidth={2} dot={false} />
              <Bar dataKey="deductions" name="Deductions" fill="hsl(0, 72%, 51%)" opacity={0.6} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card">
          <h3 className="text-sm font-semibold mb-4">Salary Composition</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={salaryComposition} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {salaryComposition.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card">
          <h3 className="text-sm font-semibold mb-4">Total Salary by Warehouse</h3>
          <ResponsiveContainer width="100%" height={Math.max(300, whSalaryData.length * 35)}>
            <BarChart data={whSalaryData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 15%, 90%)" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="wh" tick={{ fontSize: 10 }} width={120} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="fixedSalary" name="Fixed" stackId="a" fill={COLORS[0]} />
              <Bar dataKey="extraShift" name="Extra" stackId="a" fill={COLORS[1]} />
              <Bar dataKey="variables" name="Variables" stackId="a" fill={COLORS[2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card">
          <h3 className="text-sm font-semibold mb-4">Avg Salary per Courier</h3>
          <ResponsiveContainer width="100%" height={Math.max(300, avgSalaryPerCourier.length * 35)}>
            <BarChart data={avgSalaryPerCourier} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 15%, 90%)" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="wh" tick={{ fontSize: 10 }} width={120} />
              <Tooltip formatter={(v: number) => fmt(v)} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-popover border rounded-md p-2 text-xs shadow-md">
                    <p className="font-semibold">{d.wh}</p>
                    <p>Avg Salary: {fmt(d.avgSalary)}</p>
                    <p>Couriers: {d.couriers}</p>
                  </div>
                );
              }} />
              <Bar dataKey="avgSalary" name="Avg Salary" fill={COLORS[4]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
