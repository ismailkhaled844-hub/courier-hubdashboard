const SHEET_ID = '1fJASfwdDTamshrR6VIhrZ78vq61Voiq3577CWG7XutA';
const FLEET_SHEET_ID = '1ugH9TpcOY5szYVsEekIoAPjscS-YoF8F46wRrMa_c_M';

function csvToArray(csv: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"' && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || (ch === '\r' && csv[i + 1] === '\n')) {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = '';
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }
  if (current || row.length) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

export interface SalaryRow {
  PARTNER_ID: string;
  MAXAB_ID: string;
  TEAM_NAME: string;
  DATE: string;
  PARTNER_NAME: string;
  PAYMENT_POLICY_ID: string;
  PAYMENT_POLICY_NAME: string;
  EXTRA_SHIFT: string;
  STATUS: string;
  SHIFT: string;
  FIXED_SALARY: number;
  EXTRA_SHIFT_VALUE: number;
  VARIABLES: number;
  DEDUCTIONS: number;
  OFFSET_DEDUCTION: number;
  OFFSET_RAISE: number;
  DELIVERED_ORDERS: number;
  DELIVERED_WEIGHT: number;
  TOTAL_SALARIES: number;
  CALC_SALARY: number;
}

const TEAM_NAME_MAP: Record<string, string> = {
  'El-Mahala': 'El Mahala',
  'Khorshed Alex': 'khorshed_Alex',
};

// Warehouses that must be merged into a single canonical name
const MERGED_WAREHOUSES: { match: string[]; name: string }[] = [
  { match: ['sakkarah', 'sakarah', 'al mansouriah', 'almansouriah', 'al mansourya', 'mansourya'], name: 'Al Mansourya - Giza' },
];

export function normalizeWarehouse(name: string): string {
  const raw = (name || '').trim();
  if (!raw) return raw;
  const lower = raw.toLowerCase();
  for (const m of MERGED_WAREHOUSES) {
    if (m.match.some(k => lower.includes(k))) return m.name;
  }
  return raw;
}

function cleanTeamName(name: string): string {
  return normalizeWarehouse(TEAM_NAME_MAP[name] || name);
}


export interface ReconRow {
  [key: string]: string;
}

export interface FleetOpRow {
  WAREHOUSE: string;
  DELIVERY_DATE: string;
  TRIP_TIME_HRS: number;
  OFD_VALUE: number;
  NMV: number;
  OFD_ORDERS: number;
  WEIGHT: number;
}

