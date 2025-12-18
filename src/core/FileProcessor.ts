import { Uploader } from "../services/Uploader";
import { FileUtils } from "@/utils/fileUtils";
import { Validators } from "@/utils/validators";

export class FileProcessor {
  /**
   * Process marker file - Upload .mind files to cloud, keep images local
   */
  async processMarkerFile(
    file: File,
    onProgress?: (message: string) => void
  ): Promise<{
    data: string;
    type: "mind" | "image";
    name: string;
    size: number;
    hosted: boolean;
  }> {
    if (!Validators.isValidMarkerFile(file)) {
      throw new Error("Invalid marker file type");
    }

    const sizeCheck = Validators.checkFileSize(file);
    if (!sizeCheck.valid) {
      throw new Error(sizeCheck.message);
    }

    if (Validators.isMindFile(file.name)) {
      // CRITICAL: Upload .mind files to cloud for permanent URL
      onProgress?.("Uploading marker to Cloudinary...");

      const uploadResult = await Uploader.uploadFile(file);

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(
          uploadResult.error || "Failed to upload marker to cloud"
        );
      }

      onProgress?.("Marker uploaded successfully!");

      return {
        data: uploadResult.url, // Permanent cloud URL
        type: "mind",
        name: file.name,
        size: file.size,
        hosted: true,
      };
    } else {
      // For images, store locally as data URL
      const dataUrl = await FileUtils.readAsDataURL(file);
      return {
        data: dataUrl,
        type: "image",
        name: file.name,
        size: file.size,
        hosted: false,
      };
    }
  }

  async processContentFile(file: File): Promise<{
    data: string;
    type: string;
    name: string;
    size: number;
  }> {
    if (!Validators.isValidContentFile(file)) {
      throw new Error("Invalid content file type");
    }

    const sizeCheck = Validators.checkFileSize(file);
    if (!sizeCheck.valid) {
      throw new Error(sizeCheck.message);
    }

    const dataUrl = await FileUtils.readAsDataURL(file);

    return {
      data: dataUrl,
      type: file.type,
      name: file.name,
      size: file.size,
    };
  }
}
