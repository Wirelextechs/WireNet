# WireNet Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install Dependencies
```bash
cd /home/code/WireNet
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Access the Application
- **Storefront**: http://localhost:5000
- **Admin Login**: http://localhost:5000/admin/login
- **Default Credentials**: 
  - Username: `admin`
  - Password: `admin`

## 📱 What You'll See

### Storefront (Home Page)
- WireNet header with admin menu
- Two category cards:
  - **DataGod**: Cheap prices, 24hr delivery
  - **FastNet**: Fast delivery (5-20 mins)
- WhatsApp floating button (when configured)

### Admin Dashboard
- Toggle categories on/off
- Configure WhatsApp link
- Access DataGod and FastNet admin panels

## 🔧 Common Tasks

### Change Admin Password
Edit `server/storage.ts`:
```typescript
// Find this line in the constructor:
this.adminUsers.set("admin", {
  id: "1",
  username: "admin",
  password: "your-new-password", // Change this
  createdAt: new Date(),
});
```

### Configure WhatsApp Link
1. Go to Admin Dashboard
2. Scroll to "WhatsApp Setup"
3. Paste your WhatsApp link (wa.link, group, or channel)
4. Click "Save Settings"

### Toggle Categories
1. Go to Admin Dashboard
2. Use the toggle switches next to each category
3. Changes apply immediately to the storefront

## 📚 Documentation

- **README.md** - Full project documentation
- **INTEGRATION_GUIDE.md** - How to integrate DataGod & FastNet
- **DEPLOYMENT.md** - Deploy to production
- **PROJECT_SUMMARY.md** - Complete project overview

## 🐛 Troubleshooting

### Port 5000 Already in Use
```bash
# Find and kill the process
lsof -i :5000
kill -9 <PID>
```

### Dependencies Not Installing
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Can't Login
- Check default credentials: admin / admin
- Ensure session is enabled
- Check browser cookies are enabled

## 🔗 Next Steps

1. **Test the storefront** - Visit http://localhost:5000
2. **Login to admin** - Use admin/admin
3. **Configure WhatsApp** - Add your WhatsApp link
4. **Integrate DataGod** - Follow INTEGRATION_GUIDE.md
5. **Integrate FastNet** - Follow INTEGRATION_GUIDE.md
6. **Deploy** - Follow DEPLOYMENT.md

## 📞 Need Help?

Check the documentation files:
- `README.md` - General info
- `INTEGRATION_GUIDE.md` - Integration help
- `DEPLOYMENT.md` - Deployment help
- `PROJECT_SUMMARY.md` - Project details

## 🎯 Project Structure

```
WireNet/
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types
├── package.json     # Dependencies
└── README.md        # Full documentation
```

## ✅ Checklist

- [ ] Installed dependencies (`npm install`)
- [ ] Started dev server (`npm run dev`)
- [ ] Accessed storefront (http://localhost:5000)
- [ ] Logged into admin (admin/admin)
- [ ] Configured WhatsApp link
- [ ] Read INTEGRATION_GUIDE.md
- [ ] Ready to integrate DataGod & FastNet

---

**Happy coding! 🚀**
