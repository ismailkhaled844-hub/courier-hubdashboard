DROP POLICY IF EXISTS "Anyone can insert manpower regions" ON public.manpower_regions;
DROP POLICY IF EXISTS "Anyone can delete manpower regions" ON public.manpower_regions;

CREATE POLICY "Valid manpower regions can be added"
ON public.manpower_regions
FOR INSERT
WITH CHECK (length(trim(name)) > 0);

CREATE POLICY "Named manpower regions can be deleted"
ON public.manpower_regions
FOR DELETE
USING (length(trim(name)) > 0);