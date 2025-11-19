// main.js – JS for all MedEye page interactivity

// ============================================
// YOLO Model Configuration
// ============================================
const MODEL_CONFIG = {
    modelUrl: '/static/model.json',
    inputSize: 640, // Standard YOLO input size
    scoreThreshold: 0.25,
    iouThreshold: 0.45,
    maxDetections: 100
};

// Medicine class labels - Exact labels from your YOLO model
const CLASS_LABELS = [
    'alaxan_fr',
    'biogesic-para',
    'cetirizine',
    'fern-c',
    'ibuprofen-advil',
    'kremil-s',
    'loperamide diatabs',
    'ritemed-para',
    'unilab-enervon',
    'unliab-bioflu'
];

// Global model variable
let yoloModel = null;
let isModelLoading = false;
let modelLoadPromise = null;

// Web Worker for background inference (improves UI responsiveness)
let yoloWorker = null;
let useWebWorker = true; // Set to false to use main thread (fallback)

// Performance monitoring
const performanceMetrics = {
    modelLoadTime: 0,
    inferenceCount: 0,
    totalInferenceTime: 0,
    averageInferenceTime: 0,
    cachedResults: 0,
    workerUsage: 0
};

// Detection cache (prevents re-detecting same images)
const detectionCache = new Map();
const MAX_CACHE_SIZE = 10;

// ============================================
// YOLO Model Loading and Detection
// ============================================

/**
 * Initialize Web Worker for YOLO inference
 */
function initYOLOWorker() {
    if (!useWebWorker || !window.Worker) {
        console.log('[Worker] Web Workers not supported or disabled, using main thread');
        useWebWorker = false;
        return null;
    }

    try {
        yoloWorker = new Worker('/static/js/yolo-worker.js');

        yoloWorker.addEventListener('message', (event) => {
            const { type, progress, success, message } = event.data;

            switch (type) {
                case 'progress':
                    console.log(`[Worker] Model loading: ${progress}%`);
                    updateModelStatus(false, progress);
                    break;

                case 'loaded':
                    if (success) {
                        console.log('[Worker] Model loaded successfully');
                        updateModelStatus(true, 100);
                    } else {
                        console.error('[Worker] Model loading failed:', message);
                        updateModelStatus(false, 0, true);
                    }
                    break;

                case 'status':
                    console.log('[Worker] Status:', event.data);
                    break;

                default:
                    // Handle other message types in specific contexts
                    break;
            }
        });

        yoloWorker.addEventListener('error', (error) => {
            console.error('[Worker] Error:', error);
            useWebWorker = false;
            yoloWorker = null;
        });

        console.log('[Worker] YOLO Worker initialized');
        return yoloWorker;
    } catch (error) {
        console.error('[Worker] Failed to initialize:', error);
        useWebWorker = false;
        return null;
    }
}

/**
 * Load the TensorFlow.js YOLO model with progress tracking
 */
async function loadYOLOModel() {
    if (yoloModel) return yoloModel;

    // If already loading, return the existing promise
    if (modelLoadPromise) {
        return modelLoadPromise;
    }

    try {
        isModelLoading = true;
        console.log('Loading YOLO model from:', MODEL_CONFIG.modelUrl);

        // Update status to show loading has started
        updateModelStatus(false, 0);

        // Create and store the load promise with progress tracking
        modelLoadPromise = tf.loadGraphModel(MODEL_CONFIG.modelUrl, {
            onProgress: (fraction) => {
                const percentage = Math.round(fraction * 100);
                console.log(`Model loading progress: ${percentage}%`);
                updateModelStatus(false, percentage);
            }
        });
        yoloModel = await modelLoadPromise;

        console.log('YOLO model loaded successfully');
        isModelLoading = false;
        updateModelStatus(true, 100);
        return yoloModel;
    } catch (error) {
        isModelLoading = false;
        modelLoadPromise = null;
        console.error('Error loading YOLO model:', error);
        updateModelStatus(false, 0, true);
        throw new Error('Failed to load YOLO model. Please check the model path.');
    }
}

