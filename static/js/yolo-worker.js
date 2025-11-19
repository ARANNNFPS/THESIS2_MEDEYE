// YOLO Web Worker - Runs inference in background thread
// This prevents UI blocking during heavy computation

// Import TensorFlow.js in the worker context
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');

let yoloModel = null;
let isModelLoading = false;

// Model configuration
const MODEL_CONFIG = {
    modelUrl: '/static/model.json',
    inputSize: 640,
    scoreThreshold: 0.25,
    iouThreshold: 0.45,
    maxDetections: 100
};

/**
 * Load YOLO model in worker thread
 */
async function loadModel() {
    if (yoloModel) {
        return { success: true, message: 'Model already loaded' };
    }

    if (isModelLoading) {
        return { success: false, message: 'Model is already loading' };
    }

    try {
        isModelLoading = true;
        console.log('[Worker] Loading YOLO model...');

        // Load model with progress tracking
        yoloModel = await tf.loadGraphModel(MODEL_CONFIG.modelUrl, {
            onProgress: (fraction) => {
                const percentage = Math.round(fraction * 100);
                self.postMessage({
                    type: 'progress',
                    progress: percentage
                });
            }
        });

        isModelLoading = false;
        console.log('[Worker] YOLO model loaded successfully');

        return { success: true, message: 'Model loaded successfully' };
    } catch (error) {
        isModelLoading = false;
        console.error('[Worker] Error loading model:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Preprocess image data for YOLO input
 */
function preprocessImage(imageData, width, height) {
    return tf.tidy(() => {
        // Create tensor from image data
        let tensor = tf.browser.fromPixels(imageData);

        // Resize to model input size
        tensor = tf.image.resizeBilinear(tensor, [MODEL_CONFIG.inputSize, MODEL_CONFIG.inputSize]);

        // Normalize to [0, 1]
        tensor = tensor.div(255.0);

        // Add batch dimension
        tensor = tensor.expandDims(0);

        return tensor;
    });
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

        // Remove boxes with high IoU
        for (let i = indices.length - 1; i >= 0; i--) {
            const box = boxes[indices[i]];
            const iou = calculateIoU(currentBox, box);
            if (iou > iouThreshold) {
                indices.splice(i, 1);
            }
        }
    }

    return selected;
}

/**
 * Process YOLO output (YOLOv8 format)
 */
async function processYOLOOutput(predictions, imgWidth, imgHeight) {
    const outputTensor = Array.isArray(predictions) ? predictions[0] : predictions;
    const output = await outputTensor.array();

    const detections = [];
    const numDetections = output[0][0].length; // 8400
    const numClasses = output[0].length - 4;

    // Parse detections
    for (let i = 0; i < numDetections; i++) {
        const x = output[0][0][i];
        const y = output[0][1][i];
        const w = output[0][2][i];
        const h = output[0][3][i];

        // Find max confidence class
        let maxScore = 0;
        let maxClass = 0;

        for (let c = 0; c < numClasses; c++) {
            const score = output[0][4 + c][i];
            if (score > maxScore) {
                maxScore = score;
                maxClass = c;
            }
        }

        // Filter by threshold
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
    return finalDetections;
}

/**
 * Run inference on image
 */
async function runInference(imageData, width, height) {
    try {
        if (!yoloModel) {
            throw new Error('Model not loaded');
        }

        console.log('[Worker] Running inference...');
        const startTime = performance.now();

        // Preprocess
        const inputTensor = preprocessImage(imageData, width, height);

        // Run inference
        const predictions = await yoloModel.predict(inputTensor);

        // Process output
        const detections = await processYOLOOutput(
            Array.isArray(predictions) ? predictions : [predictions],
            width,
            height
        );

        // Cleanup
        inputTensor.dispose();
        if (Array.isArray(predictions)) {
            predictions.forEach(p => p.dispose());
        } else {
            predictions.dispose();
        }

        const inferenceTime = performance.now() - startTime;
        console.log(`[Worker] Inference completed in ${inferenceTime.toFixed(0)}ms`);

        return {
            success: true,
            detections: detections,
            inferenceTime: inferenceTime
        };
    } catch (error) {
        console.error('[Worker] Inference error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Message handler
 */
self.addEventListener('message', async (event) => {
    const { type, data } = event.data;

    switch (type) {
        case 'load':
            const loadResult = await loadModel();
            self.postMessage({
                type: 'loaded',
                ...loadResult
            });
            break;

        case 'infer':
            const inferResult = await runInference(
                data.imageData,
                data.width,
                data.height
            );
            self.postMessage({
                type: 'result',
                ...inferResult
            });
            break;

        case 'status':
            self.postMessage({
                type: 'status',
                modelLoaded: yoloModel !== null,
                isLoading: isModelLoading
            });
            break;

        default:
            console.warn('[Worker] Unknown message type:', type);
    }
});

console.log('[Worker] YOLO Worker initialized');
