import type { UploadResponse } from "@/types";

export class Uploader {
  private static CLOUD_NAME = "YOUR_CLOUD_NAME";
  private static UPLOAD_PRESET = "YOUR_UPLOAD_PRESET";

  // File size limits
  private static MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  // Allowed file extensions
  private static ALLOWED_EXTENSIONS = [
    ".mind",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
  ];

  /**
   * Configure Cloudinary credentials
   */
  static configure(cloudName: string, uploadPreset: string) {
    this.CLOUD_NAME = cloudName;
    this.UPLOAD_PRESET = uploadPreset;

    console.log("✅ Cloudinary configured:", {
      cloudName,
      uploadPreset,
      maxFileSize: this.formatBytes(this.MAX_FILE_SIZE),
    });
  }

  /**
   * Upload file to Cloudinary with progress tracking
   */
  static async uploadFile(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<UploadResponse> {
    try {
      // Validate configuration
      if (!this.CLOUD_NAME || this.CLOUD_NAME === "YOUR_CLOUD_NAME") {
        return {
          success: false,
          error:
            "⚠️ Cloudinary not configured. Please set your credentials in main.ts",
        };
      }

      // Validate file size
      if (file.size > this.MAX_FILE_SIZE) {
        return {
          success: false,
          error: `File too large. Maximum size: ${this.formatBytes(
            this.MAX_FILE_SIZE
          )}`,
        };
      }

      // Validate file extension
      const ext = this.getFileExtension(file.name);
      if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
        return {
          success: false,
          error: `Invalid file type. Allowed: ${this.ALLOWED_EXTENSIONS.join(
            ", "
          )}`,
        };
      }

      console.log(`📤 Uploading ${file.name}...`, {
        size: this.formatBytes(file.size),
        type: file.type,
      });

      // Create form data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", this.UPLOAD_PRESET);
      formData.append("resource_type", "raw");
      formData.append("folder", "ar-markers");
      formData.append(
        "public_id",
        `${Date.now()}_${file.name.replace(/\.[^/.]+$/, "")}`
      );

      // Upload with XMLHttpRequest for progress tracking
      const uploadUrl = `https://api.cloudinary.com/v1_1/${this.CLOUD_NAME}/raw/upload`;

      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();

        // Progress tracking
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable && onProgress) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        });

        // Success
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              console.log("✅ Upload successful:", {
                url: data.secure_url,
                bytes: this.formatBytes(data.bytes),
                format: data.format,
              });

              resolve({
                success: true,
                url: data.secure_url,
              });
            } catch (e) {
              resolve({
                success: false,
                error: "Failed to parse upload response",
              });
            }
          } else {
            // Handle HTTP errors
            let errorMessage = "Upload failed";

            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage = this.getErrorMessage(xhr.status, errorData);
            } catch (e) {
              errorMessage = `Upload failed: ${xhr.statusText}`;
            }

            console.error("❌ Upload error:", errorMessage);
            resolve({
              success: false,
              error: errorMessage,
            });
          }
        });

        // Network error
        xhr.addEventListener("error", () => {
          console.error("❌ Network error during upload");
          resolve({
            success: false,
            error: "Network error - check your internet connection",
          });
        });

        // Timeout
        xhr.addEventListener("timeout", () => {
          console.error("❌ Upload timeout");
          resolve({
            success: false,
            error: "Upload timeout - file too large or slow connection",
          });
        });

        // Set timeout (60 seconds)
        xhr.timeout = 60000;

        // Send request
        xhr.open("POST", uploadUrl);
        xhr.send(formData);
      });
    } catch (error) {
      console.error("❌ Upload error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown upload error",
      };
    }
  }

  /**
   * Get user-friendly error message
   */
  private static getErrorMessage(status: number, errorData: any): string {
    const errorMap: Record<number, string> = {
      400: "❌ Invalid request - check upload preset configuration",
      401: "🔒 Authentication failed - check your cloud name",
      403: '🚫 Upload preset not found or not configured as "unsigned"',
      413: "📦 File too large",
      429: "⏱️ Too many requests - please wait and try again",
    };

    // Try to get specific error message
    const specificError = errorData?.error?.message || errorData?.message;

    if (specificError) {
      if (specificError.includes("preset")) {
        return '❌ Upload preset "ar_markers" not found.\n\n📋 Setup Instructions:\n1. Go to: https://console.cloudinary.com/settings/upload\n2. Click "Add upload preset"\n3. Set Mode: Unsigned\n4. Set Name: ar_markers\n5. Save';
      }
      return `❌ ${specificError}`;
    }

    return errorMap[status] || `Upload failed (${status})`;
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
   * Format bytes to human readable
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Get file extension
   */
  private static getFileExtension(filename: string): string {
    return "." + filename.split(".").pop()?.toLowerCase() || "";
  }

  /**
   * Delete file from Cloudinary (requires server-side implementation)
   */
  static async deleteFile(publicId: string): Promise<boolean> {
    console.warn(
      "⚠️ Delete requires server-side implementation with API Secret.\nManage files via Cloudinary dashboard: https://console.cloudinary.com/"
    );
    return false;
  }
}
