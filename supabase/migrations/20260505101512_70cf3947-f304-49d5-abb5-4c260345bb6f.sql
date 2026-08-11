
INSERT INTO storage.buckets (id, name, public)
VALUES ('manpower-docs', 'manpower-docs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view manpower docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'manpower-docs');

CREATE POLICY "Public can upload manpower docs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'manpower-docs');

CREATE POLICY "Public can update manpower docs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'manpower-docs');

CREATE POLICY "Public can delete manpower docs"
ON storage.objects FOR DELETE
USING (bucket_id = 'manpower-docs');