async function fetchSheet(sheetName: string, sheetId: string = SHEET_ID): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${sheetName}`);
  const text = await res.text();
  return csvToArray(text);
}

export async function fetchFleetOperationData(): Promise<FleetOpRow[]> {
  const rows = await fetchSheet('Fleet operation', FLEET_SHEET_ID);
  if (rows.length < 2) return [];
  const num = (s: any) => {
    if (typeof s === 'number') return isNaN(s) || !isFinite(s) ? 0 : s;
    const cleaned = String(s || '').replace(/,/g, '').replace(/%/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
  };
  return rows.slice(1).filter(r => r.length > 5 && r[5]).map(r => ({
    WAREHOUSE: normalizeWarehouse((r[5] || '').trim()),
    DELIVERY_DATE: r[6] || '',
    TRIP_TIME_HRS: num(r[15]),
    OFD_VALUE: num(r[18]),
    NMV: num(r[19]),
    OFD_ORDERS: num(r[23]),
    WEIGHT: num(r[30]),
  }));
}

const DEFICITS_SHEET_ID = '1qUyusVJXcXJHE3WJIQybh7k2tK96YHt-dKrysmY03sA';

export interface PendingRow {
  CREATED_AT: string;
  PENDING_VALUE: number;
  WAREHOUSE: string;
  LIABILITY_ON: string;
}

export async function fetchPendingData(): Promise<PendingRow[]> {
  const rows = await fetchSheet('Pending', DEFICITS_SHEET_ID);
  if (rows.length < 2) return [];
  const num = (s: any) => {
    if (typeof s === 'number') return isNaN(s) || !isFinite(s) ? 0 : s;
    const cleaned = String(s || '').replace(/,/g, '').replace(/%/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
  };
  return rows.slice(1).filter(r => r.length > 8 && r[8]).map(r => ({
    CREATED_AT: r[1] || '',
    PENDING_VALUE: num(r[7]),
    WAREHOUSE: normalizeWarehouse((r[8] || '').trim()),
    LIABILITY_ON: (r[15] || '').trim(),
  }));
}

export interface DamageRow {
  CREATED_AT: string;
  DAMAGE_VALUE: number;
  WAREHOUSE: string;
  LIABILITY_ON: string;
}

export async function fetchDamageData(): Promise<DamageRow[]> {
  const rows = await fetchSheet('Damage', DEFICITS_SHEET_ID);
  if (rows.length < 2) return [];
  const num = (s: any) => {
    if (typeof s === 'number') return isNaN(s) || !isFinite(s) ? 0 : s;
    const cleaned = String(s || '').replace(/,/g, '').replace(/%/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
  };
  return rows.slice(1).filter(r => r.length > 16 && r[16]).map(r => ({
    CREATED_AT: r[1] || '',
    DAMAGE_VALUE: num(r[10]),
    WAREHOUSE: normalizeWarehouse((r[16] || '').trim()),
    LIABILITY_ON: (r[24] || '').trim(),
  }));
}

export interface ExtraRow {
  EXTRA_CREATION_DATE: string;
  EXTRA_VALUE: number;
  WAREHOUSE: string;
  PRODUCT_LIABILITY_TYPE: string;
}

export async function fetchExtraData(): Promise<ExtraRow[]> {
  const rows = await fetchSheet('Extra', DEFICITS_SHEET_ID);
  if (rows.length < 2) return [];
  const num = (s: any) => {
    if (typeof s === 'number') return isNaN(s) || !isFinite(s) ? 0 : s;
    const cleaned = String(s || '').replace(/,/g, '').replace(/%/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
  };
  return rows.slice(1).filter(r => r.length > 2 && r[2]).map(r => ({
    EXTRA_CREATION_DATE: r[1] || '',
    WAREHOUSE: normalizeWarehouse((r[2] || '').trim()),
    PRODUCT_LIABILITY_TYPE: (r[14] || '').trim(),
    EXTRA_VALUE: num(r[32]),
  }));
}

const TICKETS_SHEET_ID = '1MQYW6R9LSPXZ7RyCHYAxUJMtQIZ-3Kmk2xOorVSci6A';

export interface TicketRow {
  TICKET_ID: string;
  STATUS: string;
  CREATED_AT: string;
  DAT: string;
  CONTACT_REASON: string;
  SUB_CONTACT_REASON: string;
  TICKET_COMMENT: string;
  PRODUCT_NAME: string;
  SALES_ORDER_ID: string;
  WAREHOUSE: string;
  DRIVER_NAME: string;
}

export async function fetchTicketsData(): Promise<TicketRow[]> {
  const rows = await fetchSheet('Ecommerce Max Support Tickets', TICKETS_SHEET_ID);
  if (rows.length < 2) return [];
  return rows.slice(1).filter(r => r.length > 20 && r[20]).map(r => ({
    TICKET_ID: r[0] || '',
    STATUS: r[1] || '',
    CREATED_AT: r[2] || '',
    DAT: r[3] || '',
    CONTACT_REASON: r[4] || '',
    SUB_CONTACT_REASON: r[5] || '',
    TICKET_COMMENT: r[6] || '',
    PRODUCT_NAME: r[7] || '',
    SALES_ORDER_ID: r[8] || '',
    WAREHOUSE: normalizeWarehouse((r[20] || '').trim()),
    DRIVER_NAME: r[21] || '',
  }));
}

export async function fetchLastUpdateDates(): Promise<{ salaryLastUpdate: string; reconLastUpdate: string }> {
  const [salaryRows, reconRows] = await Promise.all([
    fetchSheet('Logistics Salary'),
    fetchSheet('Detailed recon runsheet view'),
  ]);
  // Salary: MAX date from column D (index 3)
  let salaryLastUpdate = '';
  if (salaryRows.length > 1) {
    let maxDate: Date | null = null;
    let maxDateStr = '';
    for (let i = 1; i < salaryRows.length; i++) {
      const val = (salaryRows[i][3] || '').trim();
      if (!val) continue;
      const d = new Date(val);
      if (!isNaN(d.getTime()) && (!maxDate || d > maxDate)) {
        maxDate = d;
        maxDateStr = val;
      }
    }
    salaryLastUpdate = maxDateStr;
  }
  // Recon: MAX date from column F (index 5)
  let reconLastUpdate = '';
  if (reconRows.length > 1) {
    let maxDate: Date | null = null;
    let maxDateStr = '';
    for (let i = 1; i < reconRows.length; i++) {
      const val = (reconRows[i][5] || '').trim();
      if (!val) continue;
      const d = new Date(val);
      if (!isNaN(d.getTime()) && (!maxDate || d > maxDate)) {
        maxDate = d;
        maxDateStr = val;
      }
    }
    reconLastUpdate = maxDateStr;
  }
  return { salaryLastUpdate, reconLastUpdate };
}

export async function fetchSalaryData(): Promise<SalaryRow[]> {
  const rows = await fetchSheet('Logistics Salary');
  if (rows.length < 2) return [];
  const headers = rows[0];
  const num = (s: string) => parseFloat((s || '').replace(/,/g, '')) || 0;
  // Column 17 header may be corrupted in the sheet; use positional access for DELIVERED_WEIGHT
  const weightColIdx = 17;
  return rows.slice(1).filter(r => r.length > 1 && r[0]).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = r[i] || ''; });
    const fixedSalary = num(obj.FIXED_SALARY);
    const deliveredOrders = num(obj.DELIVERED_ORDERS);
    const deliveredWeight = num(r[weightColIdx] || '');
    return {
      PARTNER_ID: obj.PARTNER_ID || '',
      MAXAB_ID: obj.MAXAB_ID || '',
      TEAM_NAME: cleanTeamName((obj.TEAM_NAME || '').trim()),
      DATE: obj.DATE || '',
      PARTNER_NAME: obj.PARTNER_NAME || '',
      PAYMENT_POLICY_ID: obj.PAYMENT_POLICY_ID || '',
      PAYMENT_POLICY_NAME: obj.PAYMENT_POLICY_NAME || '',
      EXTRA_SHIFT: obj.EXTRA_SHIFT || '',
      STATUS: obj.STATUS || '',
      SHIFT: obj.SHIFT || '',
      FIXED_SALARY: fixedSalary,
      EXTRA_SHIFT_VALUE: num(obj.EXTRA_SHIFT_VALUE),
      VARIABLES: num(obj.VARIABLES),
      DEDUCTIONS: num(obj.DEDUCTIONS),
      OFFSET_DEDUCTION: num(obj.OFFSET_DEDUCTION),
      OFFSET_RAISE: num(obj.OFFSET_RAISE),
      DELIVERED_ORDERS: deliveredOrders,
      DELIVERED_WEIGHT: deliveredWeight,
      TOTAL_SALARIES: num(obj.TOTAL_SALARIES),
      CALC_SALARY: fixedSalary + (deliveredOrders * 5) + (deliveredWeight * 0.05),
    };
  });
}

export async function fetchReconData(): Promise<ReconRow[]> {
  const rows = await fetchSheet('Detailed recon runsheet view');
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => r.length > 1).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = r[i] || ''; });
    // Also store by column index for positional access
    r.forEach((val, i) => { obj[`_col${i}`] = val || ''; });
    return obj;
  });
}

// Region mapping
const GREATER_CAIRO_WH = ['Barageel', 'Mostorod', 'Al Mansourya - Giza', 'Barageel 2 PL', 'Saryaqus 2 pl'];
const REGIONAL_WH = ['El Mahala', 'Mansoura FC', 'Sharqya', 'Tanta', 'Assiut FC', 'Bani sweif', 'Menya Samalot', 'Sohag', 'khorshed_Alex', 'Khorshed Frozen'];


export function getRegion(teamName: string): string {
  if (GREATER_CAIRO_WH.some(w => teamName.toLowerCase().includes(w.toLowerCase()))) return 'Greater Cairo';
  if (REGIONAL_WH.some(w => teamName.toLowerCase().includes(w.toLowerCase()))) return 'Regional';
  return 'Other';
}

export interface OnDemandRow {
  Date: string;
  Month: string;
  Type: string;
  RunSheet: string;
  WH: string;
  Name: string;
  Ofd: number;
  NMV: number;
  NMV_PCT: number;
  Upselling: number;
  Fixed: number;
  Variable: number;
  Total: number;
  Notes: string;
  Commission: number;
  TotalWithCommission: number;
}

export async function fetchOnDemandData(): Promise<OnDemandRow[]> {
  const rows = await fetchSheet('On Demand');
  if (rows.length < 2) return [];
  const num = (s: string) => parseFloat((s || '').replace(/,/g, '').replace(/%/g, '')) || 0;
  return rows.slice(1).filter(r => r.length > 1 && r[0]).map(r => ({
    Date: r[0] || '',
    Month: r[1] || '',
    Type: r[2] || '',
    RunSheet: r[3] || '',
    WH: (r[4] || '').trim(),
    Name: (r[5] || '').trim(),
    Ofd: num(r[6]),
    NMV: num(r[7]),
    NMV_PCT: num(r[8]),
    Upselling: num(r[9]),
    Fixed: num(r[10]),
    Variable: num(r[11]),
    Total: num(r[12]),
    Notes: r[13] || '',
    Commission: num(r[14]),
    TotalWithCommission: num(r[15]),
  }));
}

export function getAllWarehouses(): { region: string; warehouses: string[] }[] {
  return [
    { region: 'Greater Cairo', warehouses: GREATER_CAIRO_WH },
    { region: 'Regional', warehouses: REGIONAL_WH },
  ];
}
