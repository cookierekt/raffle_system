# Railway.com Deployment Guide

This folder contains everything needed to deploy the Home Instead Quarterly Raffle Dashboard to Railway.com.

## 🚀 Quick Deployment Steps

### 1. Prepare Your Railway Account
- Sign up at [railway.com](https://railway.com)
- Install the Railway CLI (optional but recommended)

### 2. Deploy to Railway

#### Option A: GitHub Integration (Recommended)
1. Push this `railway-deployment` folder to a GitHub repository
2. Connect your GitHub account to Railway
3. Create a new Railway project from your repository
4. Railway will automatically detect the Flask app and deploy

#### Option B: Railway CLI
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. From this folder, run: `railway deploy`

#### Option C: Direct Upload
1. Zip this entire `railway-deployment` folder
2. Upload to Railway via their web interface

### 3. Set Environment Variables in Railway Dashboard
Go to your Railway project settings and add these environment variables:

```
SECRET_KEY=your-super-secret-key-here-change-this-in-production-make-it-long-and-random
JWT_SECRET=your-jwt-secret-key-here-also-change-this-make-it-different-from-secret-key
DATABASE_PATH=./data/raffle_database.db
FLASK_ENV=production
NODE_ENV=production
```

**⚠️ IMPORTANT:** 
- Generate random, unique values for `SECRET_KEY` and `JWT_SECRET`
- Keep these values secure and never share them
- Railway automatically provides the `PORT` variable

### 4. Database Initialization
The database will be automatically initialized on first deployment with the admin user:
- **Email:** homecare@homeinstead.com
- **Password:** Homeinstead3042

**🔐 Security Note:** Change the admin password immediately after first login!

## 📁 Deployment Package Contents

```
railway-deployment/
├── app.py              # Main Flask application
├── config.py           # Configuration settings
├── database.py         # Database manager
├── auth.py            # Authentication system
├── requirements.txt    # Python dependencies
├── Procfile           # Railway process configuration
├── railway.toml       # Railway deployment configuration
├── init_production_db.py # Database initialization script
├── .env.example       # Environment variables template
├── templates/         # HTML templates
│   ├── dashboard.html
│   └── login.html
├── static/           # Static assets (CSS, JS, images)
│   ├── css/
│   ├── js/
│   └── images/
├── data/            # Database directory (auto-created)
└── README.md        # This file
```

## 🔧 Configuration Details

### Production Settings
- **Debug mode:** Disabled
- **Security headers:** Enabled
- **Rate limiting:** Enabled
- **Database:** SQLite with WAL mode
- **Server:** Gunicorn with 2 workers
- **Timeout:** 120 seconds

### Key Features
- ✅ Enterprise-grade security
- ✅ Role-based access control (Admin/Manager/Viewer)
- ✅ Employee management with Excel import/export
- ✅ Weighted raffle system
- ✅ Comprehensive audit logging
- ✅ Real-time dashboard analytics
- ✅ Mobile-responsive design
- ✅ Home Instead branding

## 🛡️ Security Features
- Bcrypt password hashing
- JWT token authentication
- CSRF protection
- SQL injection prevention
- Rate limiting on sensitive endpoints
- Audit trail logging
- Secure file upload handling

## 📊 Default Admin Credentials
- **Email:** homecare@homeinstead.com
- **Password:** Homeinstead3042

**🚨 CRITICAL:** Change these credentials immediately after deployment!

## 🆘 Troubleshooting

### Common Issues:
1. **Build Fails:** Check that all files copied correctly and requirements.txt is valid
2. **Database Errors:** Ensure data/ directory exists and is writable
3. **Environment Variables:** Verify all required env vars are set in Railway dashboard
4. **Login Issues:** Confirm admin credentials and check database initialization

### Logs:
Check Railway deployment logs in your project dashboard for detailed error information.

## 📞 Support
For technical issues with the application, contact the developer.
For Railway platform issues, check [Railway documentation](https://docs.railway.app/).

## 🎯 Post-Deployment Checklist
- [ ] Application loads successfully
- [ ] Admin login works
- [ ] Change default admin password
- [ ] Test employee management features  
- [ ] Test raffle functionality
- [ ] Verify Excel import/export
- [ ] Check mobile responsiveness
- [ ] Review security settings

---

**🎉 Ready to deploy your Home Instead Raffle Dashboard!**