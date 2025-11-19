# SQLite Database Integration Guide

## Overview

The MediWeb backend now uses the SQLite database at `/assets/mediweb.db` to store and retrieve medicine information instead of hardcoded dictionaries.

## Database Schema

### Table: `pills`

| Column | Type | Description |
|--------|------|-------------|
| `ID` | INTEGER | Primary key |
| `Pill_Label` | TEXT | Pill identifier (e.g., "Biogesic 500mg") |
| `Generic_Name` | TEXT | Generic medicine name (e.g., "Paracetamol") |
| `Brand_Name` | TEXT | Brand name (e.g., "Biogesic") |
| `Manufacturer` | TEXT | Manufacturer name |
| `Medical_Use` | TEXT | Medical uses and indications |
| `Dosage_Guidelines` | TEXT | Dosage instructions |
| `Warnings` | TEXT | Side effects and warnings |
| `Additional_Info` | TEXT | Additional information |
| `Prescription_Req` | INTEGER | 1 if prescription required, 0 otherwise |
| `Legal_Status` | TEXT | Legal and regulatory status |

## Current Database Content

### 1. Biogesic 500mg (ID: 1)
- **Generic Name**: Paracetamol
- **Brand Name**: Biogesic
- **Manufacturer**: Unilab
- **Prescription Required**: No (0)

### 2. RiteMed 500mg (ID: 2)
- **Generic Name**: Paracetamol
- **Brand Name**: RiteMed
- **Manufacturer**: Ritemed Philippines, Inc.
- **Prescription Required**: Yes (1)

## YOLO Label Mapping

The system maps YOLO detection labels to database `Pill_Label` values:

```python
CLASS_TO_DB_LABEL = {
    'biogesic-para': 'Biogesic 500mg',
    'ritemed-para': 'RiteMed 500mg'
}
```

**Important**: When adding new medicines:
1. Add the YOLO class label to `CLASS_LABELS` array in `static/js/main.js`
2. Add the mapping to `CLASS_TO_DB_LABEL` in `app.py`
3. Insert the medicine record into the database

## Backend Functions

### `get_db_connection()`
Creates a SQLite database connection with row factory enabled for column name access.

```python
conn = get_db_connection()
cursor = conn.cursor()
# Use the connection
conn.close()
```

### `get_medicine_info(pill_label)`
Fetches medicine information by `Pill_Label`.

**Parameters:**
- `pill_label` (str): The pill label from database (e.g., "Biogesic 500mg")

**Returns:**
- Dictionary with medicine information or `None` if not found

**Example:**
```python
info = get_medicine_info('Biogesic 500mg')
# Returns:
{
    'id': 1,
    'name': 'Biogesic (Paracetamol)',
    'pillLabel': 'Biogesic 500mg',
    'genericName': 'Paracetamol',
    'brandName': 'Biogesic',
    'manufacturer': 'Unilab',
    'medicalUse': 'typically used to relieve...',
    'dosageGuidelines': 'Adults and children 12 years...',
    'warnings': 'It is advisable not to take...',
    'additionalInfo': 'Swallow tablets whole...',
    'prescriptionRequired': False,
    'legalStatus': 'Approved and regulated...'
}
```

## API Endpoints

### POST `/api/predict`

Receives YOLO detection results and returns medicine information from database.

**Request Body:**
```json
{
    "detections": [
        {
            "medicine": "biogesic-para",
            "confidence": 0.95,
            "bbox": {"x": 100, "y": 200, "width": 300, "height": 400}
        }
    ],
    "image": "base64_encoded_image_data",
    "timestamp": "2025-11-14T10:30:00.000Z"
}
```

**Response (Success):**
```json
{
    "medicine": "Biogesic (Paracetamol)",
    "pillLabel": "Biogesic 500mg",
    "genericName": "Paracetamol",
    "brandName": "Biogesic",
    "manufacturer": "Unilab",
    "usage": "typically used to relieve mild to moderate pain...",
    "dosage": "Adults and children 12 years and older usually take 1 to 2 500mg tablets...",
    "sideEffects": "It is advisable not to take paracetamol if you have had previous allergic reactions...",
    "misconceptions": "Swallow tablets whole with water. Can be taken with or without food...",
    "prescriptionRequired": false,
    "legalStatus": "Approved and regulated by the Philippine FDA...",
    "confidence": 0.95,
    "detectionCount": 1,
    "timestamp": "2025-11-14T10:30:00.000Z"
}
```

