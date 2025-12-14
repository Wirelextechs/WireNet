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
- **Tables**: fastnet_orders, settings, admin_users
- **Fallback**: Can work with in-memory storage if DATABASE_URL not set

### Package Management
- **Storage**: Browser localStorage (key: `fastnetPackages`)
- **Format**: Packages are stored with `dataAmount` including the "GB" suffix (e.g., "5GB")
- **Default Packages**: If localStorage is empty, default packages are initialized (1GB, 2GB, 5GB, 10GB, 20GB, 50GB)
- **Admin Management**: Admins can add/edit/disable packages via the FastNet Admin dashboard
- **Storefront**: FastNetPage loads enabled packages from localStorage and displays them for purchase

### Order Fulfillment System
The platform integrates with three data bundle suppliers:
1. **DataXpress** (`server/dataxpress.ts`) - Primary supplier
2. **Hubnet** (`server/hubnet.ts`) - Alternative supplier
3. **DataKazina** (`server/dakazina.ts`) - Third option

The `server/supplier-manager.ts` routes orders to the active supplier based on admin settings. Each supplier has different API authentication methods and request formats.

### Payment Processing
- **Provider**: Paystack (JavaScript SDK loaded in index.html)
- **Flow**: Client-side payment initiation, server-side verification

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