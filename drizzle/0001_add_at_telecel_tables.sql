-- Create AT Orders table
CREATE TABLE IF NOT EXISTS "at_orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "short_id" varchar(50) NOT NULL,
  "customer_phone" varchar(20) NOT NULL,
  "package_details" varchar(50) NOT NULL,
  "package_price" integer NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'PAID',
  "payment_reference" varchar(100),
  "supplier_used" varchar(50),
  "supplier_response" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create TELECEL Orders table
CREATE TABLE IF NOT EXISTS "telecel_orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "short_id" varchar(50) NOT NULL,
  "customer_phone" varchar(20) NOT NULL,
  "package_details" varchar(50) NOT NULL,
  "package_price" integer NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'PAID',
  "payment_reference" varchar(100),
  "supplier_used" varchar(50),
  "supplier_response" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create AT Packages table
CREATE TABLE IF NOT EXISTS "at_packages" (
  "id" serial PRIMARY KEY NOT NULL,
  "data_amount" varchar(50) NOT NULL,
  "price" real NOT NULL,
  "delivery_time" varchar(100) NOT NULL,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create TELECEL Packages table
CREATE TABLE IF NOT EXISTS "telecel_packages" (
  "id" serial PRIMARY KEY NOT NULL,
  "data_amount" varchar(50) NOT NULL,
  "price" real NOT NULL,
  "delivery_time" varchar(100) NOT NULL,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
