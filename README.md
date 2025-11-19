# MedEye - Medicine Detection Web Application

A web application that uses TensorFlow.js and YOLO object detection to identify medicines from images captured via webcam or uploaded files.

## Features

- **Real-time Medicine Detection**: Uses YOLO model to detect medicines in images
- **Webcam Support**: Capture medicine images directly from your camera
- **File Upload**: Upload existing medicine images for detection
- **Bounding Box Visualization**: See detected medicines with labeled bounding boxes
- **Medicine Information**: Get detailed information about detected medicines including:
  - Usage and Dosage
  - Side Effects
  - Common Misconceptions
- **Backend API**: Flask backend for medicine information retrieval

## Detected Medicines

Currently supports:
- Biogesic (Paracetamol)
- Ritemed Paracetamol

## Installation

### Prerequisites

- Python 3.8 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Setup Instructions

1. **Install Python Dependencies**

```bash
pip install -r requirements.txt
```

2. **Start the Flask Backend**

```bash
python app.py
```

The backend will start on `http://localhost:5000`

3. **Access the Application**

Open your browser and navigate to:
```
http://localhost:5000
```

## Project Structure

```
MediWeb/
├── app.py                      # Flask backend server
├── requirements.txt            # Python dependencies
├── assets/
│   └── model.json             # TensorFlow.js YOLO model
├── static/
│   ├── css/
│   │   ├── style.css          # Global styles
│   │   ├── index.css          # Home page styles
│   │   ├── scan.css           # Scan page styles
│   │   ├── results.css        # Results page styles
│   │   └── about.css          # About page styles
│   └── js/
│       └── main.js            # Main JavaScript (includes YOLO detection)
└── templates/
    ├── index.html             # Home page
    ├── scan.html              # Scan/detection page
    ├── results.html           # Results display page
    └── about.html             # About page
```

## How It Works

### Frontend (TensorFlow.js YOLO Detection)

1. **Model Loading**: The YOLO model is loaded from `/assets/model.json` using TensorFlow.js
2. **Image Capture**: User captures image via webcam or uploads a file
3. **Preprocessing**: Image is resized to 640x640 and normalized
4. **Detection**: YOLO model runs inference to detect medicines
5. **Post-processing**: Non-Maximum Suppression (NMS) filters overlapping detections
6. **Visualization**: Bounding boxes are drawn on the image with labels
7. **Backend Communication**: Detection results are sent to Flask backend
8. **Results Display**: Medicine information is displayed on results page

### Backend (Flask API)

- **`GET /`**: Home page
- **`GET /scan`**: Scan page
- **`GET /results`**: Results page
- **`POST /api/predict`**: Receives detection data and returns medicine information
- **`GET /api/medicines`**: Lists all available medicines
- **`GET /api/medicine/<id>`**: Gets detailed info for specific medicine

## Configuration

### Model Configuration (static/js/main.js)

```javascript
const MODEL_CONFIG = {
    modelUrl: '/assets/model.json',
    inputSize: 640,              // YOLO input size
    scoreThreshold: 0.25,        // Minimum confidence threshold
    iouThreshold: 0.45,          // NMS IoU threshold
    maxDetections: 100           // Maximum detections to return
};
```

### Class Labels (static/js/main.js)

```javascript
const CLASS_LABELS = [
    'biogesic-para',
    'ritemed-para'
];
```

Update this array to match your YOLO model's training classes.

### Medicine Database (app.py)

Add new medicines to the `MEDICINE_DATABASE` dictionary:

```python
MEDICINE_DATABASE = {
    'medicine-id': {
        'name': 'Medicine Display Name',
        'usage': 'Usage and dosage information...',
        'sideEffects': 'Side effects information...',
        'misconceptions': 'Common misconceptions...'
    }
}
```

## Usage

### Using Webcam

1. Navigate to the Scan page
2. Click "Open Camera"
3. Allow camera permissions
4. Position the medicine in view
5. Click "Capture"
6. Wait for detection and view results

### Uploading Image

1. Navigate to the Scan page
2. Click "Choose File" under Upload Image
3. Select a medicine image
4. Click "Scan"
5. Wait for detection and view results

## API Endpoints

### POST /api/predict

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

**Response:**
```json
{
    "medicine": "Biogesic (Paracetamol)",
    "usage": "Used for relief of fever and mild to moderate pain...",
    "sideEffects": "Generally well-tolerated...",
    "misconceptions": "MISCONCEPTION: ...",
    "confidence": 0.95,
    "detectionCount": 1,
    "timestamp": "2025-11-14T10:30:00.000Z"
}
```

## Technical Details

### TensorFlow.js Model

- **Format**: TensorFlow.js Graph Model
- **Input**: 640x640x3 RGB image
- **Output**: Detections with bounding boxes, scores, and class IDs
- **Framework**: Converted from TensorFlow 2.19.0

### Detection Pipeline

1. **Image Preprocessing**: Resize to 640x640, normalize to [0,1]
2. **Model Inference**: Run YOLO detection
3. **Post-processing**:
   - Filter detections by confidence threshold (0.25)
   - Apply Non-Maximum Suppression (IoU threshold 0.45)
   - Map class IDs to medicine names
4. **Visualization**: Draw bounding boxes with labels
5. **Result Storage**: Store in sessionStorage for results page

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### Camera Not Working

- Ensure camera permissions are granted
- Check if another application is using the camera
- Try a different browser
- Use HTTPS (required for camera access in production)

### Model Loading Errors

- Check that `/assets/model.json` exists
- Verify model path in `MODEL_CONFIG.modelUrl`
- Check browser console for detailed error messages
- Ensure TensorFlow.js CDN is accessible

### Detection Issues

- Use clear, well-lit images
- Ensure medicine packaging is visible
- Adjust `scoreThreshold` if too sensitive/insensitive
- Check that class labels match your model's training

### Backend Connection Errors

- Verify Flask server is running
- Check that backend is accessible at `http://localhost:5000`
- Review CORS settings if accessing from different origin
- Check browser console and Flask logs for errors

## Development

### Modifying Detection Parameters

Edit `MODEL_CONFIG` in [static/js/main.js](static/js/main.js:6-12):

```javascript
const MODEL_CONFIG = {
    scoreThreshold: 0.25,  // Lower = more detections (less strict)
    iouThreshold: 0.45,    // Lower = fewer overlapping boxes
    maxDetections: 100     // Maximum number of detections
};
```

### Adding New Medicines

1. Update `CLASS_LABELS` array in [static/js/main.js](static/js/main.js:15-18)
2. Add medicine info to `MEDICINE_DATABASE` in [app.py](app.py:19-42)
3. Retrain YOLO model with new medicine images

## Security Notes

- This is a development setup - use a production WSGI server (gunicorn, uWSGI) for production
- Implement rate limiting for API endpoints
- Add authentication if needed
- Validate and sanitize all user inputs
- Use HTTPS in production
- Consider adding CSRF protection

## License

For educational purposes only. Always consult healthcare professionals for medical advice.

## Disclaimer

**IMPORTANT**: This application is for informational purposes only. Always consult a qualified healthcare professional or pharmacist before taking any medication. The information provided may not be complete or up-to-date.

## Credits

Developed by Aries Ivan Garibay

## Support

For issues or questions, please check the browser console and Flask logs for error messages.
