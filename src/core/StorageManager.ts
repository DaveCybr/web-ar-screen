import { DB_NAME, DB_VERSION, STORE_NAME } from '@/utils/constants';
import type { Project, StorageStats } from '@/types';

export class StorageManager {
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('✅ IndexedDB store created');
        }
      };
    });
  }

  async save(project: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const data: Project = {
        ...project,
        id: `project_${Date.now()}`,
        createdAt: Date.now()
      };

      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(data);

      request.onsuccess = () => {
        console.log('✅ Project saved:', data.id);
        resolve(data);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getAll(): Promise<Project[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const projects = request.result.sort(
          (a, b) => b.createdAt - a.createdAt
        );
        resolve(projects);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async get(id: string): Promise<Project | undefined> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('🗑️ Project deleted:', id);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('🗑️ All projects cleared');
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getStats(): Promise<StorageStats> {
    const projects = await this.getAll();
    const totalSize = projects.reduce((sum, p) => {
      return sum + (p.markerSize || 0) + (p.contentSize || 0);
    }, 0);

    return {
      count: projects.length,
      totalSize
    };
  }
}