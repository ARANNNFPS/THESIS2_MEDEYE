# Deploy MediWeb to Railway

## Quick Deploy (Recommended)

### Option 1: Deploy from GitHub (Easiest)

1. **Push your code to GitHub** (already done!)
   ```
   Repository: https://github.com/ARANNNFPS/THESIS2_MEDEYE.git
   ```

2. **Go to Railway**
   - Visit: https://railway.app
   - Click "Start a New Project"
   - Select "Deploy from GitHub repo"

3. **Connect GitHub**
   - Authorize Railway to access your GitHub
   - Select repository: `ARANNNFPS/THESIS2_MEDEYE`
   - Click "Deploy Now"

4. **Wait for deployment** (2-3 minutes)
   - Railway will automatically:
     - Detect Python project
     - Install dependencies from requirements.txt
     - Run using the Procfile
     - Assign a public URL

5. **Get your URL**
   - Click on your deployment
   - Find the URL under "Settings" → "Domains"
   - Your app will be at: `https://your-app-name.up.railway.app`

---

### Option 2: Deploy via Railway CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   # or
   brew install railway
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize project**
   ```bash
   railway init
   ```

4. **Link to GitHub repo** (optional)
   ```bash
   railway link
   ```

5. **Deploy**
   ```bash
   railway up
   ```

6. **Open your app**
   ```bash
   railway open
   ```

---

## Configuration Files Included

✅ **Procfile** - Tells Railway how to run your app
```
web: gunicorn app:app
```

✅ **railway.json** - Railway-specific configuration
```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "gunicorn app:app",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

✅ **requirements.txt** - Python dependencies
```
Flask==3.0.0
flask-cors==4.0.0
flask-compress==1.14
gunicorn==21.2.0
```

✅ **runtime.txt** - Python version
```
python-3.12.0
```

---

## Environment Variables (Optional)

Railway automatically sets `PORT` for you. If you need custom environment variables:

1. Go to your Railway project
2. Click "Variables" tab
3. Add variables:
   - `FLASK_ENV=production`
   - `SECRET_KEY=your-secret-key` (if needed)

---

## Custom Domain (Optional)

1. Go to Railway project → Settings → Domains
2. Click "Add Domain"
3. Enter your custom domain: `yourdomain.com`
4. Add CNAME record in your DNS provider:
   ```
   CNAME @ your-app.up.railway.app
   ```

---

## Deployment Checklist

Before deploying, ensure:

- ✅ All files committed to GitHub
- ✅ `requirements.txt` has all dependencies
- ✅ `Procfile` exists and is correct
- ✅ `railway.json` is configured
- ✅ Large model files are in repository (Railway supports up to 100MB files)
- ✅ Database file (`mediweb.db`) is included

---

## Expected Deployment Time

- **First deployment**: 2-3 minutes
- **Subsequent deployments**: 1-2 minutes
- **Cold start**: 1-5 seconds

---

## Monitoring & Logs

### View Logs
```bash
railway logs
```

Or in the Railway dashboard:
1. Click on your project
2. Go to "Deployments" tab
3. Click on a deployment
4. View real-time logs

### Monitor Performance
- Railway provides built-in metrics:
  - CPU usage
  - Memory usage
  - Network traffic
  - Request count

---

## Troubleshooting

### Issue: "Application failed to respond"
**Solution:** Check if gunicorn is installed
```bash
pip install gunicorn
```

### Issue: "Module not found"
**Solution:** Ensure all dependencies are in requirements.txt
```bash
pip freeze > requirements.txt
```

### Issue: "Port already in use"
**Solution:** Railway automatically assigns PORT. Don't hardcode port 5000.

Update `app.py` to use Railway's PORT:
```python
if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
```

### Issue: "Model files too large"
**Solution:** 
- Railway supports up to 100MB files in repo
- Your model files (43MB total) should work fine
- If issues persist, use Railway's volume storage

### Issue: "Service Worker not working"
**Solution:** Ensure HTTPS is enabled (Railway provides this by default)

---

## Performance Optimizations for Railway

Your app already includes:
- ✅ Service Worker caching (works on Railway)
- ✅ Web Worker inference
- ✅ Server-side compression (Brotli/Gzip)
- ✅ Detection caching
- ✅ Image preprocessing

Additional Railway-specific optimizations:
- Railway automatically provides CDN
- Railway uses HTTP/2 by default
- Railway provides automatic SSL/TLS

---

## Costs

Railway Pricing (as of 2024):
- **Hobby Plan**: $5/month
  - 500 hours of usage
  - Perfect for development/testing
  
- **Pro Plan**: $20/month
  - Unlimited usage
  - Better for production

- **Free Trial**: $5 credit
  - Good for initial testing

---

## Scaling

Railway provides:
- **Vertical scaling**: Increase RAM/CPU
- **Horizontal scaling**: Multiple instances (Pro plan)
- **Auto-scaling**: Based on traffic

For this app:
- Start with **1GB RAM / 1 vCPU** (default)
- Scale up if needed (model inference is CPU-intensive)

---

## Continuous Deployment

Once connected to GitHub:
1. Push changes to GitHub
2. Railway automatically detects changes
3. Rebuilds and redeploys
4. Zero downtime deployment

```bash
git add .
git commit -m "Update feature"
git push origin main
# Railway deploys automatically!
```

---

## Health Checks

Railway automatically monitors your app. You can add a health endpoint:

Add to `app.py`:
```python
@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'version': '2.0.0'}), 200
```

Configure in Railway:
- Path: `/health`
- Interval: 30 seconds
- Timeout: 10 seconds

---

## Backup & Recovery

### Database Backup
```bash
# Download database from Railway
railway run python backup_db.py

# Or use Railway CLI
railway volumes download
```

### Rollback Deployment
1. Go to Railway dashboard
2. Click "Deployments"
3. Find previous successful deployment
4. Click "Redeploy"

---

## Security Best Practices

1. **Enable CORS properly** (already configured)
2. **Use environment variables** for secrets
3. **Enable HTTPS** (automatic on Railway)
4. **Set secure headers** (add to app.py if needed)
5. **Rate limiting** (optional, use Flask-Limiter)

---

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app

---

## Quick Reference Commands

```bash
# Login
railway login

# Initialize
railway init

# Deploy
railway up

# View logs
railway logs

# Open app
railway open

# Check status
railway status

# Environment variables
railway variables set KEY=VALUE

# Restart service
railway restart
```

---

## Success Checklist

After deployment, verify:

- ✅ App is accessible at Railway URL
- ✅ Model loads successfully (check browser console)
- ✅ Service Worker caches model (check Network tab)
- ✅ Web Worker runs inference (check console logs)
- ✅ Detection works end-to-end
- ✅ Results page displays correctly
- ✅ Performance metrics available (window.getPerformanceMetrics())

---

**Your MediWeb app is ready to deploy to Railway!** 🚀

Just follow Option 1 (Deploy from GitHub) for the easiest experience.
