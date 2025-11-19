#!/usr/bin/env python3
"""
MedEye Flask Backend
Handles API endpoints for medicine detection and information retrieval
"""


import sqlite3
import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for API requests

# Enable compression for responses (reduces model file transfer size by ~70%)
try:
    from flask_compress import Compress
    compress = Compress()
    compress.init_app(app)
    app.config['COMPRESS_MIMETYPES'] = [
        'text/html',
        'text/css',
        'text/javascript',
        'application/javascript',
        'application/json',
        'application/octet-stream',  # For .bin model files
    ]
    app.config['COMPRESS_LEVEL'] = 6  # Balance between speed and compression (1-9)
    app.config['COMPRESS_MIN_SIZE'] = 500  # Only compress files > 500 bytes
    print('[Compression] Flask-Compress enabled successfully')
except ImportError:
    print('[Compression] Flask-Compress not installed. Run: pip install flask-compress')
    print('[Compression] Continuing without compression (model files will be larger)')
    compress = None

# Database configuration
DATABASE_PATH = os.path.join(app.root_path, 'assets', 'mediweb.db')

# Initialize database with optimizations
def init_db():
    """Initialize database with performance optimizations"""
    conn = sqlite3.connect(DATABASE_PATH)
    # Enable Write-Ahead Logging for better concurrency
    conn.execute('PRAGMA journal_mode=WAL')
    # Increase cache size (10MB)
    conn.execute('PRAGMA cache_size=-10000')
    # Use memory for temp storage
    conn.execute('PRAGMA temp_store=MEMORY')
    conn.close()

# Run database initialization
with app.app_context():
    init_db()

# Mapping from YOLO class labels to database Pill_Label
CLASS_TO_DB_LABEL = {
    'alaxan_fr': 'Alaxan FR Capsule',
    'biogesic-para': 'Biogesic 500mg',
    'cetirizine': 'Cetirizine HCl 10 mg Film-Coated Tablet',
    'fern-c': 'Fern-C (500 mg Sodium Ascorbate or ascorbic acid) capsule',
    'ibuprofen-advil': 'Advil – Ibuprofen 200 mg (coated tablet)',
    'kremil-s': 'Kremil-S chewable tablet',
    'loperamide diatabs': 'Diatabs (Loperamide) — 2 mg capsule',
    'ritemed-para': 'RiteMed 500mg',
    'unilab-enervon': 'Enervon Z+ Multivitamins Tablet',
    'unliab-bioflu': 'Bioflu 10mg/2mg/500mg'
}

# In-memory cache for medicine information
MEDICINE_CACHE = {}


