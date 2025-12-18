export interface Project {
  id: string;
  name: string;
  markerData: string; // URL to hosted file or data URL for images
  markerType: "mind" | "image";
  markerName: string;
  markerSize: number;
  markerHosted: boolean; // true if uploaded to cloud
  contentData: string;
  contentType: string;
  contentName: string;
  contentSize: number;
  createdAt: number;
}

export interface StorageStats {
  count: number;
  totalSize: number;
}

export interface ARConfig {
  autoStart: boolean;
  uiLoading: string;
  uiScanning: string;
  uiError: string;
}

export interface UploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}
