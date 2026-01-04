-- Add WhatsApp link column to shops table for shop owner contact configuration
ALTER TABLE shops ADD COLUMN IF NOT EXISTS whatsapp_link TEXT;

-- Comment explaining the field
COMMENT ON COLUMN shops.whatsapp_link IS 'Shop owner WhatsApp link for customer contact on storefront';