/**
 * Preload model in background when page loads
 */
function preloadModel() {
    // Start loading model in background on scan page
    if (window.location.pathname === '/scan') {
        console.log('Preloading YOLO model in background...');

        // Try to use Web Worker first
        if (useWebWorker) {
            yoloWorker = initYOLOWorker();
            if (yoloWorker) {
                console.log('[Worker] Loading model in Web Worker...');
                yoloWorker.postMessage({ type: 'load' });
                return;
            }
        }

        // Fallback to main thread
        console.log('[Main Thread] Loading model...');
        loadYOLOModel().then(() => {
            console.log('Model preloaded successfully');
            updateModelStatus(true);
        }).catch(err => {
            console.error('Failed to preload model:', err);
            updateModelStatus(false);
        });
    }
}

/**
 * Update UI to show model loading status with progress
 * @param {boolean} isReady - Whether the model is ready
 * @param {number} progress - Loading progress (0-100)
 * @param {boolean} hasError - Whether an error occurred
 */
function updateModelStatus(isReady, progress = 0, hasError = false) {
    const statusIndicators = document.querySelectorAll('.model-status');
    statusIndicators.forEach(el => {
        if (hasError) {
            el.textContent = '❌ Model Loading Failed';
            el.className = 'model-status error';
            el.style.opacity = '1';
            el.style.display = 'block';
        } else if (isReady) {
            el.textContent = '✓ Model Ready';
            el.className = 'model-status ready';

            // Fade out after 3 seconds
            setTimeout(() => {
                el.style.opacity = '0';
                setTimeout(() => {
                    el.style.display = 'none';
                }, 500); // Wait for fade animation
            }, 3000);
        } else {
            // Show progress percentage
            if (progress > 0) {
                el.textContent = `⏳ Loading Model... ${progress}%`;
            } else {
                el.textContent = '⏳ Model Loading...';
            }
            el.className = 'model-status loading';
            el.style.opacity = '1';
            el.style.display = 'block';
        }
    });
}

/**
 * Preprocess image for YOLO input
 */
function preprocessImage(imageElement, inputSize) {
    return tf.tidy(() => {
        // Convert image to tensor
        let tensor = tf.browser.fromPixels(imageElement);

        // Resize to model input size
        tensor = tf.image.resizeBilinear(tensor, [inputSize, inputSize]);

        // Normalize to [0, 1]
        tensor = tensor.div(255.0);

        // Add batch dimension
        tensor = tensor.expandDims(0);

        return tensor;
    });
}

/**
 * Non-Maximum Suppression
 */
