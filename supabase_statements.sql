-- ==========================================
-- Supabase Statement File Storage Setup
-- Run this in your Supabase SQL Editor.
-- ==========================================

-- 1. Create a Private Storage Bucket for Statements
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'statements',
    'statements',
    false,
    5242880, -- 5 MB limit
    ARRAY['text/csv', 'application/vnd.ms-excel', 'application/csv']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create Storage Policies for Statements Bucket
DROP POLICY IF EXISTS "Allow users to upload statements" ON storage.objects;
CREATE POLICY "Allow users to upload statements" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'statements'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Allow users to view their own statements" ON storage.objects;
CREATE POLICY "Allow users to view their own statements" ON storage.objects
FOR SELECT USING (
    bucket_id = 'statements'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Allow users to delete their own statements" ON storage.objects;
CREATE POLICY "Allow users to delete their own statements" ON storage.objects
FOR DELETE USING (
    bucket_id = 'statements'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Create public.statements metadata table
CREATE TABLE IF NOT EXISTS public.statements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    row_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on public.statements
ALTER TABLE public.statements ENABLE ROW LEVEL SECURITY;

-- Create Policies for public.statements
DROP POLICY IF EXISTS "Users can view their own statement metadata" ON public.statements;
CREATE POLICY "Users can view their own statement metadata"
ON public.statements FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own statement metadata" ON public.statements;
CREATE POLICY "Users can insert their own statement metadata"
ON public.statements FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own statement metadata" ON public.statements;
CREATE POLICY "Users can delete their own statement metadata"
ON public.statements FOR DELETE
USING (auth.uid() = user_id);

-- 4. Add statement_id reference to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS statement_id UUID REFERENCES public.statements ON DELETE CASCADE;
