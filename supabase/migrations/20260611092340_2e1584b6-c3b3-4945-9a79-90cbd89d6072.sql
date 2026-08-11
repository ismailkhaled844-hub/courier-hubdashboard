CREATE TABLE public.capacity_edits (
  cell_key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capacity_edits TO anon, authenticated;
GRANT ALL ON public.capacity_edits TO service_role;
ALTER TABLE public.capacity_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read capacity edits" ON public.capacity_edits FOR SELECT USING (true);
CREATE POLICY "Anyone can insert capacity edits" ON public.capacity_edits FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update capacity edits" ON public.capacity_edits FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete capacity edits" ON public.capacity_edits FOR DELETE USING (true);