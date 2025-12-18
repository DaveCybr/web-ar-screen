// ==========================================
// CRITICAL FIX: DO NOT import "aframe" here!
// A-Frame is loaded via CDN in index.html
// ==========================================

import { UIController } from "./ui/UIController";

// Declare AFRAME as global for TypeScript
declare global {
  interface Window {
    AFRAME: any;
    uiController: UIController;
  }
  const AFRAME: any;
}

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  const uiController = new UIController();
  window.uiController = uiController;

  console.log("🚀 AR Content Manager initialized");
  console.log("📱 Device:", navigator.userAgent);
  console.log("💾 IndexedDB available:", "indexedDB" in window);

  // Log A-Frame version for debugging
  if (typeof AFRAME !== "undefined") {
    console.log("✅ A-Frame version:", AFRAME.version);
  } else {
    console.error("❌ A-Frame not loaded from CDN!");
  }
});