function nonMaxSuppression(boxes, scores, iouThreshold, maxDetections) {
    const selected = [];
    const indices = scores
        .map((score, idx) => ({ score, idx }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.idx);

    while (indices.length > 0 && selected.length < maxDetections) {
        const currentIdx = indices.shift();
        selected.push(currentIdx);

        const currentBox = boxes[currentIdx];

        indices.forEach((idx, i) => {
            const box = boxes[idx];
            const iou = calculateIoU(currentBox, box);
            if (iou > iouThreshold) {
                indices.splice(i, 1);
            }
        });
    }

    return selected;
}

/**
 * Calculate Intersection over Union
 */
function calculateIoU(box1, box2) {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const union = area1 + area2 - intersection;

    return intersection / union;
}

/**
 * Process YOLO model output
 * Handles YOLOv8 format: single output tensor [1, 6, 8400]
 * Format: [x, y, w, h, conf_class0, conf_class1, ...]
 */
async function processYOLOOutput(predictions, imgWidth, imgHeight) {
    console.log('Processing YOLO output...');

    // Handle single tensor output (YOLOv8 format)
    const outputTensor = Array.isArray(predictions) ? predictions[0] : predictions;
    const output = await outputTensor.array();

    console.log('Output shape:', outputTensor.shape);
    console.log('Output data sample:', output[0].slice(0, 3));

    const detections = [];

    // YOLOv8 output format: [batch, features, detections]
    // features = [x, y, w, h, class0_conf, class1_conf, ...]
    const numDetections = output[0][0].length; // 8400 in your model
    const numClasses = output[0].length - 4; // Total features minus box coordinates

    console.log(`Processing ${numDetections} detections with ${numClasses} classes`);

    // Transpose: convert from [features, detections] to [detections, features]
    for (let i = 0; i < numDetections; i++) {
        // Get box coordinates
        const x = output[0][0][i];
        const y = output[0][1][i];
        const w = output[0][2][i];
        const h = output[0][3][i];

        // Get class confidences (starting from index 4)
        let maxScore = 0;
        let maxClass = 0;

        for (let c = 0; c < numClasses; c++) {
            const score = output[0][4 + c][i];
            if (score > maxScore) {
                maxScore = score;
                maxClass = c;
            }
        }

        // Only keep detections above threshold
        if (maxScore > MODEL_CONFIG.scoreThreshold) {
            detections.push({
                x: (x - w / 2) * imgWidth,
                y: (y - h / 2) * imgHeight,
                width: w * imgWidth,
                height: h * imgHeight,
                score: maxScore,
                class: maxClass
            });
        }
    }

    console.log(`Found ${detections.length} detections above threshold`);

    // Apply NMS
    const boxes_nms = detections.map(d => ({
        x: d.x,
        y: d.y,
        width: d.width,
        height: d.height
    }));
    const scores_nms = detections.map(d => d.score);

    const selectedIndices = nonMaxSuppression(
        boxes_nms,
        scores_nms,
        MODEL_CONFIG.iouThreshold,
        MODEL_CONFIG.maxDetections
    );

    const finalDetections = selectedIndices.map(idx => detections[idx]);
    console.log(`After NMS: ${finalDetections.length} detections`);

    return finalDetections;
}

/**
 * Generate cache key from image
 */
function generateImageCacheKey(imageElement) {
    // Use image dimensions and src as a simple cache key
    const src = imageElement.src || '';
    const width = imageElement.width || imageElement.naturalWidth || 0;
    const height = imageElement.height || imageElement.naturalHeight || 0;
    return `${src.substring(0, 50)}_${width}x${height}`;
}

/**
 * Run YOLO detection on an image using Web Worker (if available) or main thread
 * Includes caching and performance monitoring
 */
async function detectMedicine(imageElement) {
    const startTime = performance.now();

    try {
        // Check cache first
        const cacheKey = generateImageCacheKey(imageElement);
        if (detectionCache.has(cacheKey)) {
            console.log('Using cached detection results');
            performanceMetrics.cachedResults++;
            return detectionCache.get(cacheKey);
        }

        let detections;

        // Use Web Worker if available and enabled
        if (useWebWorker && yoloWorker) {
            performanceMetrics.workerUsage++;
            detections = await detectMedicineWithWorker(imageElement);
        } else {
            // Fallback to main thread
            detections = await detectMedicineMainThread(imageElement);
        }

        // Cache the results
        if (detectionCache.size >= MAX_CACHE_SIZE) {
            // Remove oldest entry
            const firstKey = detectionCache.keys().next().value;
            detectionCache.delete(firstKey);
        }
        detectionCache.set(cacheKey, detections);

        // Update performance metrics
        const inferenceTime = performance.now() - startTime;
        performanceMetrics.inferenceCount++;
        performanceMetrics.totalInferenceTime += inferenceTime;
        performanceMetrics.averageInferenceTime =
            performanceMetrics.totalInferenceTime / performanceMetrics.inferenceCount;

        console.log(`Detection completed in ${inferenceTime.toFixed(0)}ms (avg: ${performanceMetrics.averageInferenceTime.toFixed(0)}ms)`);

        return detections;
    } catch (error) {
        console.error('Error during detection:', error);
        // If worker fails, try main thread as fallback
        if (useWebWorker && yoloWorker) {
            console.warn('Worker failed, falling back to main thread');
            useWebWorker = false;
            return await detectMedicineMainThread(imageElement);
        }
        throw error;
    }
}

/**
 * Run detection using Web Worker (background thread)
 */
async function detectMedicineWithWorker(imageElement) {
    return new Promise((resolve, reject) => {
        // Create canvas to get image data
        const canvas = document.createElement('canvas');
        canvas.width = imageElement.width || imageElement.naturalWidth;
        canvas.height = imageElement.height || imageElement.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageElement, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        console.log('[Worker] Sending inference request...');

        // Set up one-time message handler for this inference
        const handleResult = (event) => {
            if (event.data.type === 'result') {
                yoloWorker.removeEventListener('message', handleResult);

                if (event.data.success) {
                    console.log(`[Worker] Inference successful: ${event.data.detections.length} detections`);
                    resolve(event.data.detections);
                } else {
                    reject(new Error(event.data.error));
                }
            }
        };

        yoloWorker.addEventListener('message', handleResult);

        // Send inference request to worker
        yoloWorker.postMessage({
            type: 'infer',
            data: {
                imageData: imageData,
                width: canvas.width,
                height: canvas.height
            }
        });
    });
}

/**
 * Run detection on main thread (fallback)
 */
async function detectMedicineMainThread(imageElement) {
    // Load model if not already loaded
    const model = await loadYOLOModel();

    // Preprocess image
    const inputTensor = preprocessImage(imageElement, MODEL_CONFIG.inputSize);

    // Run inference
    const predictions = await model.predict(inputTensor);

    // Process output
    const detections = await processYOLOOutput(
        Array.isArray(predictions) ? predictions : [predictions],
        imageElement.width,
        imageElement.height
    );

    // Clean up tensors
    inputTensor.dispose();
    if (Array.isArray(predictions)) {
        predictions.forEach(p => p.dispose());
    } else {
        predictions.dispose();
    }

    return detections;
}

/**
 * Draw bounding boxes on canvas
 */
function drawBoundingBoxes(canvas, detections, originalWidth, originalHeight) {
    const ctx = canvas.getContext('2d');

    // Scale factors
    const scaleX = canvas.width / originalWidth;
    const scaleY = canvas.height / originalHeight;

    detections.forEach(detection => {
        const x = detection.x * scaleX;
        const y = detection.y * scaleY;
        const width = detection.width * scaleX;
        const height = detection.height * scaleY;

        // Draw box
        ctx.strokeStyle = '#4cc9b0';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Draw label background
        const className = CLASS_LABELS[detection.class] || `Class ${detection.class}`;
        const label = `${className} ${(detection.score * 100).toFixed(1)}%`;

        ctx.font = 'bold 16px Poppins, Arial';
        const textMetrics = ctx.measureText(label);
        const textHeight = 20;

        ctx.fillStyle = '#4cc9b0';
        ctx.fillRect(x, y - textHeight - 4, textMetrics.width + 10, textHeight + 4);

        // Draw label text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, x + 5, y - 8);
    });
}

/**
 * Show scanning progress modal with animated steps
 */
function showScanningModal() {
    const modal = document.getElementById('scanningModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Reset all steps
        const steps = modal.querySelectorAll('.step');
        steps.forEach(step => {
            step.classList.remove('active', 'completed');
        });
    }
}

/**
 * Update scanning progress step
 */
function updateScanningStep(stepNumber) {
    const currentStep = document.getElementById(`step${stepNumber}`);
    if (currentStep) {
        // Mark previous steps as completed
        for (let i = 1; i < stepNumber; i++) {
            const prevStep = document.getElementById(`step${i}`);
            if (prevStep) {
                prevStep.classList.remove('active');
                prevStep.classList.add('completed');
            }
        }
        // Mark current step as active
        currentStep.classList.add('active');
    }
}

/**
 * Hide scanning modal with completion animation
 */
async function hideScanningModal() {
    const modal = document.getElementById('scanningModal');
    if (modal) {
        const steps = modal.querySelectorAll('.step');
        const title = document.getElementById('scanningTitle');

        // Mark all steps as completed with animation
        for (let i = 0; i < steps.length; i++) {
            steps[i].classList.remove('active');
            steps[i].classList.add('completed');
            // Small delay between each step completion for visual effect
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        // Change title to show completion
        if (title) {
            title.textContent = '✓ Analysis Complete!';
            title.style.color = '#155724';
        }

        // Show completion state for a moment
        await new Promise(resolve => setTimeout(resolve, 800));

        // Fade out and hide
        modal.style.opacity = '0';
        await new Promise(resolve => setTimeout(resolve, 300));
        modal.classList.add('hidden');
        modal.style.opacity = '1';
    }
}

/**
 * Show age input modal and return a promise with the age
 */
function showAgeModal() {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById('ageModal');
        const ageInput = document.getElementById('ageInput');
        const submitBtn = document.getElementById('submitAge');
        const cancelBtn = document.getElementById('cancelAge');
        const ageError = document.getElementById('ageError');

        // Clear previous values
        ageInput.value = '';
        ageError.textContent = '';

        // Show modal
        modal.classList.remove('hidden');
        ageInput.focus();

        // Handle submit
        const handleSubmit = () => {
            const age = parseInt(ageInput.value);

            if (!ageInput.value || isNaN(age)) {
                ageError.textContent = 'Please enter a valid age';
                return;
            }

            if (age < 0 || age > 120) {
                ageError.textContent = 'Please enter an age between 0 and 120';
                return;
            }

            // Valid age, close modal and resolve
            modal.classList.add('hidden');
            cleanup();
            resolve(age);
        };

        // Handle cancel
        const handleCancel = () => {
            modal.classList.add('hidden');
            cleanup();
            reject(new Error('Age input cancelled'));
        };

        // Handle Enter key
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                handleSubmit();
            }
        };

        // Cleanup function
        const cleanup = () => {
            submitBtn.removeEventListener('click', handleSubmit);
            cancelBtn.removeEventListener('click', handleCancel);
            ageInput.removeEventListener('keypress', handleKeyPress);
        };

        // Add event listeners
        submitBtn.addEventListener('click', handleSubmit);
        cancelBtn.addEventListener('click', handleCancel);
        ageInput.addEventListener('keypress', handleKeyPress);
    });
}

