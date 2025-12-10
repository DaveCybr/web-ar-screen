/**
 * WebAR Image Tracker - Main Entry Point dengan Video Support
 */

import { CONFIG, getOptimalConfig } from "./config.js";
import { Logger } from "./utils/Logger.js";
import { CameraManager } from "./camera/CameraManager.js";
import { ViewportManager } from "./camera/ViewportManager.js";
import { ImageTracker } from "./tracking/ImageTracker.js";
import { ARRenderer } from "./rendering/ARRenderer.js";
import { CacheManager } from "./storage/CacheManager.js";

class WebARApp {
  constructor() {
    this.logger = new Logger("WebARApp");
    this.config = getOptimalConfig();
    this.initialized = false;
    this.targets = new Map();
    this.videoContents = new Map();

    // UI Elements
    this.elements = {
      loadingScreen: document.getElementById("loadingScreen"),
      permissionPrompt: document.getElementById("permissionPrompt"),
      app: document.getElementById("app"),
      progressBar: document.getElementById("progressBar"),
      loadingText: document.getElementById("loadingText"),
      startBtn: document.getElementById("startBtn"),
      menuBtn: document.getElementById("menuBtn"),
      controlPanel: document.getElementById("controlPanel"),
      closePanel: document.getElementById("closePanel"),
      imageUpload: document.getElementById("imageUpload"),
      videoUpload: document.getElementById("videoUpload"), // NEW
      targetsList: document.getElementById("targetsList"),
      targetCount: document.getElementById("targetCount"),
      targetInfo: document.getElementById("targetInfo"),
      targetName: document.getElementById("targetName"),
      clearCache: document.getElementById("clearCache"),
      exportDebug: document.getElementById("exportDebug"),
      sensitivitySlider: document.getElementById("sensitivitySlider"),
      sensitivityValue: document.getElementById("sensitivityValue"),
      featuresSlider: document.getElementById("featuresSlider"),
      featuresValue: document.getElementById("featuresValue"),
    };
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      this.logger.info("Initializing WebAR application...");
      this.updateProgress(0, "Loading OpenCV...");

      await this.waitForOpenCV();
      this.updateProgress(30, "OpenCV loaded");

      this.cacheManager = new CacheManager(this.config.storage);
      await this.cacheManager.init();
      this.updateProgress(40, "Storage initialized");

      this.setupEventListeners();
      this.updateProgress(50, "UI ready");

      await this.loadCachedTargets();
      this.updateProgress(100, "Ready");

      setTimeout(() => {
        this.elements.loadingScreen.classList.add("hidden");
        this.elements.permissionPrompt.classList.remove("hidden");
      }, 500);

      this.initialized = true;
      this.logger.info("Initialization complete");
    } catch (error) {
      this.logger.error("Initialization failed:", error);
      this.showError("Failed to initialize application. Please refresh.");
    }
  }

  /**
   * Wait for OpenCV to load
   */
  async waitForOpenCV() {
    if (typeof cv !== "undefined" && cv.Mat) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("OpenCV loading timeout"));
      }, 30000);

      const check = setInterval(() => {
        if (typeof cv !== "undefined" && cv.Mat) {
          clearInterval(check);
          clearTimeout(timeout);
          this.logger.info("OpenCV loaded successfully");
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Start AR experience
   */
  async startAR() {
    try {
      this.logger.info("Starting AR experience...");
      this.elements.permissionPrompt.classList.add("hidden");
      this.elements.loadingScreen.classList.remove("hidden");
      this.updateProgress(0, "Requesting camera access...");

      this.cameraManager = new CameraManager(
        document.getElementById("cameraVideo"),
        this.config.camera
      );
      await this.cameraManager.start();
      this.updateProgress(30, "Camera ready");

      this.viewportManager = new ViewportManager();
      this.viewportManager.init();
      this.updateProgress(40, "Viewport configured");

      this.arRenderer = new ARRenderer(
        "arCanvas",
        this.cameraManager.videoElement,
        this.config.rendering
      );
      await this.arRenderer.init();
      this.updateProgress(60, "AR renderer ready");

      // Load video contents ke renderer
      this.videoContents.forEach((videoUrl, targetId) => {
        this.arRenderer.setTargetContent(targetId, videoUrl);
      });

      this.imageTracker = new ImageTracker(
        this.cameraManager,
        this.arRenderer,
        this.config
      );
      await this.imageTracker.init();
      this.updateProgress(80, "Tracker initialized");

      if (this.targets.size > 0) {
        await this.imageTracker.loadTargets(Array.from(this.targets.values()));
      }
      this.updateProgress(90, "Targets loaded");

      this.imageTracker.start(this.onDetection.bind(this));
      this.updateProgress(100, "Ready!");

      setTimeout(() => {
        this.elements.loadingScreen.classList.add("hidden");
        this.elements.app.classList.remove("hidden");
      }, 300);

      this.logger.info("AR experience started");
    } catch (error) {
      this.logger.error("Failed to start AR:", error);

      if (error.name === "NotAllowedError") {
        this.showError(
          "Camera access denied. Please allow camera access and try again."
        );
      } else if (error.name === "NotFoundError") {
        this.showError(
          "No camera found. Please connect a camera and try again."
        );
      } else {
        this.showError("Failed to start AR experience. Please try again.");
      }

      this.elements.loadingScreen.classList.add("hidden");
      this.elements.permissionPrompt.classList.remove("hidden");
    }
  }

  /**
   * Handle target detection
   */
  onDetection(detection) {
    if (detection.success) {
      const target = this.targets.get(detection.targetId);
      if (target) {
        this.showTargetInfo(target.name);

        if (this.config.ui.hapticFeedback && navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    } else {
      this.hideTargetInfo();
    }
  }

  /**
   * Load target images
   */
  async loadTargets(files) {
    this.logger.info(`Loading ${files.length} target images...`);

    for (const file of files) {
      try {
        const targetId =
          Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const imageData = await this.readFileAsDataURL(file);
        const image = await this.loadImage(imageData);

        const target = {
          id: targetId,
          name: file.name,
          image: imageData,
          width: image.width,
          height: image.height,
          features: null,
          timestamp: Date.now(),
          hasVideo: false,
        };

        this.targets.set(targetId, target);
        await this.cacheManager.set("targets", targetId, target);

        if (this.imageTracker) {
          await this.imageTracker.addTarget(target);
        }

        this.logger.info(`Loaded target: ${target.name}`);
      } catch (error) {
        this.logger.error(`Failed to load ${file.name}:`, error);
      }
    }

    this.updateTargetsList();
  }

  /**
   * Load video content untuk target
   */
  async loadVideoForTarget(targetId, file) {
    try {
      this.logger.info(`Loading video for target ${targetId}...`);

      const videoUrl = await this.readFileAsDataURL(file);

      // Store video URL
      this.videoContents.set(targetId, videoUrl);

      // Update target
      const target = this.targets.get(targetId);
      if (target) {
        target.hasVideo = true;
        target.videoName = file.name;
        await this.cacheManager.set("targets", targetId, target);
      }

      // Cache video
      await this.cacheManager.set("videos", targetId, {
        url: videoUrl,
        name: file.name,
      });

      // Update renderer jika sudah init
      if (this.arRenderer) {
        this.arRenderer.setTargetContent(targetId, videoUrl);
      }

      this.updateTargetsList();
      this.logger.info(`Video loaded for target: ${target.name}`);
      this.showSuccess(`Video "${file.name}" loaded!`);
    } catch (error) {
      this.logger.error("Failed to load video:", error);
      this.showError("Failed to load video");
    }
  }

  /**
   * Remove target
   */
  async removeTarget(targetId) {
    this.targets.delete(targetId);
    this.videoContents.delete(targetId);

    await this.cacheManager.delete("targets", targetId);
    await this.cacheManager.delete("videos", targetId);

    if (this.imageTracker) {
      this.imageTracker.removeTarget(targetId);
    }

    this.updateTargetsList();
  }

  /**
   * Load cached targets
   */
  async loadCachedTargets() {
    try {
      const cachedTargets = await this.cacheManager.getAll("targets");

      for (const target of cachedTargets) {
        this.targets.set(target.id, target);
      }

      // Load cached videos
      try {
        const cachedVideos = await this.cacheManager.getAll("videos");
        for (const video of cachedVideos) {
          this.videoContents.set(video.id, video.url);
        }
      } catch (e) {
        // Videos store mungkin belum ada
        this.logger.warn("No cached videos found");
      }

      if (cachedTargets.length > 0) {
        this.logger.info(`Loaded ${cachedTargets.length} cached targets`);
        this.updateTargetsList();
      }
    } catch (error) {
      this.logger.error("Failed to load cached targets:", error);
    }
  }

  /**
   * Update targets list UI
   */
  updateTargetsList() {
    const list = this.elements.targetsList;
    list.innerHTML = "";

    this.targets.forEach((target, id) => {
      const item = document.createElement("div");
      item.className = "target-item";

      const hasVideo = this.videoContents.has(id);
      const videoIndicator = hasVideo
        ? '<span class="video-badge">📹 Video</span>'
        : '<span class="video-badge no-video">No Video</span>';

      item.innerHTML = `
        <img src="${target.image}" alt="${target.name}" class="target-thumbnail">
        <div class="target-details">
          <div class="target-name">${target.name}</div>
          <div class="target-features">${target.width} × ${target.height}</div>
          ${videoIndicator}
        </div>
        <div class="target-actions">
          <button class="target-video-btn" data-id="${id}" title="Add Video">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </button>
          <button class="target-remove" data-id="${id}" title="Remove">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;

      // Video upload button
      const videoBtn = item.querySelector(".target-video-btn");
      videoBtn.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "video/*";
        input.onchange = (e) => {
          if (e.target.files.length > 0) {
            this.loadVideoForTarget(id, e.target.files[0]);
          }
        };
        input.click();
      });

      // Remove button
      const removeBtn = item.querySelector(".target-remove");
      removeBtn.addEventListener("click", () => {
        if (confirm(`Remove target "${target.name}"?`)) {
          this.removeTarget(id);
        }
      });

      list.appendChild(item);
    });

    this.elements.targetCount.textContent = this.targets.size;
  }

  /**
   * Setup UI event listeners
   */
  setupEventListeners() {
    this.elements.startBtn.addEventListener("click", () => this.startAR());

    this.elements.menuBtn.addEventListener("click", () => {
      this.elements.controlPanel.classList.add("open");
    });

    this.elements.closePanel.addEventListener("click", () => {
      this.elements.controlPanel.classList.remove("open");
    });

    this.elements.imageUpload.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        this.loadTargets(Array.from(e.target.files));
        e.target.value = "";
      }
    });

    this.elements.clearCache.addEventListener("click", async () => {
      if (confirm("Clear all cached data?")) {
        await this.cacheManager.clear();
        this.targets.clear();
        this.videoContents.clear();
        this.updateTargetsList();
        this.logger.info("Cache cleared");
      }
    });

    this.elements.exportDebug.addEventListener("click", () => {
      this.exportDebugInfo();
    });

    this.elements.sensitivitySlider.addEventListener("input", (e) => {
      const value = e.target.value;
      this.elements.sensitivityValue.textContent = value;
      if (this.imageTracker) {
        this.imageTracker.updateConfig({
          features: { brisk: { thresh: parseInt(value) } },
        });
      }
    });

    this.elements.featuresSlider.addEventListener("input", (e) => {
      const value = e.target.value;
      this.elements.featuresValue.textContent = value;
      if (this.imageTracker) {
        this.imageTracker.updateConfig({
          features: { maxFeaturesPerFrame: parseInt(value) },
        });
      }
    });
  }

  /**
   * Utility functions
   */
  updateProgress(percent, text) {
    this.elements.progressBar.style.width = `${percent}%`;
    this.elements.loadingText.textContent = text;
  }

  showTargetInfo(name) {
    this.elements.targetName.textContent = name;
    this.elements.targetInfo.classList.remove("hidden");
  }

  hideTargetInfo() {
    this.elements.targetInfo.classList.add("hidden");
  }

  showError(message) {
    // Simple toast notification
    const toast = document.createElement("div");
    toast.className = "toast toast-error";
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  showSuccess(message) {
    const toast = document.createElement("div");
    toast.className = "toast toast-success";
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  exportDebugInfo() {
    const info = {
      timestamp: new Date().toISOString(),
      config: this.config,
      targets: Array.from(this.targets.values()).map((t) => ({
        id: t.id,
        name: t.name,
        size: `${t.width}x${t.height}`,
        hasVideo: this.videoContents.has(t.id),
      })),
      system: {
        userAgent: navigator.userAgent,
        cores: navigator.hardwareConcurrency,
        memory: navigator.deviceMemory,
      },
    };

    const blob = new Blob([JSON.stringify(info, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `webar-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.webARApp = new WebARApp();
    window.webARApp.init();
  });
} else {
  window.webARApp = new WebARApp();
  window.webARApp.init();
}