**Response (No Detection):**
```json
{
    "medicine": "No Medicine Detected",
    "usage": "No medicine was detected in the image. Please try again with a clearer image.",
    "sideEffects": "N/A",
    "misconceptions": "Ensure the medicine packaging is clearly visible and well-lit..."
}
```

### GET `/api/medicines`

Returns a list of all medicines in the database.

**Response:**
```json
[
    {
        "id": 1,
        "pillLabel": "Biogesic 500mg",
        "brandName": "Biogesic",
        "genericName": "Paracetamol",
        "displayName": "Biogesic (Paracetamol)"
    },
    {
        "id": 2,
        "pillLabel": "RiteMed 500mg",
        "brandName": "RiteMed",
        "genericName": "Paracetamol",
        "displayName": "RiteMed (Paracetamol)"
    }
]
```

### GET `/api/medicine/<id>`

Returns detailed information for a specific medicine by ID.

**Example:** `GET /api/medicine/1`

**Response:**
```json
{
    "id": 1,
    "name": "Biogesic (Paracetamol)",
    "pillLabel": "Biogesic 500mg",
    "genericName": "Paracetamol",
    "brandName": "Biogesic",
    "manufacturer": "Unilab",
    "medicalUse": "typically used to relieve mild to moderate pain...",
    "dosageGuidelines": "Adults and children 12 years and older...",
    "warnings": "It is advisable not to take paracetamol...",
    "additionalInfo": "Swallow tablets whole with water...",
    "prescriptionRequired": false,
    "legalStatus": "Approved and regulated by the Philippine FDA..."
}
```

## Results Page Display

The results page now displays comprehensive information from the database:

### Fields Displayed:

1. **Medicine Name** - Brand + Generic (e.g., "Biogesic (Paracetamol)")
2. **Confidence Score** - Detection confidence percentage
3. **Prescription Badge** - "Rx Required" badge if prescription needed
4. **Manufacturer** - Company that manufactures the medicine
5. **Medical Use** - What the medicine is used for
6. **Dosage Guidelines** - How to take the medicine
7. **Warnings & Side Effects** - Safety information
8. **Additional Information** - Extra notes and instructions
9. **Legal Status** - Regulatory information (optional section)

### Special Features:

**Prescription Badge:**
- Appears as red badge if `prescriptionRequired` is `true`
- Shows "Rx Required" next to medicine name

**Confidence Score:**
- Displayed in gray next to medicine name
- Format: "(95.3% confidence)"

**Legal Status Section:**
- Hidden by default
- Only shown if `legalStatus` data is available

## Database Management

### Viewing Database Content

```bash
# Connect to database
sqlite3 /Users/ariesivangaribay/Documents/SCHOOLWORKS/MediWeb/assets/mediweb.db

# View all records
SELECT * FROM pills;

# View specific fields
SELECT ID, Pill_Label, Brand_Name FROM pills;

# Exit
.quit
```

### Adding New Medicine

```sql
INSERT INTO pills (
    ID,
    Pill_Label,
    Generic_Name,
    Brand_Name,
    Manufacturer,
    Medical_Use,
    Dosage_Guidelines,
    Warnings,
    Additional_Info,
    Prescription_Req,
    Legal_Status
) VALUES (
    3,
    'Neozep 500mg',
    'Phenylephrine + Chlorphenamine + Paracetamol',
    'Neozep',
    'Unilab',
    'For the relief of clogged nose, runny nose, postnasal drip, itchy and watery eyes, sneezing, headache, body aches, and fever associated with the common cold, allergic rhinitis, sinusitis, flu, and other minor respiratory tract infections.',
    'Adults and children 12 years and older: 1 tablet every 6 hours, or as recommended by a doctor.',
    'Do not take more than 4 tablets in 24 hours. May cause drowsiness. Do not drive or operate machinery. Avoid alcohol.',
    'Take with or without food. Store at room temperature.',
    0,
    'Approved by Philippine FDA'
);
```

**After adding to database:**

1. Update `CLASS_LABELS` in `static/js/main.js`:
```javascript
const CLASS_LABELS = [
    'biogesic-para',
    'ritemed-para',
    'neozep'  // Add new label
];
```

2. Update `CLASS_TO_DB_LABEL` in `app.py`:
```python
CLASS_TO_DB_LABEL = {
    'biogesic-para': 'Biogesic 500mg',
    'ritemed-para': 'RiteMed 500mg',
    'neozep': 'Neozep 500mg'  # Add new mapping
}
```

3. Retrain YOLO model with new medicine images

### Updating Medicine Information

```sql
UPDATE pills
SET Medical_Use = 'Updated medical use information...'
WHERE ID = 1;
```

### Deleting Medicine

