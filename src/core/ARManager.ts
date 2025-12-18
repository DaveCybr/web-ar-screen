import type { Project } from "../types/index";
import { FileUtils } from "@/utils/fileUtils";

export class ARManager {
  private project: Project;
  private scene: HTMLElement;
  private assets: HTMLElement;
  private target: HTMLElement;
  private mediaElement: HTMLVideoElement | HTMLImageElement | null = null;

  constructor(project: Project) {
    this.project = project;
    this.scene = document.getElementById("ar-scene")!;
    this.assets = document.getElementById("ar-assets")!;
    this.target = document.getElementById("ar-target")!;
  }

  async initialize(): Promise<void> {
    await this.setupMarker();
    await this.setupContent();
    await this.waitForScene();
    await this.startTracking();
    this.setupEvents();
  }

  private async setupMarker(): Promise<void> {
    const { markerData, markerHosted, markerType } = this.project;

    let markerUrl: string;

    // ✅ CRITICAL FIX: Always fetch .mind files as binary (hosted or not)
    if (markerType === "mind") {
      console.log("🔄 Fetching .mind file from cloud...", markerData);
      console.log("📊 markerHosted:", markerHosted, "markerType:", markerType);

      try {
        // Dispatch loading event
        window.dispatchEvent(
          new CustomEvent("ar:loading", {
            detail: { message: "Downloading marker file..." },
          })
        );

        const response = await fetch(markerData, {
          method: "GET",
          mode: "cors",
          cache: "no-cache",
        });

        console.log(
          "📡 Response status:",
          response.status,
          response.statusText
        );
        console.log("📝 Response headers:", {
          contentType: response.headers.get("content-type"),
          contentLength: response.headers.get("content-length"),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch marker: ${response.status} ${response.statusText}`
          );
        }

        // Get as ArrayBuffer to preserve binary data
        const arrayBuffer = await response.arrayBuffer();
        console.log(
          `✅ Downloaded ${arrayBuffer.byteLength} bytes (${(
            arrayBuffer.byteLength / 1024
          ).toFixed(2)} KB)`
        );

        // Verify it's actually binary data
        const uint8Array = new Uint8Array(arrayBuffer);
        console.log("🔍 First 4 bytes:", Array.from(uint8Array.slice(0, 4)));

        // Create blob URL from binary data
        const blob = new Blob([arrayBuffer], {
          type: "application/octet-stream",
        });
        markerUrl = URL.createObjectURL(blob);
        console.log("✅ Blob URL created for .mind file:", markerUrl);
      } catch (error) {
        console.error("❌ Failed to fetch .mind file:", error);
        throw new Error(`Failed to load marker from cloud: ${error}`);
      }
    } else if (markerData.startsWith("data:")) {
      // Convert data URL to blob URL for local images
      console.log("Converting local image to blob URL...");
      const blob = FileUtils.dataURLToBlob(markerData);
      markerUrl = URL.createObjectURL(blob);
      console.log("✅ Blob URL created");
    } else {
      // Already a valid URL
      markerUrl = markerData;
    }

    // Set MindAR configuration
    this.scene.setAttribute(
      "mindar-image",
      `imageTargetSrc: ${markerUrl}; autoStart: false; uiLoading: no; uiScanning: no; uiError: no;`
    );

    this.target.setAttribute("mindar-image-target", "targetIndex: 0");
    console.log("✅ Marker configured:", this.project.markerName);
  }

  private async setupContent(): Promise<void> {
    const { contentData, contentType } = this.project;
    const isVideo = contentType.startsWith("video");

    if (isVideo) {
      const video = document.createElement("video");
      video.id = "ar-media";
      video.src = contentData;
      video.setAttribute("crossorigin", "anonymous");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.loop = true;
      video.muted = true;
      this.mediaElement = video;
      this.assets.appendChild(video);

      const videoEntity = document.createElement("a-video");
      videoEntity.setAttribute("src", "#ar-media");
      videoEntity.setAttribute("width", "1.6");
      videoEntity.setAttribute("height", "0.9");
      videoEntity.setAttribute("position", "0 0 0");
      this.target.appendChild(videoEntity);
    } else {
      const img = document.createElement("img");
      img.id = "ar-media";
      img.src = contentData;
      img.setAttribute("crossorigin", "anonymous");
      this.mediaElement = img;
      this.assets.appendChild(img);

      const imageEntity = document.createElement("a-image");
      imageEntity.setAttribute("src", "#ar-media");
      imageEntity.setAttribute("width", "1.6");
      imageEntity.setAttribute("height", "0.9");
      imageEntity.setAttribute("position", "0 0 0");
      this.target.appendChild(imageEntity);
    }

    this.addCornerMarkers();
    console.log("✅ Content configured:", this.project.contentName);
  }

  private addCornerMarkers(): void {
    const corners = document.createElement("a-entity");
    corners.innerHTML = `
      <a-box position="-0.82 0.47 0" scale="0.05 0.05 0.01" 
             material="color: #00ff88; emissive: #00ff88; emissiveIntensity: 0.5"></a-box>
      <a-box position="0.82 0.47 0" scale="0.05 0.05 0.01" 
             material="color: #00ff88; emissive: #00ff88; emissiveIntensity: 0.5"></a-box>
      <a-box position="-0.82 -0.47 0" scale="0.05 0.05 0.01" 
             material="color: #00ff88; emissive: #00ff88; emissiveIntensity: 0.5"></a-box>
      <a-box position="0.82 -0.47 0" scale="0.05 0.05 0.01" 
             material="color: #00ff88; emissive: #00ff88; emissiveIntensity: 0.5"></a-box>
    `;
    this.target.appendChild(corners);
  }

  private async waitForScene(): Promise<void> {
    return new Promise((resolve) => {
      if ((this.scene as any).hasLoaded) {
        resolve();
      } else {
        this.scene.addEventListener("loaded", () => resolve(), { once: true });
      }
    });
  }

  private async startTracking(): Promise<void> {
    const system = (this.scene as any).systems["mindar-image-system"];
    if (!system) {
      throw new Error("MindAR system not found");
    }

    await system.start();
    console.log("✅ Tracking started");
  }

  private setupEvents(): void {
    const isVideo = this.project.contentType.startsWith("video");

    // Listen for loading events
    window.addEventListener("ar:loading", ((e: CustomEvent) => {
      console.log("⏳", e.detail.message);
    }) as EventListener);

    this.target.addEventListener("targetFound", () => {
      console.log("✅ Target detected");
      window.dispatchEvent(new CustomEvent("ar:target-found"));

      if (isVideo && this.mediaElement instanceof HTMLVideoElement) {
        this.mediaElement.play().catch(() => {
          // this.mediaElement!.muted = true;
          (this.mediaElement as HTMLVideoElement).play();
        });
      }
    });

    this.target.addEventListener("targetLost", () => {
      console.log("⚠️ Target lost");
      window.dispatchEvent(new CustomEvent("ar:target-lost"));

      if (isVideo && this.mediaElement instanceof HTMLVideoElement) {
        if (!this.mediaElement.paused) {
          this.mediaElement.pause();
        }
      }
    });
  }
}
