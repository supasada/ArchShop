-- ==============================================================================
-- MIGRATION 0005: ADMIN-CREATABLE COUNTDOWN EVENTS
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run.
-- Separate from the existing single order-deadline countdown box
-- (that one stays tied to product order_deadline / localStorage).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.countdown_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    target_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_countdown_events_sort_order ON public.countdown_events(sort_order);

ALTER TABLE public.countdown_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view countdown events" ON public.countdown_events;
CREATE POLICY "Public can view countdown events"
ON public.countdown_events FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can manage countdown events" ON public.countdown_events;
CREATE POLICY "Admins can manage countdown events"
ON public.countdown_events FOR ALL
TO anon, authenticated
USING (true) WITH CHECK (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.countdown_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