/**
 * Send detection results to backend with age
 * Note: Image data removed - backend doesn't use it, saves ~500KB-2MB per request
 */
async function sendToBackend(detections, age) {
    try {
        const payload = {
            detections: detections.map(d => ({
                medicine: CLASS_LABELS[d.class] || `Unknown ${d.class}`,
                confidence: d.score,
                bbox: {
                    x: d.x,
                    y: d.y,
                    width: d.width,
                    height: d.height
                }
            })),
            age: age,
            timestamp: new Date().toISOString()
        };

        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error sending to backend:', error);
        // For demo purposes, return mock data if backend is not available
        return {
            medicine: detections.length > 0 ? CLASS_LABELS[detections[0].class] : 'Unknown',
            usage: 'Consult your healthcare provider for dosage information.',
            sideEffects: 'May cause drowsiness, nausea, or other side effects.',
            misconceptions: 'Always read the label and follow instructions.'
        };
    }
}

// ============================================
// Performance Monitoring
// ============================================

/**
 * Get performance metrics
 * Call window.getPerformanceMetrics() in console to see stats
 */
window.getPerformanceMetrics = function() {
    const metrics = {
        ...performanceMetrics,
        workerEnabled: useWebWorker,
        workerActive: yoloWorker !== null,
        cacheSize: detectionCache.size,
        workerUsagePercent: performanceMetrics.inferenceCount > 0
            ? ((performanceMetrics.workerUsage / performanceMetrics.inferenceCount) * 100).toFixed(1) + '%'
            : '0%',
        cacheHitRate: performanceMetrics.inferenceCount > 0
            ? ((performanceMetrics.cachedResults / (performanceMetrics.inferenceCount + performanceMetrics.cachedResults)) * 100).toFixed(1) + '%'
            : '0%'
    };

    console.table(metrics);
    return metrics;
};

