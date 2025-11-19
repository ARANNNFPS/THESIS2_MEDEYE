# MediWeb - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies

```bash
cd /Users/ariesivangaribay/Documents/SCHOOLWORKS/MediWeb
pip install -r requirements.txt
```

### Step 2: Start the Server

```bash
python app.py
```

You should see:
```
 * Running on http://0.0.0.0:5000
 * Debug mode: on
```

### Step 3: Open in Browser

Navigate to:
```
http://localhost:5000
```

---

## 🎯 How to Use

### Option A: Use Camera

1. Click **"Scan"** in navigation
2. Click **"Open Camera"**
3. Allow camera permissions
4. Position medicine in view
5. Click **"Capture"**
6. Wait for detection (~2-3 seconds)
7. View results with complete medicine information

### Option B: Upload Image

1. Click **"Scan"** in navigation
2. Click **"Choose File"**
3. Select a medicine image
4. Click **"Scan"**
5. See bounding boxes appear
6. View results

---

## 📊 What You'll See

### On Detection:
- ✅ Green bounding boxes around detected medicines
- ✅ Labels with medicine name + confidence percentage
- ✅ Example: "biogesic-para 95.3%"

### On Results Page:
- Medicine name (e.g., "Biogesic (Paracetamol)")
- Manufacturer
- Medical uses
- Dosage guidelines
- Warnings & side effects
- Additional information
- Legal status (if available)
- Prescription requirement badge

---

## 🔧 Current Setup

### Detected Medicines:
1. **Biogesic 500mg** (Paracetamol)
   - YOLO Label: `biogesic-para`
   - No prescription required

2. **RiteMed 500mg** (Paracetamol)
   - YOLO Label: `ritemed-para`
   - Prescription required

### Model Configuration:
- **Input Size**: 640x640 pixels
- **Confidence Threshold**: 25%
- **IoU Threshold**: 45%
- **Location**: `/assets/model.json`

### Database:
- **Location**: `/assets/mediweb.db`
- **Type**: SQLite
- **Records**: 2 medicines

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `app.py` | Flask backend server |
| `static/js/main.js` | YOLO detection + UI logic |
| `templates/scan.html` | Camera/upload interface |
| `templates/results.html` | Results display |
| `assets/model.json` | TensorFlow.js YOLO model |
| `assets/mediweb.db` | SQLite medicine database |

---

## 🐛 Troubleshooting

### Camera Won't Open
- Grant camera permissions in browser
- Use HTTPS in production (required for camera)
- Try a different browser

### Model Won't Load
- Check browser console (F12 → Console)
- Verify `/assets/model.json` exists
- Ensure TensorFlow.js CDN is accessible

### No Detections
- Use clear, well-lit images
- Ensure medicine is fully visible
- Try lowering `scoreThreshold` in `main.js`

### Backend Errors
- Check Flask terminal for error messages
- Verify database exists: `ls assets/mediweb.db`
- Test database: `sqlite3 assets/mediweb.db "SELECT * FROM pills;"`

---

## 📚 Documentation

- **[README.md](README.md)** - Full documentation
- **[INTEGRATION_SUMMARY.md](INTEGRATION_SUMMARY.md)** - Technical details
- **[DATABASE_INTEGRATION.md](DATABASE_INTEGRATION.md)** - Database guide

---

## 🎓 Next Steps

### Add More Medicines:

1. **Update YOLO Labels** (`static/js/main.js`):
```javascript
const CLASS_LABELS = [
    'biogesic-para',
    'ritemed-para',
    'your-new-medicine'  // Add here
];
```

2. **Add Database Mapping** (`app.py`):
```python
CLASS_TO_DB_LABEL = {
    'biogesic-para': 'Biogesic 500mg',
    'ritemed-para': 'RiteMed 500mg',
    'your-new-medicine': 'Your Medicine Name'  # Add here
}
```

3. **Insert into Database**:
```bash
sqlite3 assets/mediweb.db
```
```sql
INSERT INTO pills (...) VALUES (...);
```

4. **Retrain YOLO model** with new medicine images

---

## ✅ Verification Checklist

Before using the app, verify:

- [ ] Python dependencies installed
- [ ] Flask server running
- [ ] Browser opens `http://localhost:5000`
- [ ] TensorFlow.js loads (check console)
- [ ] Model loads successfully
- [ ] Camera permission granted (if using camera)
- [ ] Database accessible
- [ ] Both medicines in database

---

## 💡 Pro Tips

1. **Clear Images**: Use well-lit, clear images for best detection
2. **Check Console**: Browser DevTools shows detection logs
3. **Adjust Threshold**: Lower `scoreThreshold` for more detections
4. **Database First**: Always add to database before testing
5. **Test Incrementally**: Test camera, upload, and detection separately

---

## 🆘 Getting Help

### Check Logs:

**Browser Console** (F12):
```
Loading YOLO model from: /assets/model.json
YOLO model loaded successfully
Running YOLO detection on camera image...
Detections found: [...]
```

**Flask Terminal**:
```
127.0.0.1 - - [14/Nov/2025 10:30:00] "POST /api/predict HTTP/1.1" 200 -
```

### Common Issues:

**Issue**: "Model not found"
**Fix**: Check model path matches `/assets/model.json`

**Issue**: "No detections"
**Fix**: Lower threshold or improve image quality

**Issue**: "Database error"
**Fix**: Verify database exists and has correct schema

---

## 🎉 You're Ready!

Your MediWeb application is now fully configured with:

✅ TensorFlow.js YOLO detection
✅ Camera and file upload support
✅ SQLite database integration
✅ Comprehensive medicine information
✅ Beautiful UI with bounding boxes

**Start the server and try scanning a medicine!**

```bash
python app.py
# → Open http://localhost:5000
```

---

**Questions?** Check the full documentation in [README.md](README.md)

**Found a bug?** Check [INTEGRATION_SUMMARY.md](INTEGRATION_SUMMARY.md) for troubleshooting
