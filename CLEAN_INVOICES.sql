-- ================================================================
--  AJIGS CONNECT — CLEAN INVOICES
--  Deletes seed/test invoices, keeps only real ones you created.
--  Run in Supabase SQL Editor.
-- ================================================================

-- First see what invoices exist
SELECT id, invoice_number, client_name, total, status, created_at 
FROM public.ajigs_invoices 
ORDER BY id;

-- Delete all invoices (run this to clear everything fresh)
-- Then the next invoice you create will start from INV-129
DELETE FROM public.ajigs_invoices;

-- Reset the sequence so next invoice number continues from 128
-- (your erp.js generates the next number by counting existing + 128)
-- Nothing else needed — just create a new invoice from the dashboard.

-- Verify
SELECT COUNT(*) as remaining_invoices FROM public.ajigs_invoices;
