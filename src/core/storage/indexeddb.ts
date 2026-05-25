/**
 * IndexedDB 键值存储封装
 * 模拟 chrome.storage 接口，支持对象存取
 */

const DB_NAME = 'TIGERMARKIII';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.initPromise = null;
        reject(request.error ?? new Error('IndexedDB open failed'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });

    return this.initPromise;
  }

  private async ensureDB(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }
    return this.db;
  }

  /**
   * 模拟 chrome.storage.get
   * keys: string | string[] | null
   * 返回 Record<string, any>
   */
  async get(keys: string | string[] | null): Promise<Record<string, any>> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      if (keys === null) {
        // 获取所有
        const request = store.getAllKeys();
        request.onsuccess = () => {
          const allKeys = request.result as string[];
          const result: Record<string, any> = {};
          let pending = allKeys.length;
          if (pending === 0) {
            resolve(result);
            return;
          }
          allKeys.forEach((key) => {
            const getReq = store.get(key);
            getReq.onsuccess = () => {
              result[key] = getReq.result;
              pending--;
              if (pending === 0) resolve(result);
            };
            getReq.onerror = () => reject(getReq.error);
          });
        };
        request.onerror = () => reject(request.error);
      } else if (Array.isArray(keys)) {
        const result: Record<string, any> = {};
        let pending = keys.length;
        if (pending === 0) {
          resolve(result);
          return;
        }
        keys.forEach((key) => {
          const request = store.get(key);
          request.onsuccess = () => {
            if (request.result !== undefined) {
              result[key] = request.result;
            }
            pending--;
            if (pending === 0) resolve(result);
          };
          request.onerror = () => reject(request.error);
        });
      } else {
        // 单个 key
        const request = store.get(keys);
        request.onsuccess = () => {
          const result: Record<string, any> = {};
          if (request.result !== undefined) {
            result[keys] = request.result;
          }
          resolve(result);
        };
        request.onerror = () => reject(request.error);
      }
    });
  }

  /**
   * 模拟 chrome.storage.set
   */
  async set(items: Record<string, any>): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const keys = Object.keys(items);
      let pending = keys.length;

      if (pending === 0) {
        resolve();
        return;
      }

      keys.forEach((key) => {
        const request = store.put(items[key], key);
        request.onsuccess = () => {
          pending--;
          if (pending === 0) resolve();
        };
        request.onerror = () => reject(request.error);
      });

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * 模拟 chrome.storage.remove
   */
  async remove(keys: string | string[]): Promise<void> {
    const db = await this.ensureDB();
    const keyList = Array.isArray(keys) ? keys : [keys];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      let pending = keyList.length;

      keyList.forEach((key) => {
        const request = store.delete(key);
        request.onsuccess = () => {
          pending--;
          if (pending === 0) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * 模拟 chrome.storage.clear
   */
  async clear(): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取已用字节数（近似值）
   */
  async getBytesInUse(): Promise<number> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result;
        let bytes = 0;
        items.forEach((item: any) => {
          bytes += new Blob([JSON.stringify(item)]).size;
        });
        resolve(bytes);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const indexedDBStorage = new IndexedDBStorage();
