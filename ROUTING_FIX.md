# Flask Routing Fix - Complete Guide

## 🐛 The Problem

**Error**: 404 Not Found when accessing `http://127.0.0.1:5000/scan`

**Root Cause**: HTML templates were linking to file paths (`/templates/scan.html`) instead of Flask routes (`/scan`).

## 📁 Understanding Flask Routing

### How Flask Works

Flask uses **routes** to map URLs to functions that render templates:

```python
# app.py
@app.route('/scan')
def scan():
    return render_template('scan.html')
```

This means:
- **URL**: `http://127.0.0.1:5000/scan` ✅
- **NOT**: `http://127.0.0.1:5000/templates/scan.html` ❌

### Your Flask Routes

| Route | Function | Template |
|-------|----------|----------|
| `/` | `index()` | `index.html` |
| `/scan` | `scan()` | `scan.html` |
| `/about` | `about()` | `about.html` |
| `/results` | `results()` | `results.html` |

## ✅ The Fix

Changed all HTML links from **file paths** to **Flask routes**:

### Before (Broken):
```html
<a href="/templates/scan.html">Scan</a>
<a href="/templates/index.html">Home</a>
<a href="/templates/about.html">About</a>
```

### After (Fixed):
```html
<a href="/scan">Scan</a>
<a href="/">Home</a>
<a href="/about">About</a>
```

## 📝 Files Updated

### 1. `templates/index.html`
- Navbar links: `/, /scan, /about`
- "Get Started" button: `/scan`

### 2. `templates/scan.html`
- Navbar links: `/, /scan, /about`

### 3. `templates/about.html`
- Navbar links: `/, /scan, /about`

### 4. `templates/results.html`
- Navbar links: `/, /scan, /about`
- "Scan Another" button: `/scan`

### 5. `static/js/main.js`
- Camera capture redirect: `/results`
- File upload redirect: `/results`

## 🧪 How to Test

### Step 1: Start Flask Server

```bash
cd /Users/ariesivangaribay/Documents/SCHOOLWORKS/MediWeb
python app.py
```

Expected output:
```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
```

### Step 2: Test All Routes

Open browser and test each URL:

✅ **Home**: `http://127.0.0.1:5000/`
✅ **Scan**: `http://127.0.0.1:5000/scan`
✅ **About**: `http://127.0.0.1:5000/about`
✅ **Results**: `http://127.0.0.1:5000/results`

### Step 3: Test Navigation

1. Start at home page
2. Click "Scan" in navbar → Should load scan page
3. Click "About" → Should load about page
4. Click "Home" → Should return to home
5. All links should work without 404 errors ✅

### Step 4: Test Detection Flow

1. Go to `/scan`
2. Upload an image or use camera
3. Click "Scan" or "Capture"
4. Should redirect to `/results` (not `/templates/results.html`)
5. Click "Scan Another" → Should return to `/scan`

## 🔍 Debugging Tips

### Check Flask Logs

Watch the terminal where Flask is running:

**Good (200 = Success):**
```
127.0.0.1 - - [14/Nov/2025 10:30:00] "GET /scan HTTP/1.1" 200 -
127.0.0.1 - - [14/Nov/2025 10:30:01] "GET /about HTTP/1.1" 200 -
```

**Bad (404 = Not Found):**
```
127.0.0.1 - - [14/Nov/2025 10:30:00] "GET /templates/scan.html HTTP/1.1" 404 -
```

### Check Browser Console

Press F12 → Console tab:

**Good:**
- No errors
- Pages load successfully

**Bad:**
- "404 Not Found" errors
- Failed to load resources

### Verify Routes

List all Flask routes:
```bash
python -c "from app import app; print('\n'.join([str(rule) for rule in app.url_map.iter_rules()]))"
```

Expected output:
```
/
/scan
/about
/results
/api/predict
/api/medicines
/api/medicine/<int:medicine_id>
/static/<path:filename>
```

## 📚 Understanding URL Patterns

### Flask Routes (URLs)
```
http://127.0.0.1:5000/          → index()    → renders index.html
http://127.0.0.1:5000/scan      → scan()     → renders scan.html
http://127.0.0.1:5000/about     → about()    → renders about.html
http://127.0.0.1:5000/results   → results()  → renders results.html
```

### Static Files (Direct Access)
```
http://127.0.0.1:5000/static/css/style.css   → Direct file access ✅
http://127.0.0.1:5000/static/js/main.js      → Direct file access ✅
http://127.0.0.1:5000/assets/model.json      → Direct file access ✅
```

### Templates (Not Directly Accessible)
```
http://127.0.0.1:5000/templates/scan.html    → 404 Error ❌
```

Templates must be rendered through Flask routes!

## 🎯 Key Takeaways

1. **Flask uses routes**, not file paths
2. **Templates** are rendered via `render_template()`
3. **Static files** (CSS, JS, images) are accessed directly via `/static/`
4. **HTML links** should use route paths (`/scan`), not file paths (`/templates/scan.html`)
5. **JavaScript redirects** should use route paths too

## ✅ Verification Checklist

Before considering this fixed, verify:

- [ ] Flask server starts without errors
- [ ] `http://127.0.0.1:5000/` loads home page
- [ ] `http://127.0.0.1:5000/scan` loads scan page
- [ ] `http://127.0.0.1:5000/about` loads about page
- [ ] `http://127.0.0.1:5000/results` loads results page
- [ ] All navbar links work on all pages
- [ ] "Get Started" button on home works
- [ ] "Scan Another" button on results works
- [ ] Camera capture redirects to results
- [ ] File upload redirects to results
- [ ] No 404 errors in Flask logs
- [ ] No console errors in browser

## 🚀 You're All Set!

Your Flask routes are now properly configured. All pages should load correctly at:

```
http://127.0.0.1:5000/
http://127.0.0.1:5000/scan
http://127.0.0.1:5000/about
http://127.0.0.1:5000/results
```

**No more 404 errors!** ✅
