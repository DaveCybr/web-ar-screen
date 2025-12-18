import { StorageManager } from "@/core/StorageManager";
import { FileProcessor } from "@/core/FileProcessor";
import { ARManager } from "@/core/ARManager";
import { FileUtils } from "@/utils/fileUtils";
import type { Project } from "@/types";

export class UIController {
  private storage: StorageManager;
  private fileProcessor: FileProcessor;
  private currentProject: Partial<Project>;

  private elements = {
    startModal: document.getElementById("start-modal")!,
    loadingOverlay: document.getElementById("loading-overlay")!,
    loadingText: document.getElementById("loading-text")!,
    loadingProgress: document.getElementById("loading-progress")!,
    arUI: document.getElementById("ar-ui")!,
    statusBar: document.getElementById("status-bar")!,
    statusText: document.getElementById("status-text")!,
    statusDot: document.querySelector(".status-dot")!,
  };

  constructor() {
    this.storage = new StorageManager();
    this.fileProcessor = new FileProcessor();
    this.currentProject = {};
    this.init();
  }

  private async init(): Promise<void> {
    await this.storage.init();
    this.initTabs();
    this.initUpload();
    this.initButtons();
    this.setupAREvents();
  }

  private initTabs(): void {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetId = (tab as HTMLElement).dataset.tab!;

        document
          .querySelectorAll(".tab")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelectorAll(".tab-content")
          .forEach((c) => c.classList.remove("active"));

        tab.classList.add("active");
        document.getElementById(`${targetId}-tab`)!.classList.add("active");

        if (targetId === "cache") {
          this.refreshCacheList();
        }
      });
    });
  }

  private initUpload(): void {
    this.setupFileUpload("marker", (file) => this.handleMarkerFile(file));
    this.setupFileUpload("content", (file) => this.handleContentFile(file));
  }

  private setupFileUpload(type: string, handler: (file: File) => void): void {
    const zone = document.getElementById(`${type}-zone`)!;
    const input = document.getElementById(`${type}-input`)! as HTMLInputElement;

    zone.addEventListener("click", () => input.click());

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.style.borderColor = "var(--primary)";
    });

    zone.addEventListener("dragleave", () => {
      zone.style.borderColor = "#ddd";
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.style.borderColor = "#ddd";
      if (e.dataTransfer?.files.length) {
        handler(e.dataTransfer.files[0]);
      }
    });

    input.addEventListener("change", (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files?.length) {
        handler(files[0]);
      }
    });
  }

  private async handleMarkerFile(file: File): Promise<void> {
    const zone = document.getElementById("marker-zone")!;
    const preview = document.getElementById("marker-preview")!;

    try {
      zone.classList.remove("error");

      const processed = await this.fileProcessor.processMarkerFile(file);

      // ✅ Store all marker properties including hosted flag
      this.currentProject.markerData = processed.data;
      this.currentProject.markerType = processed.type;
      this.currentProject.markerName = processed.name;
      this.currentProject.markerSize = processed.size;
      this.currentProject.markerHosted = processed.hosted; // ✅ CRITICAL: Store hosted flag

      console.log("✅ UIController: Marker processed", {
        type: processed.type,
        hosted: processed.hosted,
        name: processed.name,
        dataPreview: processed.data.substring(0, 100) + "...",
      });

      preview.innerHTML = this.renderFilePreview(processed, "marker");
      preview.classList.add("visible");
      zone.classList.add("active");
      this.checkCanSave();

      console.log("✅ Marker loaded:", file.name);
    } catch (error) {
      console.error("❌ Marker error:", error);
      zone.classList.add("error");
      alert((error as Error).message);
    }
  }

  private async handleContentFile(file: File): Promise<void> {
    const zone = document.getElementById("content-zone")!;
    const preview = document.getElementById("content-preview")!;

    try {
      zone.classList.remove("error");

      const processed = await this.fileProcessor.processContentFile(file);

      this.currentProject.contentData = processed.data;
      this.currentProject.contentType = processed.type;
      this.currentProject.contentName = processed.name;
      this.currentProject.contentSize = processed.size;

      preview.innerHTML = this.renderFilePreview(processed, "content");
      preview.classList.add("visible");
      zone.classList.add("active");
      this.checkCanSave();

      console.log("✅ Content loaded:", file.name);
    } catch (error) {
      console.error("❌ Content error:", error);
      zone.classList.add("error");
      alert((error as Error).message);
    }
  }

  private renderFilePreview(data: any, type: string): string {
    const isVideo = data.type?.startsWith("video");
    const isImage = data.type?.startsWith("image") || type === "marker";
    const icon = isVideo ? "🎥" : isImage ? "🖼️" : "📄";

    let mediaPreview = "";
    if (isVideo) {
      mediaPreview = `<video src="${data.data}" class="preview-video" controls></video>`;
    } else if (isImage && data.type !== "mind") {
      mediaPreview = `<img src="${data.data}" class="preview-image" alt="${type}" />`;
    }

    return `
      ${mediaPreview}
      <div class="file-info">
        <div class="file-icon">${icon}</div>
        <div class="file-details">
          <div class="file-name">${data.name}</div>
          <div class="file-size">${FileUtils.formatSize(data.size)}</div>
        </div>
        <button class="file-remove" onclick="window.uiController.clear${
          type.charAt(0).toUpperCase() + type.slice(1)
        }()">✕</button>
      </div>
    `;
  }

  clearMarker(): void {
    this.currentProject.markerData = undefined;
    this.currentProject.markerType = undefined;
    this.currentProject.markerName = undefined;
    this.currentProject.markerSize = undefined;

    const preview = document.getElementById("marker-preview")!;
    preview.innerHTML = "";
    preview.classList.remove("visible");
    document.getElementById("marker-zone")!.classList.remove("active");
    (document.getElementById("marker-input")! as HTMLInputElement).value = "";

    this.checkCanSave();
  }

  clearContent(): void {
    this.currentProject.contentData = undefined;
    this.currentProject.contentType = undefined;
    this.currentProject.contentName = undefined;
    this.currentProject.contentSize = undefined;

    const preview = document.getElementById("content-preview")!;
    preview.innerHTML = "";
    preview.classList.remove("visible");
    document.getElementById("content-zone")!.classList.remove("active");
    (document.getElementById("content-input")! as HTMLInputElement).value = "";

    this.checkCanSave();
  }

  private checkCanSave(): void {
    const saveBtn = document.getElementById("save-btn")! as HTMLButtonElement;
    const canSave =
      this.currentProject.markerData && this.currentProject.contentData;
    saveBtn.disabled = !canSave;
  }

  private async saveAndStart(): Promise<void> {
    try {
      this.showLoading("Saving project to IndexedDB...");

      const project = await this.storage.save(
        this.currentProject as Omit<Project, "id" | "createdAt">
      );

      console.log("✅ Project saved, starting AR...");
      await this.startAR(project);
    } catch (error) {
      console.error("❌ Save error:", error);
      this.hideLoading();
      alert((error as Error).message || "Failed to save project");
    }
  }

  private async refreshCacheList(): Promise<void> {
    const cacheList = document.getElementById("cache-list")!;
    const projects = await this.storage.getAll();

    if (projects.length === 0) {
      cacheList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div>No cached projects yet</div>
        </div>
      `;
    } else {
      cacheList.innerHTML = projects
        .map((p) => this.renderCacheItem(p))
        .join("");
    }

    const stats = await this.storage.getStats();
    this.updateCacheStats(stats);
  }

  private renderCacheItem(project: Project): string {
    const icon = project.contentType?.startsWith("video") ? "🎥" : "🖼️";
    return `
      <div class="cache-item">
        <div class="cache-icon">${icon}</div>
        <div class="cache-details">
          <div class="cache-name">${project.name}</div>
          <div class="cache-meta">
            Marker: ${project.markerName} (${FileUtils.formatSize(
      project.markerSize || 0
    )})<br>
            Content: ${project.contentName} (${FileUtils.formatSize(
      project.contentSize || 0
    )})<br>
            Created: ${new Date(project.createdAt).toLocaleString()}
          </div>
          <div class="cache-actions">
            <button class="cache-btn cache-btn-use" onclick="window.uiController.loadProject('${
              project.id
            }')">
              ▶️ Use
            </button>
            <button class="cache-btn cache-btn-delete" onclick="window.uiController.deleteProject('${
              project.id
            }')">
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private updateCacheStats(stats: any): void {
    document.querySelector(
      "#cache-stats .stat:nth-child(1) .stat-value"
    )!.textContent = stats.count.toString();
    document.querySelector(
      "#cache-stats .stat:nth-child(2) .stat-value"
    )!.textContent = FileUtils.formatSize(stats.totalSize);
    document.querySelector(
      "#cache-stats .stat:nth-child(3) .stat-value"
    )!.textContent = stats.count > 0 ? "✅ OK" : "📭";
  }

  async loadProject(id: string): Promise<void> {
    try {
      this.showLoading("Loading project...");
      const project = await this.storage.get(id);

      if (!project) {
        throw new Error("Project not found");
      }

      await this.startAR(project);
    } catch (error) {
      console.error("❌ Load error:", error);
      this.hideLoading();
      alert((error as Error).message || "Failed to load project");
    }
  }

  async deleteProject(id: string): Promise<void> {
    if (confirm("Delete this project?")) {
      await this.storage.delete(id);
      this.refreshCacheList();
    }
  }

  private initButtons(): void {
    document.getElementById("save-btn")!.addEventListener("click", () => {
      this.saveAndStart();
    });

    document
      .getElementById("clear-all-btn")!
      .addEventListener("click", async () => {
        if (confirm("Delete ALL projects? This cannot be undone!")) {
          await this.storage.clearAll();
          this.refreshCacheList();
        }
      });

    document.getElementById("menu-btn")!.addEventListener("click", () => {
      if (confirm("Return to menu? AR session will stop.")) {
        window.location.reload();
      }
    });

    document.getElementById("reload-btn")!.addEventListener("click", () => {
      if (confirm("Reload AR scene?")) {
        window.location.reload();
      }
    });
  }

  private setupAREvents(): void {
    window.addEventListener("ar:target-found", () => {
      this.updateStatus("Target detected • Active", true);
    });

    window.addEventListener("ar:target-lost", () => {
      this.updateStatus("Scanning for marker...", false);
    });
  }

  private async startAR(project: Project): Promise<void> {
    try {
      this.elements.startModal.classList.add("hidden");
      this.elements.loadingOverlay.classList.remove("hidden");
      this.setLoadingText("Requesting camera access...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());
      console.log("✅ Camera permission granted");

      this.setLoadingText("Initializing AR system...");

      const arManager = new ARManager(project);
      await arManager.initialize();

      this.hideLoading();
      this.elements.arUI.classList.add("visible");
      this.elements.statusBar.classList.add("visible");

      console.log("🎬 AR session started");
    } catch (error) {
      console.error("❌ AR start error:", error);
      this.setLoadingText("Camera access denied");
      this.setLoadingProgress("Please allow camera permission and try again");
      setTimeout(() => window.location.reload(), 3000);
    }
  }

  private showLoading(text: string): void {
    this.elements.loadingOverlay.classList.remove("hidden");
    this.setLoadingText(text);
  }

  private hideLoading(): void {
    this.elements.loadingOverlay.classList.add("hidden");
  }

  private setLoadingText(text: string): void {
    this.elements.loadingText.textContent = text;
  }

  private setLoadingProgress(text: string): void {
    this.elements.loadingProgress.textContent = text;
  }

  private updateStatus(text: string, active = false): void {
    this.elements.statusText.textContent = text;
    if (active) {
      this.elements.statusDot.classList.add("active");
    } else {
      this.elements.statusDot.classList.remove("active");
    }
  }
}
