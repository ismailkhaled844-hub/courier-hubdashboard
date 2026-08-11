CREATE TABLE IF NOT EXISTS public.manpower_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manpower_regions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manpower_regions'
      AND policyname = 'Anyone can view manpower regions'
  ) THEN
    CREATE POLICY "Anyone can view manpower regions"
    ON public.manpower_regions
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manpower_regions'
      AND policyname = 'Anyone can insert manpower regions'
  ) THEN
    CREATE POLICY "Anyone can insert manpower regions"
    ON public.manpower_regions
    FOR INSERT
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manpower_regions'
      AND policyname = 'Anyone can delete manpower regions'
  ) THEN
    CREATE POLICY "Anyone can delete manpower regions"
    ON public.manpower_regions
    FOR DELETE
    USING (true);
  END IF;
END $$;

INSERT INTO public.manpower_regions (name)
VALUES
  ('Assiut FC'), ('Bani sweif'), ('El-Mahala'), ('Elmenya'), ('Khorshed Alex'),
  ('Mansoura FC'), ('Qwesna'), ('Sharqya'), ('Sohag'), ('Tanta')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.manpower_regions (name)
SELECT DISTINCT region
FROM public.manpower
WHERE COALESCE(region, '') <> ''
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.manpower
  ADD COLUMN IF NOT EXISTS leaver_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS leaver_reason text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_manpower_regions_name ON public.manpower_regions (name);
CREATE INDEX IF NOT EXISTS idx_manpower_region_status ON public.manpower (region, status);