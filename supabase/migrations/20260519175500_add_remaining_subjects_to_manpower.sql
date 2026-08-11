-- Alter manpower table to add email subject columns for other document categories
ALTER TABLE public.manpower ADD COLUMN IF NOT EXISTS email_subject_contracts text;
ALTER TABLE public.manpower ADD COLUMN IF NOT EXISTS email_subject_missing text;
ALTER TABLE public.manpower ADD COLUMN IF NOT EXISTS email_subject_renewal text;
