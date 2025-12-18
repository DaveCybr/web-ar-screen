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
// CLOUDINARY CONFIGURATION
// Replace with your own credentials
// ==========================================
const CLOUDINARY_CLOUD_NAME = "dlf9pykus"; // e.g., "dxxxxx"
const CLOUDINARY_UPLOAD_PRESET = "ar_markers"; // e.g., "ar_markers"

const CLOUDINARY_API_KEY = "779388861916324";
const CLOUDINARY_API_SECRET = "hQcM99xTZjrKwGLZgH0bXY2YSsU";
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

  // Log A-Frame version for debugging
  if (typeof AFRAME !== "undefined") {
    console.log("✅ A-Frame version:", AFRAME.version);
  } else {
    console.error("❌ A-Frame not loaded from CDN!");
  }
});
