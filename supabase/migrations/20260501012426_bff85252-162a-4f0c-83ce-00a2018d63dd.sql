CREATE TABLE public.manpower (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system TEXT NOT NULL DEFAULT '',
  courier_name TEXT NOT NULL DEFAULT '',
  starting_date TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT 'Courier',
  doc_birth BOOLEAN NOT NULL DEFAULT false,
  doc_criminal BOOLEAN NOT NULL DEFAULT false,
  doc_graduation BOOLEAN NOT NULL DEFAULT false,
  doc_military BOOLEAN NOT NULL DEFAULT false,
  doc_insurance_print BOOLEAN NOT NULL DEFAULT false,
  doc_photos BOOLEAN NOT NULL DEFAULT false,
  doc_form1 BOOLEAN NOT NULL DEFAULT false,
  insurance_no TEXT NOT NULL DEFAULT '',
  ka3b3aml TEXT NOT NULL DEFAULT 'No',
  contracts TEXT NOT NULL DEFAULT 'Pending',
  mobile_line TEXT NOT NULL DEFAULT 'No',
  mobile TEXT NOT NULL DEFAULT '',
  mobile_personal TEXT NOT NULL DEFAULT '',
  leaving_date TEXT NOT NULL DEFAULT '-',
  cap TEXT NOT NULL DEFAULT 'A',
  status TEXT NOT NULL DEFAULT 'Active',
  medical_card TEXT NOT NULL DEFAULT 'No',
  id_number TEXT NOT NULL DEFAULT '',
  gmail TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  account_bank TEXT NOT NULL DEFAULT '',
  employment_type TEXT NOT NULL DEFAULT 'Fixed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.manpower ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view manpower"
  ON public.manpower FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert manpower"
  ON public.manpower FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update manpower"
  ON public.manpower FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete manpower"
  ON public.manpower FOR DELETE
  USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_manpower_updated_at
  BEFORE UPDATE ON public.manpower
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_manpower_region ON public.manpower(region);
CREATE INDEX idx_manpower_status ON public.manpower(status);