# WireNet Integration Guide

This document explains how to integrate the DataGod and FastNet applications into the WireNet unified platform.

## Architecture Overview

```
WireNet (Main App)
├── Storefront (Home Page)
│   ├── Category Display (DataGod & FastNet)
│   ├── WhatsApp Floating Button
│   └── Admin Menu
├── Admin Dashboard
│   ├── Category Toggles
│   ├── WhatsApp Configuration
│   └── Links to Category Admin Panels
└── Proxy Routes
    ├── /datagod/* → DataGod App
    └── /fastnet/* → FastNet App
```

## Integration Steps

### 1. Set Up Proxy Routes

In `server/routes.ts`, add proxy routes to forward requests to the respective applications:

```typescript
import { createProxyMiddleware } from 'express-http-proxy';

// Add these routes before the catch-all route
app.use('/datagod', createProxyMiddleware({
  target: 'http://localhost:3001', // DataGod app port
  changeOrigin: true,
  pathRewrite: {
    '^/datagod': '', // Remove /datagod prefix
  },
}));

app.use('/fastnet', createProxyMiddleware({
  target: 'http://localhost:3002', // FastNet app port
  changeOrigin: true,
  pathRewrite: {
    '^/fastnet': '', // Remove /fastnet prefix
  },
}));
```

### 2. DataGod Integration

**Location**: `/home/code/datagod`

The DataGod app is a simple HTML/JS application. To integrate:

1. **Copy DataGod files** to WireNet:
   ```bash
   cp -r /home/code/datagod/* /home/code/WireNet/public/datagod/
   ```

2. **Update DataGod's index.html** to work under `/datagod/` path:
   - Update all relative paths to be absolute or relative to `/datagod/`
   - Update API endpoints if needed

3. **Run DataGod** on a separate port (e.g., 3001):
   ```bash
   cd /home/code/datagod
   python server.py --port 3001
   ```

### 3. FastNet Integration

**Location**: `/home/code/fastnet-mtn-data`

The FastNet app is a full-stack React + Express application. To integrate:

1. **Install dependencies**:
   ```bash
   cd /home/code/fastnet-mtn-data
   npm install
   ```

2. **Build FastNet**:
   ```bash
   npm run build
   ```

3. **Run FastNet** on a separate port (e.g., 3002):
   ```bash
   PORT=3002 npm start
   ```

### 4. Environment Configuration

Create a `.env` file in WireNet root:

```env
# WireNet
PORT=5000
NODE_ENV=development
SESSION_SECRET=your-secret-key

# DataGod
DATAGOD_URL=http://localhost:3001
DATAGOD_PORT=3001

# FastNet
FASTNET_URL=http://localhost:3002
FASTNET_PORT=3002

# Database (optional)
DATABASE_URL=postgresql://user:password@localhost/wirenet
```

### 5. Shared Settings

The WireNet admin dashboard controls:

- **Category Visibility**: Toggle DataGod and FastNet on/off
- **WhatsApp Link**: Shared across all categories
- **Admin Access**: Centralized authentication

These settings are stored in the WireNet database and can be accessed by the sub-applications via API:

```typescript
// In DataGod or FastNet apps
const response = await fetch('http://localhost:5000/api/settings');
const settings = await response.json();

// Use settings.whatsappLink, settings.datagodEnabled, etc.
```

## Running the Complete Stack

### Option 1: Development Mode (Separate Terminals)

**Terminal 1 - WireNet**:
```bash
cd /home/code/WireNet
npm install
npm run dev
# Runs on http://localhost:5000
```

**Terminal 2 - DataGod**:
```bash
cd /home/code/datagod
python server.py --port 3001
# Runs on http://localhost:3001
```

**Terminal 3 - FastNet**:
```bash
cd /home/code/fastnet-mtn-data
npm install
npm run dev
# Runs on http://localhost:3002
```

### Option 2: Docker Compose (Recommended for Production)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  wirenet:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATAGOD_URL=http://datagod:3001
      - FASTNET_URL=http://fastnet:3002
    depends_on:
      - datagod
      - fastnet

  datagod:
    build: ./datagod
    ports:
      - "3001:3001"
    environment:
      - PORT=3001

  fastnet:
    build: ./fastnet-mtn-data
    ports:
      - "3002:3002"
    environment:
      - PORT=3002
      - NODE_ENV=production
```

## API Endpoints

### WireNet API

- `GET /api/settings` - Get platform settings
- `POST /api/settings` - Update settings (admin only)
- `POST /api/auth/login` - Admin login
- `GET /api/auth/user` - Get current user
- `POST /api/auth/logout` - Logout

### Proxied Routes

- `/datagod/*` - All DataGod routes
- `/fastnet/*` - All FastNet routes

## Customization

### Adding More Categories

To add a third category:

1. **Update schema** in `shared/schema.ts`:
   ```typescript
   export const CategoryType = z.enum(["datagod", "fastnet", "newcategory"]);
   ```

2. **Update Settings** in `server/storage.ts`:
   ```typescript
   newcategoryEnabled: z.boolean().default(true),
   ```

3. **Update Admin Dashboard** in `client/src/pages/AdminDashboard.tsx`:
   - Add toggle for new category
   - Add button to open new category admin

4. **Update Storefront** in `client/src/pages/Storefront.tsx`:
   - Add card for new category

5. **Add proxy route** in `server/routes.ts`

### Styling Customization

- **Tailwind Config**: `tailwind.config.ts`
- **CSS Variables**: `client/src/index.css`
- **Component Styles**: `client/src/components/ui/`

## Troubleshooting

### CORS Issues

If you get CORS errors, add CORS middleware to `server/index.ts`:

```typescript
import cors from 'cors';

app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3002'],
  credentials: true,
}));
```

### Proxy Not Working

Ensure the target applications are running on the correct ports and the proxy middleware is installed:

```bash
npm install express-http-proxy
```

### Session Issues

If sessions aren't persisting, ensure:
- `SESSION_SECRET` is set in environment
- Cookies are enabled in browser
- Same-site cookie policy is configured correctly

## Security Considerations

1. **Change default admin credentials** in production
2. **Use HTTPS** in production
3. **Implement proper authentication** (OAuth, JWT, etc.)
4. **Use environment variables** for sensitive data
5. **Implement rate limiting** on API endpoints
6. **Add CSRF protection** for forms
7. **Validate all user inputs** on server side

## Deployment

### Vercel/Render

1. Push code to GitHub
2. Connect repository to Vercel/Render
3. Set environment variables
4. Deploy

### Self-Hosted

1. Install Node.js and PostgreSQL
2. Clone repository
3. Install dependencies: `npm install`
4. Build: `npm run build`
5. Start: `npm start`

## Support

For issues or questions, refer to:
- DataGod: `/home/code/datagod/README.md`
- FastNet: `/home/code/fastnet-mtn-data/README.md`
- WireNet: `/home/code/WireNet/README.md`
