/**
 * OpenCV.js Loader with build detection
 */

async function loadOpenCV() {
  // Check for WebAssembly support
  if (typeof WebAssembly !== "object") {
    throw new Error("WebAssembly not supported");
  }

  // Detect best build
  let buildPath = "https://docs.opencv.org/4.x/opencv.js";

  // Try to use local builds if available
  if (typeof wasmFeatureDetect !== "undefined") {
    const [hasSimd, hasThreads] = await Promise.all([
      wasmFeatureDetect.simd(),
      wasmFeatureDetect.threads(),
    ]);

    if (hasSimd && hasThreads) {
      buildPath = "opencv/builds/threadsSimd/opencv.js";
    } else if (hasSimd) {
      buildPath = "opencv/builds/simd/opencv.js";
    } else {
      buildPath = "opencv/builds/wasm/opencv.js";
    }
  }

  // Load OpenCV
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = buildPath;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Initialize
loadOpenCV()
  .then(() => {
    console.log("OpenCV loaded");
  })
  .catch((err) => {
    console.error("Failed to load OpenCV:", err);
  });
