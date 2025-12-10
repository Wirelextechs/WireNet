# WireNet Deployment Guide

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL (optional, uses in-memory storage by default)

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Access the application**:
   - Storefront: http://localhost:5000
   - Admin: http://localhost:5000/admin/login
   - Default credentials: admin / admin

### Production Build

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Start production server**:
   ```bash
   npm start
   ```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=5000
NODE_ENV=production
SESSION_SECRET=your-very-secure-secret-key-change-this

# Database (optional)
DATABASE_URL=postgresql://user:password@localhost/wirenet

# Sub-applications (when integrated)
DATAGOD_URL=http://localhost:3001
FASTNET_URL=http://localhost:3002
```

## Deployment Platforms

### Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### Render

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect GitHub repository
4. Set environment variables:
   - `NODE_ENV`: production
   - `SESSION_SECRET`: your-secret-key
5. Deploy

### Railway

1. Push code to GitHub
2. Create new project on Railway
3. Add GitHub repository
4. Set environment variables
5. Deploy

### Self-Hosted (VPS/Dedicated Server)

1. **SSH into server**:
   ```bash
   ssh user@your-server.com
   ```

2. **Install Node.js**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone repository**:
   ```bash
   git clone https://github.com/Wirelextechs/WireNet.git
   cd WireNet
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Build application**:
   ```bash
   npm run build
   ```

6. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   nano .env
   ```

7. **Install PM2** (process manager):
   ```bash
   sudo npm install -g pm2
   ```

8. **Start application with PM2**:
   ```bash
   pm2 start npm --name "wirenet" -- start
   pm2 save
   pm2 startup
   ```

9. **Set up Nginx reverse proxy**:
   ```bash
   sudo apt-get install nginx
   ```

   Create `/etc/nginx/sites-available/wirenet`:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   Enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/wirenet /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

10. **Set up SSL with Let's Encrypt**:
    ```bash
    sudo apt-get install certbot python3-certbot-nginx
    sudo certbot --nginx -d your-domain.com
    ```

## Docker Deployment

### Build Docker Image

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t wirenet .
docker run -p 5000:5000 -e NODE_ENV=production wirenet
```

### Docker Compose

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
      - SESSION_SECRET=${SESSION_SECRET}
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=wirenet
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

Run with:
```bash
docker-compose up -d
```

## Monitoring & Maintenance

### Logs

View application logs:
```bash
pm2 logs wirenet
```

### Updates

To update the application:

```bash
cd /path/to/WireNet
git pull origin main
npm install
npm run build
pm2 restart wirenet
```

### Backups

If using PostgreSQL, backup regularly:

```bash
pg_dump wirenet > backup_$(date +%Y%m%d).sql
```

## Security Checklist

- [ ] Change default admin credentials
- [ ] Set strong `SESSION_SECRET`
- [ ] Enable HTTPS/SSL
- [ ] Set `NODE_ENV=production`
- [ ] Use environment variables for sensitive data
- [ ] Enable firewall rules
- [ ] Set up regular backups
- [ ] Monitor application logs
- [ ] Keep dependencies updated
- [ ] Implement rate limiting
- [ ] Add CSRF protection
- [ ] Validate all user inputs

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>
```

### Out of Memory

Increase Node.js memory:
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm start
```

### Database Connection Issues

Check connection string:
```bash
psql $DATABASE_URL
```

### Application Won't Start

Check logs:
```bash
npm run dev
```

Look for error messages and ensure all environment variables are set.

## Performance Optimization

1. **Enable gzip compression**:
   ```typescript
   import compression from 'compression';
   app.use(compression());
   ```

2. **Use CDN** for static assets

3. **Enable caching headers**:
   ```typescript
   app.use(express.static('dist', {
     maxAge: '1d',
     etag: false
   }));
   ```

4. **Database indexing** for frequently queried fields

5. **Connection pooling** for database

## Support

For deployment issues, check:
- Application logs
- Environment variables
- Network connectivity
- Database status
- Disk space
- Memory usage
