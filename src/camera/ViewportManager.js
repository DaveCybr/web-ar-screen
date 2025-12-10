/**
 * Viewport Manager - Handles responsive canvas sizing
 */

import { Logger } from "../utils/Logger.js";

export class ViewportManager {
  constructor() {
    this.logger = new Logger("ViewportManager");
    this.orientation = this.getOrientation();
  }

  init() {
    window.addEventListener("resize", () => this.handleResize());
    window.addEventListener("orientationchange", () =>
      this.handleOrientationChange()
    );
    this.handleResize();
  }

  handleResize() {
    const canvases = ["outputCanvas", "arCanvas"];
    canvases.forEach((id) => {
      const canvas = document.getElementById(id);
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    });
  }

  handleOrientationChange() {
    const newOrientation = this.getOrientation();
    if (newOrientation !== this.orientation) {
      this.orientation = newOrientation;
      this.logger.info("Orientation changed:", this.orientation);
    }
  }

  getOrientation() {
    return window.innerWidth > window.innerHeight ? "landscape" : "portrait";
  }
}
