// Service Worker for MediWeb
// Caches YOLO model files for faster loading on subsequent visits

const CACHE_NAME = 'mediweb-model-cache-v1';
const MODEL_FILES = [
    '/static/model.json',
    '/static/group1-shard1of11.bin',
    '/static/group1-shard2of11.bin',
    '/static/group1-shard3of11.bin',
    '/static/group1-shard4of11.bin',
    '/static/group1-shard5of11.bin',
    '/static/group1-shard6of11.bin',
    '/static/group1-shard7of11.bin',
    '/static/group1-shard8of11.bin',
    '/static/group1-shard9of11.bin',
    '/static/group1-shard10of11.bin',
    '/static/group1-shard11of11.bin'
];

// Install event - precache model files
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching model files...');
            return cache.addAll(MODEL_FILES).catch((error) => {
                console.error('[Service Worker] Failed to cache some files:', error);
                // Continue anyway - partial caching is better than none
            });
        })
    );
    // Activate immediately
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Take control immediately
    return self.clients.claim();
});

// Fetch event - serve from cache for model files, network for everything else
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only handle model files
    const isModelFile = MODEL_FILES.some(file => url.pathname === file);

    if (isModelFile) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    console.log('[Service Worker] Serving from cache:', url.pathname);
                    return cachedResponse;
                }

                // Not in cache, fetch and cache it
                console.log('[Service Worker] Fetching and caching:', url.pathname);
                return fetch(event.request).then((response) => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return response;
                }).catch((error) => {
                    console.error('[Service Worker] Fetch failed:', error);
                    throw error;
                });
            })
        );
    }
    // For non-model files, let them pass through normally
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'GET_CACHE_STATUS') {
        caches.open(CACHE_NAME).then((cache) => {
            return cache.keys();
        }).then((keys) => {
            event.ports[0].postMessage({
                cached: keys.length,
                total: MODEL_FILES.length
            });
        });
    }
});
