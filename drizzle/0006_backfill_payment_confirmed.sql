-- Backfill paymentConfirmed for existing orders
-- Set paymentConfirmed = true for:
-- 1. All orders with paymentReference (Paystack confirmed orders)
-- 2. All orders with status = 'PAID' (Moolre confirmed orders)

UPDATE fastnet_orders SET payment_confirmed = true WHERE status = 'PAID' OR (payment_reference IS NOT NULL AND payment_reference != '');
UPDATE datagod_orders SET payment_confirmed = true WHERE status = 'PAID' OR (payment_reference IS NOT NULL AND payment_reference != '');
UPDATE at_orders SET payment_confirmed = true WHERE status = 'PAID' OR (payment_reference IS NOT NULL AND payment_reference != '');
UPDATE telecel_orders SET payment_confirmed = true WHERE status = 'PAID' OR (payment_reference IS NOT NULL AND payment_reference != '');
