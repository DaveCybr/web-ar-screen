/**
 * Camera Manager - Handles camera stream and video element
 */

import { Logger } from "../utils/Logger.js";

export class CameraManager {
  constructor(videoElement, config) {
    this.logger = new Logger("CameraManager");
    this.videoElement = videoElement;
    this.config = config;
    this.stream = null;
    this.isReady = false;
    this.deviceId = null;
  }

  /**
   * Check if getUserMedia is available
   */
  checkMediaDevicesSupport() {
    // Check for getUserMedia support with fallbacks
    if (!navigator.mediaDevices) {
      // Try old API
      navigator.mediaDevices = {};
    }

    if (!navigator.mediaDevices.getUserMedia) {
      // Polyfill for older browsers
      navigator.mediaDevices.getUserMedia = function (constraints) {
        // First get the old getUserMedia if present
        const getUserMedia =
          navigator.webkitGetUserMedia ||
          navigator.mozGetUserMedia ||
          navigator.msGetUserMedia;

        // Some browsers don't implement it - return rejected promise with error
        if (!getUserMedia) {
          return Promise.reject(
            new Error("getUserMedia is not implemented in this browser")
          );
        }

        // Otherwise, wrap the call in a promise
        return new Promise((resolve, reject) => {
          getUserMedia.call(navigator, constraints, resolve, reject);
        });
      };
    }
  }

  /**
   * Start camera stream
   */
  async start() {
    try {
      this.logger.info("Starting camera...");

      // Check support first
      this.checkMediaDevicesSupport();

      // Check if we're on HTTPS or localhost
      const isSecureContext =
        window.isSecureContext ||
        location.protocol === "https:" ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1";

      if (!isSecureContext) {
        throw new Error(
          "Camera requires HTTPS or localhost. Current protocol: " +
            location.protocol
        );
      }

      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "getUserMedia is not supported in this browser. Please use Chrome, Firefox, or Safari."
        );
      }

      const constraints = {
        video: {
          facingMode: this.config.facingMode || "environment",
          width: this.config.width || { ideal: 1280 },
          height: this.config.height || { ideal: 720 },
        },
        audio: false,
      };

      this.logger.info("Requesting camera with constraints:", constraints);

      // Request camera access
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Attach to video element
      this.videoElement.srcObject = this.stream;
      this.videoElement.setAttribute("playsinline", "");
      this.videoElement.setAttribute("webkit-playsinline", "");

      // Wait for video to be ready
      await this.waitForVideoReady();

      // Get actual video settings
      const track = this.stream.getVideoTracks()[0];
      const settings = track.getSettings();
      this.deviceId = settings.deviceId;

      this.logger.info("Camera started:", {
        width: settings.width,
        height: settings.height,
        aspectRatio: settings.aspectRatio,
        deviceId: this.deviceId,
      });

      this.isReady = true;
      return settings;
    } catch (error) {
      this.logger.error("Failed to start camera:", error);

      // Better error messages
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        throw new Error(
          "Camera permission denied. Please allow camera access in your browser settings."
        );
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        throw new Error(
          "No camera found. Please connect a camera and try again."
        );
      } else if (
        error.name === "NotReadableError" ||
        error.name === "TrackStartError"
      ) {
        throw new Error("Camera is already in use by another application.");
      } else if (error.name === "OverconstrainedError") {
        throw new Error("Camera does not support the requested settings.");
      } else if (error.name === "SecurityError") {
        throw new Error("Camera access is only allowed on HTTPS or localhost.");
      } else {
        throw error;
      }
    }
  }

  /**
   * Stop camera stream
   */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.isReady = false;
      this.logger.info("Camera stopped");
    }
  }

  /**
   * Switch camera (front/back)
   */
  async switchCamera() {
    const currentFacingMode = this.config.facingMode;
    this.config.facingMode =
      currentFacingMode === "user" ? "environment" : "user";

    this.stop();
    await this.start();
  }

  /**
   * Get available cameras
   */
  async getAvailableCameras() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        this.logger.warn("enumerateDevices not supported");
        return [];
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput");

      this.logger.info(`Found ${cameras.length} cameras`);
      return cameras;
    } catch (error) {
      this.logger.error("Failed to enumerate cameras:", error);
      return [];
    }
  }

  /**
   * Wait for video element to be ready
   */
  async waitForVideoReady() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Video ready timeout"));
      }, 10000);

      const checkReady = () => {
        if (this.videoElement.readyState >= 2) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      if (this.videoElement.readyState >= 2) {
        clearTimeout(timeout);
        resolve();
      } else {
        this.videoElement.addEventListener(
          "loadeddata",
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true }
        );

        checkReady();
      }
    });
  }

  /**
   * Get current video dimensions
   */
  getVideoDimensions() {
    return {
      width: this.videoElement.videoWidth,
      height: this.videoElement.videoHeight,
    };
  }

  /**
   * Capture frame as ImageData
   */
  captureFrame() {
    const canvas = document.createElement("canvas");
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(this.videoElement, 0, 0);

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  /**
   * Check if camera has specific capability
   */
  hasCapability(capability) {
    if (!this.stream) return false;

    const track = this.stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};

    return capability in capabilities;
  }

  /**
   * Apply constraint to camera
   */
  async applyConstraint(constraint, value) {
    if (!this.stream) {
      this.logger.warn("Cannot apply constraint: stream not active");
      return false;
    }

    try {
      const track = this.stream.getVideoTracks()[0];
      await track.applyConstraints({
        advanced: [{ [constraint]: value }],
      });

      this.logger.info(`Applied constraint: ${constraint} = ${value}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to apply constraint ${constraint}:`, error);
      return false;
    }
  }

  /**
   * Get camera capabilities
   */
  getCapabilities() {
    if (!this.stream) return {};

    const track = this.stream.getVideoTracks()[0];
    return track.getCapabilities ? track.getCapabilities() : {};
  }

  /**
   * Get current camera settings
   */
  getSettings() {
    if (!this.stream) return {};

    const track = this.stream.getVideoTracks()[0];
    return track.getSettings();
  }

  /**
   * Check if camera is ready
   */
  get ready() {
    return this.isReady && this.videoElement.readyState >= 2;
  }

  /**
   * Get video element
   */
  get video() {
    return this.videoElement;
  }
}
