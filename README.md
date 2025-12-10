# WireNet - All-in-One Data & Internet Solutions

WireNet is a unified platform that combines two data/internet service categories into a single storefront with an integrated admin dashboard.

## Features

### 🛍️ Storefront
- **Home Page**: Displays 2 categories (DataGod and FastNet)
- **WhatsApp Integration**: Floating WhatsApp icon for customer support
- **Side Menu**: Admin login access
- **Category A (DataGod)**: Very cheap/dealership prices with 24hr delivery
- **Category B (FastNet)**: Normal prices with super fast (5-20 mins) delivery

### ⚙️ Admin Dashboard
- **Category Toggles**: Turn categories on/off from the storefront
- **WhatsApp Setup**: Configure WhatsApp link for the floating icon
- **Category Management**: Access individual admin panels for each category
  - DataGod Admin: Manage packages and orders
  - FastNet Admin: Manage packages and orders

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Express.js + Node.js
- **Build Tool**: Vite
- **Database**: PostgreSQL (optional, uses in-memory storage by default)
- **Authentication**: Session-based with Passport.js

## Installation

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build

# Production
npm start
```

## Environment Variables

```
PORT=5000
NODE_ENV=development
SESSION_SECRET=your-secret-key
DATABASE_URL=postgresql://user:password@localhost/wirenet
```

## Project Structure

```
WireNet/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Storefront.tsx
│   │   │   ├── AdminLogin.tsx
│   │   │   └── AdminDashboard.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   └── index.html
├── server/
│   ├── index.ts
│   ├── routes.ts
│   ├── auth.ts
│   ├── storage.ts
│   ├── vite.ts
│   └── db.ts
├── shared/
│   └── schema.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── postcss.config.js
```

## Default Admin Credentials

- **Username**: admin
- **Password**: admin

⚠️ Change these in production!

## Integration with DataGod and FastNet

The WireNet platform serves as a unified storefront. Each category (DataGod and FastNet) can be accessed through:

- **DataGod Admin**: `/datagod/admin`
- **FastNet Admin**: `/fastnet/admin`

These routes should be configured to proxy to the respective applications.

## License

MIT