/**
 * Reset performance metrics
 */
window.resetPerformanceMetrics = function() {
    performanceMetrics.modelLoadTime = 0;
    performanceMetrics.inferenceCount = 0;
    performanceMetrics.totalInferenceTime = 0;
    performanceMetrics.averageInferenceTime = 0;
    performanceMetrics.cachedResults = 0;
    performanceMetrics.workerUsage = 0;
    detectionCache.clear();
    console.log('Performance metrics reset');
};

// ============================================
// Image Optimization Utilities
// ============================================

/**
 * Resize image if it exceeds maximum dimensions
 * This improves performance by reducing memory usage and processing time
 * @param {HTMLImageElement} image - The image to resize
 * @param {number} maxWidth - Maximum width (default: 1920)
 * @param {number} maxHeight - Maximum height (default: 1080)
 * @returns {HTMLImageElement} - Resized image or original if within limits
 */
function resizeImageIfNeeded(image, maxWidth = 1920, maxHeight = 1080) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    // Validate dimensions
    if (!width || !height) {
        console.error('Invalid image dimensions');
        return null;
    }

    // Check if resizing is needed
    if (width <= maxWidth && height <= maxHeight) {
        console.log(`Image size OK: ${width}x${height}`);
        return null; // Return null to indicate no resizing needed
    }

    console.log(`Resizing image from ${width}x${height} to fit ${maxWidth}x${maxHeight}`);

    // Calculate new dimensions maintaining aspect ratio
    let newWidth = width;
    let newHeight = height;

    if (width > maxWidth) {
        newWidth = maxWidth;
        newHeight = (height * maxWidth) / width;
    }

    if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = (width * maxHeight) / height;
    }

    // Create canvas for resizing
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, newWidth, newHeight);

    // Return data URL instead of Image object
    const dataURL = canvas.toDataURL('image/jpeg', 0.92);
    console.log(`Image resized to: ${newWidth}x${newHeight}`);
    return dataURL;
}

