-- ==============================================================================
-- MIGRATION 0003: ADMIN-EDITABLE SIZE CHART
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SIZE CHART TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.size_chart (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    size TEXT NOT NULL,
    chest TEXT NOT NULL,
    length TEXT NOT NULL,
    sleeve TEXT NOT NULL,
    armhole TEXT NOT NULL,
    shoulder TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_size_chart_sort_order ON public.size_chart(sort_order);

-- ------------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------
ALTER TABLE public.size_chart ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view size chart" ON public.size_chart;
CREATE POLICY "Public can view size chart"
ON public.size_chart FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can manage size chart" ON public.size_chart;
CREATE POLICY "Admins can manage size chart"
ON public.size_chart FOR ALL
TO anon, authenticated
USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. SEED — carry over today's hardcoded chart so nothing changes on deploy
-- ------------------------------------------------------------------------------
INSERT INTO public.size_chart (size, chest, length, sleeve, armhole, shoulder, sort_order)
SELECT * FROM (VALUES
    ('S', '32"', '23"', '6"', '14"', '13"', 0),
    ('M', '36"', '25"', '7"', '15.5"', '15"', 1),
    ('L', '40"', '27"', '8"', '17.5"', '17"', 2),
    ('XL', '44"', '29"', '9"', '19"', '19"', 3),
    ('2XL', '48"', '31"', '10"', '21"', '21"', 4)
) AS seed(size, chest, length, sleeve, armhole, shoulder, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.size_chart);

-- ------------------------------------------------------------------------------
-- 4. REALTIME
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.size_chart;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
