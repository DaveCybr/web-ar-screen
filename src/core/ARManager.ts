// ==========================================
// FILE: src/core/ARManager.ts
// ==========================================
import type { Project } from "../types/index";

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
    const { markerData } = this.project;

    this.scene.setAttribute(
      "mindar-image",
      JSON.stringify({
        imageTargetSrc: markerData,
        autoStart: false,
        uiLoading: "no",
        uiScanning: "no",
        uiError: "no",
      })
    );

    this.target.setAttribute("mindar-image-target", "targetIndex: 0");
    console.log("✅ Marker configured");
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
    console.log("✅ Content configured");
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

    this.target.addEventListener("targetFound", () => {
      console.log("✅ Target detected");
      window.dispatchEvent(new CustomEvent("ar:target-found"));

      if (isVideo && this.mediaElement instanceof HTMLVideoElement) {
        this.mediaElement.play().catch(() => {
          this.mediaElement!.muted = true;
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