def get_db_connection():
    """Create a database connection"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    return conn


def calculate_personalized_dosage(generic_name, age):
    """
    Calculate personalized dosage based on age using decision tree logic

    Args:
        generic_name: Generic name of the medicine (e.g., 'Paracetamol')
        age: Age of the user in years

    Returns:
        String with personalized dosage recommendation
    """
    generic_lower = generic_name.lower()

    # Decision tree for Paracetamol dosage based on age
    if generic_lower == 'paracetamol':
        if age < 2:
            return (
                "⚠️ CONSULT A DOCTOR: For infants under 2 years, "
                "paracetamol dosage must be determined by a healthcare professional "
                "based on weight and specific medical condition. Do not self-medicate."
            )
        elif age < 6:
            return (
                "Children 2-5 years: Typically 120-240 mg (liquid formulation recommended). "
                "Dosage should be based on body weight (10-15 mg/kg every 4-6 hours). "
                "Maximum 4 doses in 24 hours. Please consult a pediatrician for exact dosing."
            )
        elif age < 12:
            return (
                "Children 6-11 years: Typically 240-480 mg every 4-6 hours. "
                "For 500mg tablets: ½ to 1 tablet every 4-6 hours. "
                "Do not exceed 2,400 mg (approximately 5 tablets of 500mg) in 24 hours. "
                "Consult a healthcare provider if symptoms persist."
            )
        elif age < 18:
            return (
                "Adolescents 12-17 years: 1 to 2 tablets of 500mg every 4-6 hours as needed. "
                "Maximum dose: 4,000 mg (8 tablets of 500mg) in 24 hours. "
                "Maintain at least 4 hours between doses. Take with food if stomach upset occurs."
            )
        elif age < 65:
            return (
                "Adults 18-64 years: 1 to 2 tablets of 500mg every 4-6 hours as needed for pain or fever. "
                "Maximum dose: 4,000 mg (8 tablets of 500mg) in 24 hours. "
                "Do not take more than recommended. Can be taken with or without food."
            )
        else:
            return (
                "Seniors 65+ years: 1 to 2 tablets of 500mg every 4-6 hours. "
                "Maximum dose: 3,000 mg (6 tablets of 500mg) in 24 hours recommended for elderly. "
                "Start with lower dose if you have liver or kidney issues. "
                "Consult your doctor, especially if taking other medications."
            )

    # Ibuprofen + Paracetamol (Alaxan FR)
    elif 'ibuprofen' in generic_lower and 'paracetamol' in generic_lower:
        if age < 12:
            return "⚠️ NOT RECOMMENDED for children under 12 years. Consult a physician for appropriate dosage."
        elif age < 18:
            return "Adolescents 12-17 years: 1 capsule every 6-8 hours as needed. Do not exceed 6 capsules in 24 hours."
        elif age < 65:
            return "Adults 18-64 years: 1-2 capsules every 6-8 hours as needed. Maximum: 6 capsules in 24 hours. Take with food to reduce stomach irritation."
        else:
            return "Seniors 65+ years: Start with 1 capsule every 6-8 hours. Maximum: 4 capsules in 24 hours. Use with caution if you have kidney issues."

    # Ibuprofen (Advil)
    elif generic_lower == 'ibuprofen':
        if age < 12:
            return "⚠️ NOT RECOMMENDED in this tablet form for children under 12 years. Use pediatric suspension or consult a doctor."
        elif age < 18:
            return "Adolescents 12-17 years: 1-2 tablets (200 mg each) every 4-6 hours as needed. Maximum: 1,200 mg (6 tablets) in 24 hours."
        elif age < 65:
            return "Adults 18-64 years: 1-2 tablets (200 mg each) every 4-6 hours as needed. Maximum: 1,200 mg (6 tablets) in 24 hours for OTC use."
        else:
            return "Seniors 65+ years: Start with 1 tablet every 4-6 hours. Use lowest effective dose. Consult doctor if you have heart, kidney, or stomach issues."

    # Cetirizine (antihistamine)
    elif 'cetirizine' in generic_lower:
        if age < 12:
            return "⚠️ Children under 12 years: Dosage must be determined by a healthcare professional based on age and weight."
        elif age < 65:
            return "Adults & Children 12+ years: 1 tablet (10 mg) once daily. Take with or without food. May cause mild drowsiness."
        else:
            return "Seniors 65+ years: 1 tablet (10 mg) once daily. Use with caution if you have kidney problems; dose adjustment may be needed. Consult your doctor."

    # Sodium Ascorbate / Vitamin C (Fern-C)
    elif 'sodium ascorbate' in generic_lower or 'ascorbic acid' in generic_lower:
        if age < 12:
            return "Children under 12 years: Consult a pediatrician for appropriate Vitamin C dosage based on age and dietary needs."
        elif age < 18:
            return "Adolescents 12-17 years: 1 capsule (500 mg) daily. May be increased to 3-4 capsules during illness as advised by healthcare provider."
        elif age < 65:
            return "Adults 18-64 years: 1 capsule (500 mg) daily for maintenance. May increase to 3-4 capsules during illness or stress. Take with food if stomach upset occurs."
        else:
            return "Seniors 65+ years: 1 capsule (500 mg) daily. Safe for long-term use. Non-acidic formulation is gentle on the stomach."

    # Antacid (Kremil-S)
    elif 'aluminum hydroxide' in generic_lower or 'magnesium hydroxide' in generic_lower:
        if age < 12:
            return "⚠️ NOT RECOMMENDED for children. Consult a pediatrician for appropriate antacid treatment."
        elif age < 65:
            return "Adults 12-64 years: Chew 1-2 tablets one hour after each meal and at bedtime. Maximum: 8 tablets per day. Do not use long-term without medical advice."
        else:
            return "Seniors 65+ years: Chew 1 tablet after meals and at bedtime. Use with caution if you have kidney problems. Consult your doctor for long-term use."

    # Loperamide (Diatabs - antidiarrheal)
    elif 'loperamide' in generic_lower:
        if age < 12:
            return "⚠️ NOT RECOMMENDED for children under 12 years. Use pediatric formulations or consult a doctor."
        elif age < 65:
            return "Adults & Children 12+ years: Take 2 capsules initially, then 1 capsule after each loose stool. Maximum: 8 capsules (16 mg) per day. Ensure adequate hydration with ORS."
        else:
            return "Seniors 65+ years: Take 2 capsules initially, then 1 after each loose stool. Maximum: 6 capsules per day. Stop if no improvement after 2 days and consult doctor. Maintain hydration."

    # Multivitamins (Enervon)
    elif 'multivitamin' in generic_lower or 'vitamin b-complex' in generic_lower:
        if age < 12:
            return "⚠️ This adult formulation is not recommended for children under 12 years. Use pediatric multivitamin formulations."
        elif age < 65:
            return "Adults & Adolescents 12+ years: 1 tablet daily with or without food. Best taken at the same time each day for consistent nutrient levels."
        else:
            return "Seniors 65+ years: 1 tablet daily. Safe for long-term use. Consult your doctor if taking other medications to avoid interactions."

    # Phenylephrine combination (Bioflu - flu medication)
    elif 'phenylephrine' in generic_lower:
        if age < 12:
            return "⚠️ NOT RECOMMENDED for children under 12 years. Use pediatric Bioflu syrup with appropriate dosing for age/weight."
        elif age < 65:
            return "Adults & Children 12+ years: 1 tablet every 6 hours. Do NOT exceed 4 tablets in 24 hours. Avoid if you have high blood pressure. May cause drowsiness."
        else:
            return "Seniors 65+ years: 1 tablet every 6 hours. Maximum: 3 tablets in 24 hours. Use with caution if you have heart disease or hypertension. Consult your doctor."

    else:
        return (
            f"Age-based dosage for {generic_name} is not available in our system. "
            "Please consult the medicine packaging or a healthcare professional."
        )


def get_medicine_info(pill_label):
    """
    Fetch medicine information from database by Pill_Label
    Uses in-memory cache to avoid repeated database queries

    Args:
        pill_label: The pill label from database (e.g., 'Biogesic 500mg')

    Returns:
        Dictionary with medicine information or None if not found
    """
    # Check cache first
    if pill_label in MEDICINE_CACHE:
        return MEDICINE_CACHE[pill_label]

    # Not in cache, query database
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM pills WHERE Pill_Label = ?",
        (pill_label,)
    )

    row = cursor.fetchone()
    conn.close()

    if row:
        medicine_info = {
            'id': row['ID'],
            'name': f"{row['Brand_Name']} ({row['Generic_Name']})",
            'pillLabel': row['Pill_Label'],
            'genericName': row['Generic_Name'],
            'brandName': row['Brand_Name'],
            'manufacturer': row['Manufacturer'],
            'medicalUse': row['Medical_Use'],
            'dosageGuidelines': row['Dosage_Guidelines'],
            'warnings': row['Warnings'],
            'additionalInfo': row['Additional_Info'],
            'prescriptionRequired': bool(row['Prescription_Req']),
            'legalStatus': row['Legal_Status']
        }
        # Cache the result
        MEDICINE_CACHE[pill_label] = medicine_info
        return medicine_info

    return None


@app.route('/')
def index():
    """Render home page"""
    return render_template('index.html')


@app.route('/scan')
def scan():
    """Render scan page"""
    return render_template('scan.html')


@app.route('/about')
def about():
    """Render about page"""
    return render_template('about.html')


@app.route('/results')
def results():
    """Render results page"""
    return render_template('results.html')


@app.route('/api/predict', methods=['POST'])
def predict():
    """
    API endpoint to receive detection results and return medicine information

    Expected JSON payload:
    {
        "detections": [
            {
                "medicine": "biogesic-para",
                "confidence": 0.95,
                "bbox": {"x": 100, "y": 200, "width": 300, "height": 400}
            }
        ],
        "image": "base64_encoded_image_data",
        "age": 25,
        "timestamp": "2025-11-14T10:30:00.000Z"
    }
    """
    try:
        data = request.get_json()

        if not data or 'detections' not in data:
            return jsonify({
                'error': 'Invalid request. Missing detections data.'
            }), 400

        detections = data.get('detections', [])
        user_age = data.get('age')

        # If no detections found
        if len(detections) == 0:
            return jsonify({
                'medicine': 'No Medicine Detected',
                'usage': 'No medicine was detected in the image. '
                         'Please try again with a clearer image.',
                'sideEffects': 'N/A',
                'misconceptions': 'Ensure the medicine packaging is clearly '
                                  'visible and well-lit for better detection '
                                  'accuracy.'
            })

        # Get the detection with highest confidence
        primary_detection = max(
            detections, key=lambda x: x.get('confidence', 0))
        medicine_key = primary_detection.get('medicine', '').lower()

        # Map YOLO class label to database Pill_Label
        pill_label = CLASS_TO_DB_LABEL.get(medicine_key)

        if pill_label:
            # Fetch medicine info from database
            medicine_info = get_medicine_info(pill_label)

            if medicine_info:
                # Calculate personalized dosage if age is provided
                personalized_dosage = None
                if user_age is not None:
                    personalized_dosage = calculate_personalized_dosage(
                        medicine_info['genericName'],
                        user_age
                    )

                response = {
                    'medicine': medicine_info['name'],
                    'pillLabel': medicine_info['pillLabel'],
                    'genericName': medicine_info['genericName'],
                    'brandName': medicine_info['brandName'],
                    'manufacturer': medicine_info['manufacturer'],
                    'usage': medicine_info['medicalUse'],
                    'dosage': medicine_info['dosageGuidelines'],
                    'personalizedDosage': personalized_dosage,
                    'userAge': user_age,
                    'sideEffects': medicine_info['warnings'],
                    'misconceptions': medicine_info['additionalInfo'],
                    'prescriptionRequired': medicine_info['prescriptionRequired'],
                    'legalStatus': medicine_info['legalStatus'],
                    'confidence': primary_detection.get('confidence', 0),
                    'detectionCount': len(detections),
                    'timestamp': datetime.now().isoformat()
                }
                return jsonify(response)

        # Unknown medicine detected or not in database
        response = {
            'medicine': f'Detected: {medicine_key}',
            'usage': 'Information not available for this medicine. '
                     'Please consult a healthcare professional or pharmacist.',
            'sideEffects': 'Please refer to the medicine packaging or '
                           'consult a healthcare professional.',
            'misconceptions': 'Always read medicine labels carefully and '
                              'follow prescribed dosages.',
            'confidence': primary_detection.get('confidence', 0),
            'detectionCount': len(detections),
            'timestamp': datetime.now().isoformat()
        }

        return jsonify(response)

    except (ValueError, KeyError, TypeError) as e:
        app.logger.error('Error in /api/predict: %s', str(e))
        return jsonify({
            'error': 'An error occurred while processing the request.',
            'details': str(e)
        }), 500


@app.route('/api/medicines', methods=['GET'])
def get_medicines():
    """
    Get list of all medicines in the database
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT ID, Pill_Label, Brand_Name, Generic_Name FROM pills")
    rows = cursor.fetchall()
    conn.close()

    medicines = []
    for row in rows:
        medicines.append({
            'id': row['ID'],
            'pillLabel': row['Pill_Label'],
            'brandName': row['Brand_Name'],
            'genericName': row['Generic_Name'],
            'displayName': f"{row['Brand_Name']} ({row['Generic_Name']})"
        })

    return jsonify(medicines)


@app.route('/api/medicine/<int:medicine_id>', methods=['GET'])
def get_medicine_by_id(medicine_id):
    """
    Get detailed information about a specific medicine by ID
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM pills WHERE ID = ?", (medicine_id,))
    row = cursor.fetchone()
    conn.close()

    if row:
        return jsonify({
            'id': row['ID'],
            'name': f"{row['Brand_Name']} ({row['Generic_Name']})",
            'pillLabel': row['Pill_Label'],
            'genericName': row['Generic_Name'],
            'brandName': row['Brand_Name'],
            'manufacturer': row['Manufacturer'],
            'medicalUse': row['Medical_Use'],
            'dosageGuidelines': row['Dosage_Guidelines'],
            'warnings': row['Warnings'],
            'additionalInfo': row['Additional_Info'],
            'prescriptionRequired': bool(row['Prescription_Req']),
            'legalStatus': row['Legal_Status']
        })

    return jsonify({
        'error': 'Medicine not found'
    }), 404


if __name__ == '__main__':
    # For development only - use a proper WSGI server for production
    # Railway (and other cloud platforms) provide PORT via environment variable
    import os
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    app.run(debug=debug, host='0.0.0.0', port=port)
