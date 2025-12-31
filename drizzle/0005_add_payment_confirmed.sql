-- Add paymentConfirmed column to all order tables
-- This tracks whether a payment has been confirmed by the payment gateway (Paystack/Moolre P01)

ALTER TABLE fastnet_orders ADD COLUMN payment_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE datagod_orders ADD COLUMN payment_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE at_orders ADD COLUMN payment_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE telecel_orders ADD COLUMN payment_confirmed BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster filtering
CREATE INDEX idx_fastnet_orders_payment_confirmed ON fastnet_orders(payment_confirmed);
CREATE INDEX idx_datagod_orders_payment_confirmed ON datagod_orders(payment_confirmed);
CREATE INDEX idx_at_orders_payment_confirmed ON at_orders(payment_confirmed);
CREATE INDEX idx_telecel_orders_payment_confirmed ON telecel_orders(payment_confirmed);
