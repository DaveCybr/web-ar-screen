/**
 * WebAR Configuration
 * Central configuration for all tracking, rendering, and performance settings
 */

export const CONFIG = {
  // === TRACKING CONFIGURATION ===
  tracking: {
    // Maximum dimension for processing frames (lower = faster, higher = more accurate)
    maxDimension: 720,

    // Frames to skip between full detections (higher = faster, lower = more responsive)
    detectionInterval: 30,

    // Minimum good matches required for homography computation
    minMatches: 12,

    // Lowe's ratio test threshold (0.7-0.85, higher = more permissive)
    ratioThreshold: 0.8,

    // Enable temporal filtering for stability
    temporalFiltering: true,

    // Frames required for stable detection
    stabilityFrames: 3,

    // Maximum tracking loss frames before full re-detection
    maxLostFrames: 15,
  },

  // === FEATURE DETECTION ===
  features: {
    // Detector type: 'BRISK', 'AKAZE', or 'ORB'
    detector: "BRISK",

    // BRISK specific settings
    brisk: {
      thresh: 30, // Detection threshold (lower = more features)
      octaves: 4, // Number of scale levels
      patternScale: 1.0, // Pattern scale factor
    },

    // AKAZE specific settings (if using AKAZE)
    akaze: {
      threshold: 0.001,
      nOctaves: 4,
      nOctaveLayers: 4,
      diffusivity: 2, // KAZE_DIFF_PM_G2
    },

    // ORB specific settings (if using ORB)
    orb: {
      nfeatures: 1000,
      scaleFactor: 1.2,
      nlevels: 8,
    },

    // Maximum features to extract per frame
    maxFeaturesPerFrame: 1000,

    // Maximum features to store per target
    maxFeaturesPerTarget: 500,
  },

  // === VOCABULARY TREE ===
  vocabulary: {
    // Number of visual words (higher = more discriminative, slower)
    size: 200,

    // K-means clustering depth
    depth: 3,

    // Branching factor
    branchingFactor: 10,

    // Number of top candidates to check
    topCandidates: 3,

    // Enable TF-IDF weighting
    useTFIDF: true,
  },

  // === CAMERA SETTINGS ===
  camera: {
    // Preferred camera facing mode
    facingMode: "environment",

    // Ideal resolution
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },

    // Frame rate
    frameRate: { ideal: 30, max: 60 },

    // Auto-restart on orientation change
    autoRestart: true,
  },

  // === RENDERING ===
  rendering: {
    // Enable Three.js debug helpers
    debug: false,

    // Show tracking rectangles
    showTrackingRects: false,

    // Video overlay opacity
    videoOpacity: 1.0,

    // Enable smooth transitions
    smoothTransitions: true,

    // Transition duration (ms)
    transitionDuration: 300,

    // Enable antialiasing
    antialias: true,

    // Pixel ratio (1 = default, 2 = retina)
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  },

  // === PERFORMANCE ===
  performance: {
    // Enable Web Workers for processing
    useWebWorkers: false, // Not yet implemented

    // Enable GPU acceleration
    useGPU: false, // Not yet implemented

    // Memory management
    maxCacheSize: 100 * 1024 * 1024, // 100MB

    // Enable performance monitoring
    monitoring: true,

    // Log performance metrics interval (ms)
    metricsInterval: 5000,
  },

  // === STORAGE ===
  storage: {
    // IndexedDB database name
    dbName: "WebARTracker",

    // Database version
    dbVersion: 1,

    // Store names
    stores: {
      targets: "targets",
      vocabulary: "vocabulary",
      cache: "cache",
    },

    // Enable persistent caching
    persistent: true,
  },

  // === UI ===
  ui: {
    // Show loading progress
    showProgress: true,

    // Show target info overlay
    showTargetInfo: true,

    // Toast notification duration (ms)
    toastDuration: 3000,

    // Enable haptic feedback
    hapticFeedback: true,
  },

  // === DEBUG ===
  debug: {
    // Enable debug logging
    enabled: true,

    // Log level: 'debug', 'info', 'warn', 'error'
    level: "info",

    // Export debug info automatically
    autoExport: false,

    // Show FPS counter
    showFPS: false,
  },
};

/**
 * Get optimal config based on device capabilities
 */
export function getOptimalConfig() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isLowEnd = navigator.hardwareConcurrency <= 4;

  const config = { ...CONFIG };

  if (isMobile || isLowEnd) {
    // Optimize for mobile/low-end devices
    config.tracking.maxDimension = 640;
    config.tracking.detectionInterval = 45;
    config.features.maxFeaturesPerFrame = 800;
    config.vocabulary.size = 150;
    config.rendering.pixelRatio = 1;
  }

  return config;
}

/**
 * Validate configuration
 */
export function validateConfig(config) {
  const errors = [];

  if (config.tracking.minMatches < 4) {
    errors.push("tracking.minMatches must be >= 4");
  }

  if (
    config.tracking.ratioThreshold < 0.5 ||
    config.tracking.ratioThreshold > 1.0
  ) {
    errors.push("tracking.ratioThreshold must be between 0.5 and 1.0");
  }

  if (config.vocabulary.size < 50) {
    errors.push("vocabulary.size must be >= 50");
  }

  return errors;
}

/**
 * Export for use in other modules
 */
export default CONFIG;
