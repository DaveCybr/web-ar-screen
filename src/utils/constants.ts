export const DB_NAME = 'ARContentDB';
export const DB_VERSION = 1;
export const STORE_NAME = 'projects';

export const MIME_TYPES = {
  MIND: 'application/octet-stream',
  VIDEO: 'video/',
  IMAGE: 'image/'
} as const;

export const FILE_SIZE_LIMIT = 100 * 1024 * 1024; // 100MB

export const COLORS = {
  PRIMARY: '#667eea',
  SECONDARY: '#764ba2',
  SUCCESS: '#00ff88',
  ERROR: '#ff4444',
  WARNING: '#ffa500'
} as const;
