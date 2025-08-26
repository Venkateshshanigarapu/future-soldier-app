# 🚀 Hosting Setup Guide
## Future Soldiers APK - Backend Deployment

This guide shows how to deploy your backend to hosting platforms that don't support `.env` files.

---

## 🎯 **What's Changed**

✅ **No `.env` file needed** - All configuration is hardcoded  
✅ **Firebase config embedded** - Service account key in code  
✅ **Database config embedded** - Connection details in code  
✅ **CORS config embedded** - Allowed origins in code  

---

## 🌐 **Supported Hosting Platforms**

### **Free Platforms:**
- **Railway** - Easy deployment, PostgreSQL included
- **Render** - Free tier with PostgreSQL
- **Heroku** - Free tier (limited)
- **Vercel** - Serverless functions
- **Netlify** - Serverless functions

### **Paid Platforms:**
- **DigitalOcean** - Droplets or App Platform
- **AWS** - EC2, Lambda, or App Runner
- **Google Cloud** - Compute Engine or Cloud Run
- **Azure** - App Service or Functions

---

## 📋 **Pre-Deployment Checklist**

### **1. Update Database Configuration**
Edit `my-api/db.js`:

```javascript
const pool = new Pool({
  host: 'your-hosted-database-url.com',     // Your hosted DB URL
  user: 'your-database-username',           // Your DB username
  password: 'your-database-password',       // Your DB password
  database: 'your-database-name',           // Your DB name
  port: 5432,                               // Usually 5432 for hosted DBs
  ssl: true,                                // Usually true for hosted DBs
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### **2. Update CORS Configuration**
Edit `my-api/index.js`:

```javascript
const CORS_ORIGIN = process.env.CORS_ORIGIN || "https://your-frontend-domain.com,https://your-app-domain.com";
```

### **3. Update Port Configuration**
The server will automatically use the hosting platform's port:

```javascript
const PORT = process.env.PORT || 3001;
```

---

## 🚀 **Deployment Steps**

### **Step 1: Prepare Your Code**

1. **Install Dependencies:**
   ```bash
   cd my-api
   npm install
   ```

2. **Create Database Tables:**
   ```bash
   # Run this on your hosted database
   psql -h your-db-host -U your-username -d your-database -f database-schema.sql
   ```

3. **Test Locally:**
   ```bash
   npm start
   ```

### **Step 2: Choose Your Hosting Platform**

#### **Option A: Railway (Recommended)**
1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Add PostgreSQL service
4. Deploy your app
5. Set environment variables in Railway dashboard

#### **Option B: Render**
1. Go to [render.com](https://render.com)
2. Connect your GitHub repository
3. Create a new Web Service
4. Add PostgreSQL database
5. Deploy

#### **Option C: Heroku**
1. Install Heroku CLI
2. Create Heroku app
3. Add PostgreSQL addon
4. Deploy with Git

### **Step 3: Configure Database**

After getting your hosted database:

1. **Update `my-api/db.js`:**
   ```javascript
   const pool = new Pool({
     host: 'your-db-host.railway.app',
     user: 'postgres',
     password: 'your-db-password',
     database: 'railway',
     port: 5432,
     ssl: true,
     max: 20,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

2. **Create Tables:**
   ```bash
   # Use your hosting platform's database connection
   psql "postgresql://username:password@host:port/database" -f database-schema.sql
   ```

### **Step 4: Deploy**

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for hosting deployment"
   git push origin main
   ```

2. **Deploy on Platform:**
   - Railway: Automatic deployment
   - Render: Manual deployment
   - Heroku: `git push heroku main`

---

## 🔧 **Platform-Specific Configurations**

### **Railway**
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment Variables:** Set in Railway dashboard

### **Render**
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment Variables:** Set in Render dashboard

### **Heroku**
- **Procfile:** `web: npm start`
- **Environment Variables:** Set in Heroku dashboard

### **Vercel**
- **Build Command:** `npm install`
- **Output Directory:** `my-api`
- **Install Command:** `npm install`

---

## 🧪 **Testing After Deployment**

### **1. Test API Endpoints**
```bash
# Test basic connectivity
curl https://your-app.railway.app/api/ping

# Test database connection
curl https://your-app.railway.app/api/dbtest

# Test notification sending
curl -X POST https://your-app.railway.app/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "title": "Test Alert",
    "message": "Hosting is working!",
    "type": "info",
    "category": "system"
  }'
```

### **2. Test Firebase Integration**
```bash
# Test zone breach alert
curl -X POST https://your-app.railway.app/api/alerts/zone-breach \
  -H "Content-Type: application/json" \
  -d '{
    "zoneId": 1,
    "userId": 1,
    "breachType": "entry",
    "latitude": 40.7128,
    "longitude": -74.0060
  }'
```

### **3. Update Frontend Configuration**
Update `frontend/services/api.js`:

```javascript
const API_BASE_URL = 'https://your-app.railway.app/api';
```

---

## 🚨 **Troubleshooting**

### **Common Issues:**

#### **1. Database Connection Failed**
- Check database credentials in `db.js`
- Verify SSL settings
- Test connection manually

#### **2. CORS Errors**
- Update CORS origins in `index.js`
- Add your frontend domain to allowed origins

#### **3. Firebase Not Working**
- Verify service account key is correct
- Check Firebase project settings
- Test with simple notification first

#### **4. Port Issues**
- Use `process.env.PORT` (automatic on most platforms)
- Don't hardcode port numbers

### **Debug Commands:**
```bash
# Check logs
railway logs
render logs
heroku logs --tail

# Test database connection
psql "postgresql://username:password@host:port/database" -c "SELECT NOW();"

# Test API endpoints
curl -v https://your-app.railway.app/api/ping
```

---

## 🔒 **Security Considerations**

### **For Production:**
1. **Use Environment Variables** when possible
2. **Rotate Firebase Keys** regularly
3. **Use HTTPS** for all connections
4. **Implement Rate Limiting**
5. **Add Authentication** to API endpoints

### **Current Configuration:**
- Firebase key is embedded (acceptable for demo/prototype)
- Database credentials are embedded (change for production)
- CORS is configured for specific domains

---

## 📱 **Frontend Updates**

After deploying backend:

1. **Update API URL:**
   ```javascript
   // In frontend/services/api.js
   const API_BASE_URL = 'https://your-app.railway.app/api';
   ```

2. **Test Connection:**
   ```javascript
   // Test in your app
   fetch('https://your-app.railway.app/api/ping')
     .then(response => response.json())
     .then(data => console.log('Backend connected:', data));
   ```

3. **Build and Deploy Frontend:**
   ```bash
   cd frontend
   eas build --platform android --profile production
   ```

---

## ✅ **Success Checklist**

- [ ] Backend deployed successfully
- [ ] Database connected and tables created
- [ ] API endpoints responding
- [ ] Firebase notifications working
- [ ] Frontend updated with new API URL
- [ ] All features tested on hosted backend
- [ ] SSL/HTTPS working
- [ ] CORS configured correctly

---

## 🎯 **Next Steps**

1. **Monitor Performance** - Check hosting platform metrics
2. **Set Up Monitoring** - Add error tracking (Sentry, etc.)
3. **Scale Up** - Upgrade hosting plan if needed
4. **Add Security** - Implement proper authentication
5. **Backup Strategy** - Set up database backups

---

**🎉 Your Future Soldiers APK backend is now ready for hosting without environment variables!**

The system will work on any hosting platform that supports Node.js and PostgreSQL.
