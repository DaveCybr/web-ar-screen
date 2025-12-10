/**
 * Image Tracker - Main tracking coordinator
 */

import { Logger } from "../utils/Logger.js";
import { FeatureDetector } from "./FeatureDetector.js";
import { VocabularyTree } from "./VocabularyTree.js";

export class ImageTracker {
  constructor(cameraManager, arRenderer, config) {
    this.logger = new Logger("ImageTracker");
    this.cameraManager = cameraManager;
    this.arRenderer = arRenderer;
    this.config = config;

    this.targets = new Map();
    this.featureDetector = null;
    this.vocabularyTree = null;

    this.isTracking = false;
    this.frameCount = 0;
    this.detectionCallback = null;
    this.currentTarget = null;

    this.processingCanvas = document.createElement("canvas");
    this.processingCtx = this.processingCanvas.getContext("2d");
  }

  /**
   * Initialize tracker
   */
  async init() {
    this.featureDetector = new FeatureDetector(this.config);
    await this.featureDetector.init();

    this.vocabularyTree = new VocabularyTree(this.config);

    this.logger.info("Image tracker initialized");
  }

  /**
   * Add target
   */
  async addTarget(target) {
    this.logger.info(`Adding target: ${target.name}`);

    // Load image
    const img = await this.loadImage(target.image);

    // Create cv.Mat from image
    const mat = cv.imread(img);

    // Extract features
    target.features = this.featureDetector.extractFeatures(mat);

    mat.delete();

    // Add to targets
    this.targets.set(target.id, target);

    // Rebuild vocabulary
    await this.rebuildVocabulary();

    this.logger.info(`Target added: ${target.features.count} features`);
  }

  /**
   * Remove target
   */
  removeTarget(targetId) {
    this.targets.delete(targetId);
    this.logger.info(`Target removed: ${targetId}`);
  }

  /**
   * Load targets
   */
  async loadTargets(targets) {
    for (const target of targets) {
      await this.addTarget(target);
    }
  }

  /**
   * Rebuild vocabulary tree
   */
  async rebuildVocabulary() {
    if (this.targets.size === 0) return;

    await this.vocabularyTree.build(Array.from(this.targets.values()));
  }

  /**
   * Start tracking
   */
  start(callback) {
    this.detectionCallback = callback;
    this.isTracking = true;
    this.frameCount = 0;
    this.processFrame();
    this.logger.info("Tracking started");
  }

  /**
   * Stop tracking
   */
  stop() {
    this.isTracking = false;
    this.logger.info("Tracking stopped");
  }

  /**
   * Process frame
   */
  async processFrame() {
    if (!this.isTracking) return;

    try {
      this.frameCount++;

      // Process every N frames
      if (this.frameCount % this.config.tracking.detectionInterval === 0) {
        await this.detectTarget();
      }
    } catch (error) {
      this.logger.error("Frame processing error:", error);
    }

    requestAnimationFrame(() => this.processFrame());
  }

  /**
   * Detect target in current frame
   */
  async detectTarget() {
    if (this.targets.size === 0) return;

    // Capture frame
    const video = this.cameraManager.videoElement;
    this.processingCanvas.width = video.videoWidth;
    this.processingCanvas.height = video.videoHeight;
    this.processingCtx.drawImage(video, 0, 0);

    // Create cv.Mat
    const frameMat = cv.imread(this.processingCanvas);

    // Detect
    const detection = this.featureDetector.detect(
      frameMat,
      Array.from(this.targets.values())
    );

    frameMat.delete();

    // Handle detection
    if (detection.success) {
      this.currentTarget = detection.targetId;
      this.arRenderer.setTarget(detection);
    } else {
      this.currentTarget = null;
      this.arRenderer.clearTarget();
    }

    // Callback
    if (this.detectionCallback) {
      this.detectionCallback(detection);
    }
  }

  /**
   * Load image
   */
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * Update config
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    this.logger.info("Config updated");
  }
}
