/**
 * AR Renderer - dengan Three.js ES Module
 */

import { Logger } from "../utils/Logger.js";

// Import Three.js from global scope (loaded via importmap)
// const THREE = window.THREE || (await import("three"));

export class ARRenderer {
  constructor(canvasId, videoElement, config) {
    this.logger = new Logger("ARRenderer");
    this.canvasId = canvasId;
    this.videoElement = videoElement;
    this.config = config;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.contentPlane = null;
    this.currentTarget = null;
    this.videoTexture = null;
    this.contentVideo = null;
    this.isVideoPlaying = false;

    this.targetContent = new Map();
  }

  async init() {
    const canvas = document.getElementById(this.canvasId);

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    const aspect = canvas.width / canvas.height;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.z = 5;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: this.config.antialias,
    });
    this.renderer.setPixelRatio(this.config.pixelRatio);
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setClearColor(0x000000, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 10, 10);
    this.scene.add(directionalLight);

    // Start render loop
    this.animate();

    this.logger.info("AR renderer initialized with Three.js ES Module");
  }

  setTargetContent(targetId, videoUrl) {
    this.targetContent.set(targetId, {
      type: "video",
      url: videoUrl,
    });
    this.logger.info(`Video content set for target: ${targetId}`);
  }

  loadVideoTexture(videoUrl) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.src = videoUrl;
      video.crossOrigin = "anonymous";
      video.loop = true;
      video.muted = false;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");

      video.addEventListener("loadeddata", () => {
        this.logger.info("Video loaded successfully");
        resolve(video);
      });

      video.addEventListener("error", (e) => {
        this.logger.error("Video loading error:", e);
        reject(e);
      });

      video.load();
    });
  }

  async setTarget(detection) {
    if (!detection.success) return;

    this.currentTarget = detection;

    const content = this.targetContent.get(detection.targetId);

    if (content && content.type === "video") {
      await this.showVideoContent(detection, content.url);
    } else {
      this.showPlaceholder(detection);
    }
  }

  async showVideoContent(detection, videoUrl) {
    try {
      if (!this.contentVideo || this.contentVideo.src !== videoUrl) {
        this.logger.info("Loading video:", videoUrl);
        this.contentVideo = await this.loadVideoTexture(videoUrl);

        this.videoTexture = new THREE.VideoTexture(this.contentVideo);
        this.videoTexture.minFilter = THREE.LinearFilter;
        this.videoTexture.magFilter = THREE.LinearFilter;
        this.videoTexture.format = THREE.RGBAFormat;
      }

      if (!this.contentPlane) {
        this.createVideoPlane(detection);
      } else {
        this.updatePlaneTransform(detection);
      }

      if (!this.isVideoPlaying) {
        this.playVideo();
      }
    } catch (error) {
      this.logger.error("Failed to show video content:", error);
      this.showPlaceholder(detection);
    }
  }

  createVideoPlane(detection) {
    const target = detection.target;
    const aspectRatio = target.width / target.height;

    const planeWidth = 2;
    const planeHeight = planeWidth / aspectRatio;

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

    const material = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
    });

    this.contentPlane = new THREE.Mesh(geometry, material);
    this.scene.add(this.contentPlane);

    this.updatePlaneTransform(detection);

    this.logger.info("Video plane created");
  }

  updatePlaneTransform(detection) {
    if (!this.contentPlane || !detection.homography) return;

    try {
      const corners = detection.corners;

      const centerX =
        (corners.topLeft.x +
          corners.topRight.x +
          corners.bottomLeft.x +
          corners.bottomRight.x) /
        4;
      const centerY =
        (corners.topLeft.y +
          corners.topRight.y +
          corners.bottomLeft.y +
          corners.bottomRight.y) /
        4;

      const canvas = this.renderer.domElement;
      const normalizedX = (centerX / canvas.width) * 2 - 1;
      const normalizedY = -((centerY / canvas.height) * 2 - 1);

      this.contentPlane.position.set(normalizedX * 3, normalizedY * 3, 0);

      const width = Math.sqrt(
        Math.pow(corners.topRight.x - corners.topLeft.x, 2) +
          Math.pow(corners.topRight.y - corners.topLeft.y, 2)
      );
      const height = Math.sqrt(
        Math.pow(corners.bottomLeft.x - corners.topLeft.x, 2) +
          Math.pow(corners.bottomLeft.y - corners.topLeft.y, 2)
      );

      const scaleX = (width / canvas.width) * 6;
      const scaleY = (height / canvas.height) * 6;

      this.contentPlane.scale.set(scaleX, scaleY, 1);

      const angle = Math.atan2(
        corners.topRight.y - corners.topLeft.y,
        corners.topRight.x - corners.topLeft.x
      );

      this.contentPlane.rotation.z = -angle;

      if (this.config.smoothTransitions) {
        this.contentPlane.position.lerp(this.contentPlane.position, 0.3);
        this.contentPlane.rotation.z *= 0.7;
      }
    } catch (error) {
      this.logger.error("Failed to update plane transform:", error);
    }
  }

  showPlaceholder(detection) {
    if (!this.contentPlane) {
      const geometry = new THREE.PlaneGeometry(2, 2);
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      this.contentPlane = new THREE.Mesh(geometry, material);
      this.scene.add(this.contentPlane);
    }

    this.updatePlaneTransform(detection);
  }

  async playVideo() {
    if (!this.contentVideo) return;

    try {
      await this.contentVideo.play();
      this.isVideoPlaying = true;
      this.logger.info("Video playing");
    } catch (error) {
      this.logger.error("Failed to play video:", error);

      document.addEventListener(
        "click",
        async () => {
          try {
            await this.contentVideo.play();
            this.isVideoPlaying = true;
          } catch (e) {
            this.logger.error("Still failed to play video:", e);
          }
        },
        { once: true }
      );
    }
  }

  pauseVideo() {
    if (this.contentVideo && this.isVideoPlaying) {
      this.contentVideo.pause();
      this.isVideoPlaying = false;
      this.logger.info("Video paused");
    }
  }

  stopVideo() {
    if (this.contentVideo) {
      this.contentVideo.pause();
      this.contentVideo.currentTime = 0;
      this.isVideoPlaying = false;
      this.logger.info("Video stopped");
    }
  }

  clearTarget() {
    if (this.contentPlane) {
      if (this.config.smoothTransitions) {
        const fadeOut = () => {
          if (this.contentPlane.material.opacity > 0) {
            this.contentPlane.material.opacity -= 0.05;
            requestAnimationFrame(fadeOut);
          } else {
            this.scene.remove(this.contentPlane);
            this.contentPlane = null;
          }
        };
        fadeOut();
      } else {
        this.scene.remove(this.contentPlane);
        this.contentPlane = null;
      }
    }

    this.pauseVideo();
    this.currentTarget = null;
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.videoTexture && this.isVideoPlaying) {
      this.videoTexture.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(width, height) {
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  destroy() {
    this.stopVideo();

    if (this.videoTexture) {
      this.videoTexture.dispose();
    }

    if (this.contentPlane) {
      this.scene.remove(this.contentPlane);
      this.contentPlane.geometry.dispose();
      this.contentPlane.material.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    this.logger.info("AR renderer destroyed");
  }
}
