import "aframe";
import { UIController } from "./ui/UIController";

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  const uiController = new UIController();
  (window as any).uiController = uiController;

  console.log("🚀 AR Content Manager initialized");
  console.log("📱 Device:", navigator.userAgent);
  console.log("💾 IndexedDB available:", "indexedDB" in window);
});