/**
 * Get human-readable file size
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================
// Service Worker Registration
// ============================================

/**
 * Register service worker for model caching
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/sw.js')
            .then((registration) => {
                console.log('[Service Worker] Registered successfully:', registration.scope);

                // Check if there's a waiting worker
                if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }

                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('[Service Worker] Update found, installing new version...');

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('[Service Worker] New version installed, will activate on next page load');
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('[Service Worker] Registration failed:', error);
            });

        // Handle service worker controller change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[Service Worker] Controller changed, new service worker active');
        });
    } else {
        console.log('[Service Worker] Not supported in this browser');
    }
}

// ============================================
// Page Initialization
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Register service worker for model caching
    registerServiceWorker();
    // Navbar active link logic (client-side for demo; Flask replaces for prod)
    const navLinks = document.querySelectorAll('.nav-links li a');
    navLinks.forEach(link => {
        if (window.location.pathname === link.getAttribute('href')) {
            link.parentElement.classList.add('active');
        } else {
            link.parentElement.classList.remove('active');
        }
    });

    // Preload model on scan page for faster detection
    preloadModel();

    /* --- Scan Page Logic (scan.html) --- */
    const openCameraBtn = document.getElementById('openCamera');
    const cameraContainer = document.getElementById('cameraContainer');
    const video = document.getElementById('video');
    const captureBtn = document.getElementById('captureBtn');
    const snapshot = document.getElementById('snapshot');
    const cameraError = document.getElementById('cameraError');

    let mediaStream = null;

    if (openCameraBtn) {
        openCameraBtn.addEventListener('click', async function() {
            cameraError.textContent = '';
            snapshot.classList.add('hidden');
            cameraContainer.classList.remove('hidden');
            if (mediaStream) return; // already open
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
                video.srcObject = mediaStream;
                video.play();
            } catch (error) {
                cameraError.textContent = 'Camera access denied. Please enable camera permissions.';
                cameraContainer.classList.add('hidden');
            }
        });
    }
    if (captureBtn) {
        captureBtn.addEventListener('click', async function() {
            if (!video.srcObject) return;

            try {
                captureBtn.disabled = true;

                // FIRST: Get age from user before scanning
                const age = await showAgeModal();

                // NOW: Start scanning process
                showScanningModal();

                // Allow UI to update before starting heavy operations
                await new Promise(resolve => setTimeout(resolve, 50));

                // Step 1: Processing image
                updateScanningStep(1);
                const width = video.videoWidth;
                const height = video.videoHeight;
                snapshot.width = width;
                snapshot.height = height;
                const ctx = snapshot.getContext('2d');
                ctx.drawImage(video, 0, 0, width, height);

                // Create an image element for detection
                const img = new Image();
                img.width = width;
                img.height = height;
                img.src = snapshot.toDataURL('image/jpeg', 0.85);

                await new Promise((resolve) => {
                    img.onload = resolve;
                });

                // Step 2: Running AI detection
                updateScanningStep(2);
                console.log('Running YOLO detection on camera image...');
                const detections = await detectMedicine(img);
                console.log('Detections found:', detections);

                // Step 3: Identifying medicine
                updateScanningStep(3);
                drawBoundingBoxes(snapshot, detections, width, height);
                snapshot.classList.remove('hidden');

                // Step 4: Retrieving information from backend
                updateScanningStep(4);
                const result = await sendToBackend(detections, age);

                // Hide scanning modal with completion animation
                await hideScanningModal();

                // Store result in sessionStorage and redirect to results page
                sessionStorage.setItem('medicineResult', JSON.stringify(result));
                window.location.href = '/results';

            } catch (error) {
                console.error('Error during capture and detection:', error);
                cameraError.textContent = `Detection error: ${error.message}`;
                hideScanningModal();
            } finally {
                captureBtn.disabled = false;
            }
        });
    }
    window.addEventListener('beforeunload', function() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
    });

    // --- Upload & Preview ---
    const fileInput = document.getElementById('fileInput');
    const uploadPreview = document.getElementById('uploadPreview');
    let uploadedImage = null;

    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            uploadPreview.innerHTML = '';
            if (file) {
                // Check file size
                console.log(`Uploaded file size: ${formatFileSize(file.size)}`);

                const img = document.createElement('img');
                const blobURL = URL.createObjectURL(file);

                img.onload = () => {
                    console.log('Original image loaded, dimensions:', img.naturalWidth, 'x', img.naturalHeight);

                    // Resize image if needed to improve performance
                    const resizedDataURL = resizeImageIfNeeded(img);

                    if (resizedDataURL) {
                        console.log('Image was resized, creating new image from data URL');
                        // Image was resized, create new Image and attach onload BEFORE setting src
                        const resizedImg = new Image();

                        // Set up timeout for image loading
                        const timeoutId = setTimeout(() => {
                            console.error('Resized image loading timeout');
                            showPreviewError('Image preview failed to load');
                        }, 5000);

                        // Attach onload handler BEFORE setting src to avoid race condition
                        resizedImg.onload = () => {
                            clearTimeout(timeoutId);
                            console.log('Resized image loaded successfully');
                            uploadedImage = resizedImg;
                            displayPreview(resizedImg);
                        };

                        // Attach error handler
                        resizedImg.onerror = () => {
                            clearTimeout(timeoutId);
                            console.error('Failed to load resized image');
                            showPreviewError('Failed to process image');
                        };

                        // Now set the src (onload is already attached)
                        resizedImg.src = resizedDataURL;
                    } else {
                        console.log('Image does not need resizing, displaying original');
                        // Image wasn't resized, display original immediately
                        uploadedImage = img;
                        displayPreview(img);
                    }

                    // Clean up blob URL after processing
                    URL.revokeObjectURL(blobURL);
                };

                // Add error handler for initial image load
                img.onerror = () => {
                    URL.revokeObjectURL(blobURL);
                    console.error('Failed to load uploaded image');
                    showPreviewError('Failed to load image file');
                };

                // Set src after attaching handlers
                img.src = blobURL;
                uploadPreview.classList.remove('hidden');
            } else {
                uploadPreview.classList.add('hidden');
                uploadedImage = null;
            }
        });
    }

    // Helper function to display preview image
    function displayPreview(image) {
        uploadPreview.innerHTML = '';
        const previewImg = document.createElement('img');
        previewImg.src = image.src;
        previewImg.alt = 'Preview';
        previewImg.style.maxHeight = '180px';
        previewImg.id = 'uploadedImagePreview';
        uploadPreview.appendChild(previewImg);
    }

    // Helper function to show preview error
    function showPreviewError(message) {
        uploadPreview.innerHTML = '';
        const errorDiv = document.createElement('div');
        errorDiv.style.color = '#e74c3c';
        errorDiv.style.padding = '10px';
        errorDiv.style.textAlign = 'center';
        errorDiv.textContent = message;
        uploadPreview.appendChild(errorDiv);
    }

    // --- Scan Button & Loading ---
    const scanBtn = document.getElementById('scanBtn');
    const loadingAnim = document.getElementById('loadingAnim');
    if (scanBtn) {
        scanBtn.addEventListener('click', async function() {
            if (!uploadedImage) {
                alert('Please upload an image first.');
                return;
            }

            try {
                scanBtn.disabled = true;

                // FIRST: Get age from user before scanning
                const age = await showAgeModal();

                // NOW: Start scanning process
                loadingAnim.classList.add('hidden');
                showScanningModal();

                // Allow UI to update before starting heavy operations
                await new Promise(resolve => setTimeout(resolve, 50));

                // Step 1: Processing image
                updateScanningStep(1);
                // Image is already loaded, process immediately

                // Step 2: Running AI detection
                updateScanningStep(2);
                console.log('Running YOLO detection on uploaded image...');
                const detections = await detectMedicine(uploadedImage);
                console.log('Detections found:', detections);

                // Step 3: Identifying medicine
                updateScanningStep(3);
                const canvas = document.createElement('canvas');
                canvas.width = uploadedImage.naturalWidth;
                canvas.height = uploadedImage.naturalHeight;
                const ctx = canvas.getContext('2d');

                // Draw original image
                ctx.drawImage(uploadedImage, 0, 0);

                // Draw bounding boxes
                drawBoundingBoxes(canvas, detections, uploadedImage.naturalWidth, uploadedImage.naturalHeight);

                // Update preview with annotated image
                uploadPreview.innerHTML = '';
                const annotatedImg = document.createElement('img');
                annotatedImg.src = canvas.toDataURL('image/jpeg', 0.85);
                annotatedImg.alt = 'Detected Medicine';
                annotatedImg.style.maxHeight = '180px';
                uploadPreview.appendChild(annotatedImg);

                // Step 4: Retrieving information from backend
                updateScanningStep(4);
                const result = await sendToBackend(detections, age);

                // Hide scanning modal with completion animation
                await hideScanningModal();

                // Store result in sessionStorage and redirect to results page
                sessionStorage.setItem('medicineResult', JSON.stringify(result));

                // Redirect to results page
                window.location.href = '/results';

            } catch (error) {
                console.error('Error during scanning:', error);
                alert(`Detection error: ${error.message}`);
                hideScanningModal();
            } finally {
                loadingAnim.classList.add('hidden');
                scanBtn.disabled = false;
            }
        });
    }
});
