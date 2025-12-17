import { FILE_SIZE_LIMIT } from "./constants";
import { FileUtils } from "./fileUtils";

export class Validators {
  static isValidMarkerFile(file: File): boolean {
    const ext = file.name.split(".").pop()?.toLowerCase();
    return ext === "mind" || file.type.startsWith("image/");
  }

  static isValidContentFile(file: File): boolean {
    return file.type.startsWith("video/") || file.type.startsWith("image/");
  }

  static checkFileSize(file: File): { valid: boolean; message?: string } {
    if (file.size > FILE_SIZE_LIMIT) {
      return {
        valid: false,
        message: `File too large. Max size: ${FileUtils.formatSize(
          FILE_SIZE_LIMIT
        )}`,
      };
    }
    return { valid: true };
  }

  static isMindFile(filename: string): boolean {
    return filename.toLowerCase().endsWith(".mind");
  }
}
