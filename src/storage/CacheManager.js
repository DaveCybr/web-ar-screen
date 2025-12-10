/**
 * Cache Manager - IndexedDB storage dengan Video Support
 */

import { Logger } from "../utils/Logger.js";

export class CacheManager {
  constructor(config) {
    this.logger = new Logger("CacheManager");
    this.config = config;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      // Increment version to force upgrade
      const request = indexedDB.open(this.config.dbName, 2);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.logger.info("Cache manager initialized (v2)");
        resolve();
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Targets store
        if (!db.objectStoreNames.contains("targets")) {
          db.createObjectStore("targets", { keyPath: "id" });
          this.logger.info("Created 'targets' object store");
        }

        // Videos store (NEW)
        if (!db.objectStoreNames.contains("videos")) {
          const videoStore = db.createObjectStore("videos", { keyPath: "id" });
          videoStore.createIndex("by_target", "id", { unique: false });
          this.logger.info("Created 'videos' object store");
        }

        // Cache store
        if (!db.objectStoreNames.contains("cache")) {
          db.createObjectStore("cache");
          this.logger.info("Created 'cache' object store");
        }

        this.logger.info("Database schema updated to v2");
      };
    });
  }

  async set(storeName, key, value) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction([storeName], "readwrite");
        const store = tx.objectStore(storeName);

        // Untuk videos store, tambahkan id sebagai key
        if (storeName === "videos") {
          value.id = key;
        }

        const request = store.put(value);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (error) {
        this.logger.error(`Failed to set ${storeName}:`, error);
        reject(error);
      }
    });
  }

  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction([storeName], "readonly");
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (error) {
        this.logger.error(`Failed to get ${storeName}:`, error);
        reject(error);
      }
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction([storeName], "readonly");
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (error) {
        this.logger.error(`Failed to get all ${storeName}:`, error);
        resolve([]); // Return empty array on error
      }
    });
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction([storeName], "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (error) {
        this.logger.error(`Failed to delete ${storeName}:`, error);
        reject(error);
      }
    });
  }

  async clear() {
    const stores = ["targets", "videos", "cache"];
    for (const store of stores) {
      try {
        await new Promise((resolve, reject) => {
          const tx = this.db.transaction([store], "readwrite");
          const request = tx.objectStore(store).clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        this.logger.warn(`Failed to clear ${store}:`, error);
      }
    }
    this.logger.info("All caches cleared");
  }

  /**
   * Get storage usage estimate
   */
  async getStorageUsage() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percentUsed: (estimate.usage / estimate.quota) * 100,
      };
    }
    return null;
  }

  /**
   * Check if storage is persistent
   */
  async isPersistent() {
    if (navigator.storage && navigator.storage.persisted) {
      return await navigator.storage.persisted();
    }
    return false;
  }

  /**
   * Request persistent storage
   */
  async requestPersistence() {
    if (navigator.storage && navigator.storage.persist) {
      const granted = await navigator.storage.persist();
      this.logger.info(`Persistent storage: ${granted ? "granted" : "denied"}`);
      return granted;
    }
    return false;
  }
}
