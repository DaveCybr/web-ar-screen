export interface Project {
  id: string;
  name: string;
  markerData: string;
  markerType: 'mind' | 'image';
  markerName: string;
  markerSize: number;
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