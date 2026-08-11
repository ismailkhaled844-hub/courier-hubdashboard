
CREATE TABLE public.oms_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mobile_number TEXT NOT NULL DEFAULT '',
  sys_code TEXT NOT NULL DEFAULT '',
  partner_id TEXT NOT NULL DEFAULT '',
  insur_comp TEXT NOT NULL DEFAULT '',
  structure_company TEXT NOT NULL DEFAULT '',
  maxer_id TEXT NOT NULL DEFAULT '',
  national_id TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  name_ar TEXT NOT NULL DEFAULT '',
  site TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT '',
  hiring_date TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oms_employees_national_id ON public.oms_employees(national_id);

ALTER TABLE public.oms_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view oms_employees" ON public.oms_employees FOR SELECT USING (true);
CREATE POLICY "Anyone can insert oms_employees" ON public.oms_employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update oms_employees" ON public.oms_employees FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete oms_employees" ON public.oms_employees FOR DELETE USING (true);

CREATE TRIGGER oms_employees_updated_at BEFORE UPDATE ON public.oms_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.oms_payroll (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  national_id TEXT NOT NULL UNIQUE,
  leaving_date TEXT DEFAULT '',
  account_number TEXT DEFAULT '',
  payment_method TEXT DEFAULT '',
  m TEXT DEFAULT '',
  cost_centre TEXT DEFAULT '',
  department TEXT DEFAULT '',
  sub_department TEXT DEFAULT '',
  title TEXT DEFAULT '',
  net_fixed_salary TEXT DEFAULT '',
  ceiling_variable_salary TEXT DEFAULT '',
  fixed_allowances TEXT DEFAULT '',
  working_days TEXT DEFAULT '',
  fixed_allowances_per_working_day TEXT DEFAULT '',
  net_fixed_per_working_days TEXT DEFAULT '',
  net_variable_salary TEXT DEFAULT '',
  productivity_bonus TEXT DEFAULT '',
  net_bonus TEXT DEFAULT '',
  overtime_per_hours TEXT DEFAULT '',
  overtime_per_days TEXT DEFAULT '',
  transportation TEXT DEFAULT '',
  total_earning TEXT DEFAULT '',
  absence TEXT DEFAULT '',
  attendance_lateness TEXT DEFAULT '',
  other_deductions TEXT DEFAULT '',
  cash_deficit TEXT DEFAULT '',
  pending_deficit TEXT DEFAULT '',
  damage_deficit TEXT DEFAULT '',
  total_deduction TEXT DEFAULT '',
  deductions_0005 TEXT DEFAULT '',
  total_net TEXT DEFAULT '',
  comments TEXT DEFAULT '',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oms_payroll_national_id ON public.oms_payroll(national_id);

ALTER TABLE public.oms_payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view oms_payroll" ON public.oms_payroll FOR SELECT USING (true);
CREATE POLICY "Anyone can insert oms_payroll" ON public.oms_payroll FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update oms_payroll" ON public.oms_payroll FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete oms_payroll" ON public.oms_payroll FOR DELETE USING (true);
