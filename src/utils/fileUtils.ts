export class FileUtils {
  static readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  static readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  static formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  }

  static createBlobURL(data: ArrayBuffer, type: string): string {
    const blob = new Blob([data], { type });
    return URL.createObjectURL(blob);
  }

  static validateFile(file: File, maxSize: number): boolean {
    return file.size <= maxSize;
  }

  static getFileExtension(filename: string): string {
    return filename.split(".").pop()?.toLowerCase() || "";
  }

  // Convert data URL to Blob
  static dataURLToBlob(dataURL: string): Blob {
    const arr = dataURL.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "application/octet-stream";
    const bstr = atob(arr[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
  }

  // Convert base64 data URL to Blob URL
  static dataURLToBlobURL(dataURL: string): string {
    const blob = this.dataURLToBlob(dataURL);
    return URL.createObjectURL(blob);
  }
}
