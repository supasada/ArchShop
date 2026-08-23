-- ==============================================================================
-- 🚀 RUN THIS SQL IN SUPABASE SQL EDITOR TO ADD 'payment_method' COLUMN
-- ==============================================================================

-- 1. Add payment_method column to orders table if it doesn't exist
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'transfer';

-- 2. Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';

-- 3. Verify that the column now exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'payment_method';
