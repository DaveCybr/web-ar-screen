// ==========================================
// CRITICAL FIX: DO NOT import "aframe" here!
// A-Frame is loaded via CDN in index.html
// ==========================================

import { UIController } from "./ui/UIController";
import { Uploader } from "./services/Uploader";

// Declare AFRAME as global for TypeScript
declare global {
  interface Window {
    AFRAME: any;
    uiController: UIController;
  }
  const AFRAME: any;
}

// ==========================================
// CLOUDINARY CONFIGURATION (SECURE)
// Only use unsigned upload preset - NO API SECRET!
// ==========================================
const CLOUDINARY_CLOUD_NAME = "dlf9pykus";
const CLOUDINARY_UPLOAD_PRESET = "ar_markers"; // Must be UNSIGNED preset

// ❌ REMOVED: API_SECRET - NEVER expose secrets in client!
// If you need authenticated operations, use a backend server

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  // Configure Cloudinary
  Uploader.configure(CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET);

  const uiController = new UIController();
  window.uiController = uiController;

  console.log("🚀 AR Content Manager initialized");
  console.log("📱 Device:", navigator.userAgent);
  console.log("💾 IndexedDB available:", "indexedDB" in window);
  console.log("☁️ Cloudinary configured:", CLOUDINARY_CLOUD_NAME);
  console.log("📦 Upload preset:", CLOUDINARY_UPLOAD_PRESET);

  // Log A-Frame version for debugging
  if (typeof AFRAME !== "undefined") {
    console.log("✅ A-Frame version:", AFRAME.version);
  } else {
    console.error("❌ A-Frame not loaded from CDN!");
  }

  // Display configuration help
  console.log(
    "%c📋 Cloudinary Setup Instructions:",
    "color: #667eea; font-weight: bold; font-size: 14px"
  );
  console.log("1. Go to: https://console.cloudinary.com/settings/upload");
  console.log("2. Click 'Add upload preset'");
  console.log("3. Set Signing Mode: Unsigned");
  console.log("4. Set Preset name: ar_markers");
  console.log("5. Set Folder: ar-markers (optional)");
  console.log("6. Save preset");
});

// Add this to main.ts or create a separate debug.ts file

export class StorageDebugger {
  static async debugCurrentProject() {
    const dbName = "ARContentDB";
    const storeName = "projects";

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);

      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction([storeName], "readonly");
        const store = tx.objectStore(storeName);
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          const projects = getAllRequest.result;
          console.log("📦 Total projects in IndexedDB:", projects.length);

          projects.forEach((project, index) => {
            console.group(`🔍 Project ${index + 1}: ${project.id}`);
            console.log("Name:", project.name);
            console.log("Marker Type:", project.markerType);
            console.log("Marker Hosted:", project.markerHosted); // ✅ CHECK THIS
            console.log(
              "Marker Data (first 100 chars):",
              project.markerData?.substring(0, 100)
            );
            console.log("Content Type:", project.contentType);
            console.log(
              "Created:",
              new Date(project.createdAt).toLocaleString()
            );
            console.groupEnd();
          });

          resolve(projects);
        };

        getAllRequest.onerror = () => reject(getAllRequest.error);
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// Usage: Add to browser console or call from main.ts
// StorageDebugger.debugCurrentProject();
