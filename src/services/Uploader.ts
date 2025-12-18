import type { UploadResponse } from "@/types";

export class Uploader {
  // Cloudinary Configuration
  // Get yours at: https://console.cloudinary.com/
  private static CLOUD_NAME = "YOUR_CLOUD_NAME"; // e.g., "dxxxxx"
  private static UPLOAD_PRESET = "YOUR_UPLOAD_PRESET"; // e.g., "ml_default" or create unsigned preset

  /**
   * Configure Cloudinary credentials
   * Call this on app initialization with your credentials
   */
  static configure(cloudName: string, uploadPreset: string) {
    this.CLOUD_NAME = cloudName;
    this.UPLOAD_PRESET = uploadPreset;
  }

  /**
   * Upload file to Cloudinary
   * Returns permanent URL that can be used by MindAR
   */
  static async uploadFile(file: File): Promise<UploadResponse> {
    try {
      if (!this.CLOUD_NAME || this.CLOUD_NAME === "YOUR_CLOUD_NAME") {
        throw new Error(
          "Cloudinary not configured. Call CloudUploader.configure() first."
        );
      }

      console.log(`📤 Uploading ${file.name} to Cloudinary...`);

      // Create form data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", this.UPLOAD_PRESET);
      formData.append("resource_type", "raw"); // Important for .mind files
      formData.append("public_id", `ar-markers/${Date.now()}_${file.name}`);

      // Upload with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const uploadUrl = `https://api.cloudinary.com/v1_1/${this.CLOUD_NAME}/raw/upload`;

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error?.message || `Upload failed: ${response.statusText}`
        );
      }

      const data = await response.json();

      // Cloudinary returns secure_url for the uploaded file
      const url = data.secure_url;

      console.log(`✅ Upload successful: ${url}`);
      console.log(`📊 File info:`, {
        bytes: data.bytes,
        format: data.format,
        resource_type: data.resource_type,
      });

      return {
        success: true,
        url: url,
      };
    } catch (error) {
      console.error("❌ Upload error:", error);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return {
            success: false,
            error: "Upload timeout - file too large or slow connection",
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: "Unknown upload error",
      };
    }
  }

  /**
   * Validate if URL is accessible
   */
  static async validateUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Delete file from Cloudinary (requires authenticated API)
   * For simple usage, files auto-expire or manage via Cloudinary dashboard
   */
  static async deleteFile(publicId: string): Promise<boolean> {
    // This requires server-side implementation with API Secret
    // For now, manage deletions via Cloudinary dashboard
    console.warn(
      "Delete not implemented - manage files via Cloudinary dashboard"
    );
    return false;
  }
}
