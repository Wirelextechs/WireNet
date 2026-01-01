-- Backfill paymentConfirmed for existing orders
-- Set paymentConfirmed = true for all orders that have a paymentReference (were confirmed by payment gateway)

UPDATE fastnet_orders SET payment_confirmed = true WHERE payment_reference IS NOT NULL AND payment_reference != '';
UPDATE datagod_orders SET payment_confirmed = true WHERE payment_reference IS NOT NULL AND payment_reference != '';
UPDATE at_orders SET payment_confirmed = true WHERE payment_reference IS NOT NULL AND payment_reference != '';
UPDATE telecel_orders SET payment_confirmed = true WHERE payment_reference IS NOT NULL AND payment_reference != '';
