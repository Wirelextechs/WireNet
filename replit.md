# WireNet

## Overview

WireNet is a unified e-commerce platform for data and internet services in Ghana. It combines two service categories (DataGod and FastNet) into a single storefront with an integrated admin dashboard. The platform handles data bundle purchases with payment processing via Paystack and order fulfillment through multiple supplier APIs (DataXpress, Hubnet, DataKazina).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **UI Components**: Custom components built on Radix UI primitives (buttons, cards, inputs, dialogs, etc.)
- **Build Tool**: Vite for fast development and optimized production builds

The frontend lives in both `/src` and `/client/src` directories (some duplication exists). The main entry point is `src/main.tsx` which renders the App component with React Query provider and router.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Authentication**: Session-based auth using express-session with MemoryStore
- **API Pattern**: RESTful endpoints under `/api/` prefix
- **Development**: Uses Vite middleware in dev mode, serves static files in production

Key server files:
- `server/routes.ts` - All API route definitions
- `server/auth.ts` - Authentication middleware and login logic
- `server/storage.ts` - Data access layer (abstracts database operations)

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/db-schema.ts`
- **Tables**: fastnet_orders, settings, admin_users, datagod_orders, datagod_packages
- **Fallback**: Can work with in-memory storage if DATABASE_URL not set

### Settings Management
All platform settings are stored in the database and synced across devices via the `/api/settings` API:
- **whatsappLink**: WhatsApp contact link
- **datagodEnabled**: Toggle for DataGod service visibility
- **fastnetEnabled**: Toggle for FastNet service visibility
- **datagodTransactionCharge**: Transaction fee percentage for DataGod (default: 1.3%)
- **fastnetTransactionCharge**: Transaction fee percentage for FastNet (default: 1.3%)
- **fastnetActiveSupplier**: Active data supplier (dataxpress, hubnet, or dakazina)

The settings are loaded from the API by:
- Admin dashboards (AdminDashboard, DataGodAdmin, FastNetAdmin)
- Storefront pages (Storefront, DataGodPage, FastNetPage)

### Package Management
- **FastNet**: Packages stored in Supabase via `packagesAPI` from `src/lib/supabase.ts`
- **DataGod**: Packages stored in PostgreSQL via `/api/datagod/packages` API
- **Admin Management**: Admins can add/edit/disable packages via respective admin dashboards

### Order Fulfillment System
The platform integrates with three data bundle suppliers:
1. **DataXpress** (`server/dataxpress.ts`) - Primary supplier
2. **Hubnet** (`server/hubnet.ts`) - Alternative supplier
3. **DataKazina** (`server/dakazina.ts`) - Third option

The `server/supplier-manager.ts` routes orders to the active supplier based on admin settings. Each supplier has different API authentication methods and request formats.

### Order Status Tracking
The admin dashboard supports real-time order status checking from suppliers:
- **DataXpress**: Supports status polling via `checkOrderStatus()`
- **DataKazina**: Supports status polling via `checkTransactionStatus()`
- **Hubnet**: Uses webhooks only (no polling supported)

API Endpoints:
- `POST /api/fastnet/orders/:id/check-status` - Check individual order status (skips Hubnet)
- `POST /api/fastnet/orders/refresh-all-statuses` - Bulk refresh all processing orders (excludes Hubnet)

### Payment Processing
- **Provider**: Paystack (JavaScript SDK loaded in index.html)
- **Flow**: Client-side payment initiation, server-side verification
- **Success Page**: After successful payment, customers are redirected to `/order/success/:orderId?service=datagod|fastnet`
  - Displays order ID with copy functionality
  - Shows order summary (package, phone, amount, status)
  - Provides navigation buttons to Home, DataGod, and FastNet pages

## External Dependencies

### Third-Party APIs
- **Paystack**: Payment processing (requires public key in frontend, secret key in backend)
- **DataXpress API**: Data bundle fulfillment (env: `DATAXPRESS_API_KEY`)
- **Hubnet API**: Alternative data supplier (env: `HUBNET_API_KEY`)
- **DataKazina API**: Third data supplier (env: `DAKAZINA_API_KEY`)

### Database
- **PostgreSQL**: Primary database via `DATABASE_URL` environment variable
- **Neon Serverless**: Uses `@neondatabase/serverless` for serverless PostgreSQL connections
- **Drizzle ORM**: Type-safe database queries and migrations

### Key Environment Variables
```
DATABASE_URL - PostgreSQL connection string
SESSION_SECRET - Express session encryption key
DATAXPRESS_API_KEY - DataXpress supplier API key
HUBNET_API_KEY - Hubnet supplier API key
DAKAZINA_API_KEY - DataKazina supplier API key
```

### Deployment
- **Vercel**: Configured via `vercel.json` with serverless function in `api/index.ts`
- **Standard Node.js**: Build with `npm run build`, run with `npm start`