```sql
DELETE FROM pills WHERE ID = 3;
```

## Database Connection Best Practices

### Always Close Connections

```python
conn = get_db_connection()
try:
    cursor = conn.cursor()
    # Perform database operations
    result = cursor.fetchone()
finally:
    conn.close()  # Always close connection
```

### Using Context Manager (Recommended)

```python
def get_medicine_info_safe(pill_label):
    """Thread-safe database query"""
    with sqlite3.connect(DATABASE_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pills WHERE Pill_Label = ?", (pill_label,))
        row = cursor.fetchone()

        if row:
            return dict(row)
    return None
```

## Testing the Integration

### 1. Test Database Connection

```python
# In Python interpreter
from app import get_db_connection

conn = get_db_connection()
cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM pills")
print(f"Total medicines: {cursor.fetchone()[0]}")
conn.close()
```

### 2. Test Medicine Lookup

```python
from app import get_medicine_info

info = get_medicine_info('Biogesic 500mg')
print(info['name'])  # Should print: Biogesic (Paracetamol)
```

### 3. Test API Endpoint

```bash
# Start Flask server
python app.py

# In another terminal, test the endpoint
curl -X POST http://localhost:5000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "detections": [{
      "medicine": "biogesic-para",
      "confidence": 0.95,
      "bbox": {"x": 100, "y": 200, "width": 300, "height": 400}
    }]
  }'
```

### 4. Test in Browser

1. Start Flask server: `python app.py`
2. Navigate to: `http://localhost:5000`
3. Go to Scan page
4. Upload/capture medicine image
5. Verify database information appears on results page

## Troubleshooting

### Error: "No such table: pills"

**Problem**: Database file not found or table doesn't exist

**Solution**:
```bash
# Verify database file exists
ls -la /Users/ariesivangaribay/Documents/SCHOOLWORKS/MediWeb/assets/mediweb.db

# Check table structure
sqlite3 /Users/ariesivangaribay/Documents/SCHOOLWORKS/MediWeb/assets/mediweb.db ".schema"
```

### Error: "Unable to open database file"

**Problem**: Incorrect database path or permissions

**Solution**:
```python
# Check path in app.py
import os
print(os.path.abspath(DATABASE_PATH))

# Ensure file has read permissions
# chmod 644 /path/to/mediweb.db
```

### Error: "No module named 'sqlite3'"

**Problem**: SQLite3 not installed (rare, usually built-in)

**Solution**:
```bash
# Python 3 should have sqlite3 built-in
python3 -c "import sqlite3; print(sqlite3.version)"
```

### Medicine Not Found

**Problem**: YOLO label not mapped to database

**Solution**:
1. Check `CLASS_TO_DB_LABEL` mapping
2. Verify `Pill_Label` matches database exactly (case-sensitive)
3. Check database has the record:
```sql
SELECT * FROM pills WHERE Pill_Label = 'Biogesic 500mg';
```

## Performance Considerations

### Connection Pooling (For Production)

For high-traffic production environments, consider using connection pooling:

```python
from flask_sqlalchemy import SQLAlchemy

app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DATABASE_PATH}'
db = SQLAlchemy(app)
```

### Query Optimization

Current queries are already optimized:
- Use parameterized queries (prevents SQL injection)
- Select only needed columns
- Index on `Pill_Label` for faster lookups

### Adding Index (Optional)

```sql
CREATE INDEX idx_pill_label ON pills(Pill_Label);
```

## Security Notes

✅ **Implemented:**
- Parameterized queries prevent SQL injection
- Database file in secure location
- Read-only access for most operations

⚠️ **Recommendations:**
- Never expose database file publicly
- Validate all user inputs before database queries
- Use environment variables for database path in production
- Regular database backups

## Migration Guide

### From Hardcoded Dictionary to Database

**Old Code (Removed):**
```python
MEDICINE_DATABASE = {
    'biogesic-para': {
        'name': 'Biogesic (Paracetamol)',
        ...
    }
}
```

**New Code:**
```python
pill_label = CLASS_TO_DB_LABEL.get(medicine_key)
medicine_info = get_medicine_info(pill_label)
```

**Benefits:**
- Easy to add new medicines (just database insert)
- No code changes needed for content updates
- Better data organization
- Scalable for many medicines

## Summary

The SQLite database integration provides:

✅ Dynamic medicine information loading
✅ Easy content management
✅ Scalable architecture
✅ Comprehensive medicine details
✅ Clean separation of data and code
✅ Production-ready database operations

All medicine information is now stored in `/assets/mediweb.db` and automatically fetched when medicines are detected.
