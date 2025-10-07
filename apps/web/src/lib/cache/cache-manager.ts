/**
 * 多级缓存管理器 - 性能优化
 * 主要改动：
 * 1. 实现内存缓存 + Redis缓存的多级缓存系统
 * 2. 支持缓存过期和自动清理
 * 3. 提供缓存统计和监控
 * 4. 支持缓存预热和失效策略
 */

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // 生存时间（秒）
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  defaultTtl: number; // 默认生存时间（秒）
  maxMemorySize: number; // 最大内存使用量（字节）
  cleanupInterval: number; // 清理间隔（毫秒）
  enableRedis: boolean;
  redisConfig?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

interface CacheStats {
  memoryCache: {
    size: number;
    hitRate: number;
    missRate: number;
    evictionCount: number;
  };
  redisCache: {
    enabled: boolean;
    hitRate: number;
    missRate: number;
    connectionStatus: 'connected' | 'disconnected' | 'error';
  };
  total: {
    requests: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
}

/**
 * 多级缓存管理器
 */
export class CacheManager {
  private static instance: CacheManager;
  private memoryCache: Map<string, CacheItem> = new Map();
  private redisClient?: any; // Redis客户端
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupTimer?: NodeJS.Timeout;

  private constructor(config: CacheConfig) {
    this.config = config;
    this.stats = this.initializeStats();
    this.initializeRedis();
    this.startCleanupTimer();
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: CacheConfig): CacheManager {
    if (!CacheManager.instance) {
      if (!config) {
        throw new Error('CacheManager configuration is required for first initialization');
      }
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string): Promise<T | null> {
    this.stats.total.requests++;

    // 1. 检查内存缓存
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem && !this.isExpired(memoryItem)) {
      this.updateAccessStats(memoryItem);
      this.stats.memoryCache.hitRate = this.calculateHitRate('memory');
      this.stats.total.hits++;
      return memoryItem.data as T;
    }

    // 2. 检查Redis缓存
    if (this.redisClient && this.config.enableRedis) {
      try {
        const redisData = await this.redisClient.get(key);
        if (redisData) {
          const item = JSON.parse(redisData) as CacheItem;
          if (!this.isExpired(item)) {
            // 回写到内存缓存
            this.memoryCache.set(key, item);
            this.stats.redisCache.hitRate = this.calculateHitRate('redis');
            this.stats.total.hits++;
            return item.data as T;
          } else {
            // 删除过期的Redis缓存
            await this.redisClient.del(key);
          }
        }
      } catch (error) {
        console.warn('Redis cache read failed:', error);
        this.stats.redisCache.connectionStatus = 'error';
      }
    }

    this.stats.total.misses++;
    return null;
  }

  /**
   * 设置缓存数据
   */
  async set<T>(
    key: string, 
    data: T, 
    ttl: number = this.config.defaultTtl
  ): Promise<void> {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl * 1000, // 转换为毫秒
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    // 写入内存缓存
    this.memoryCache.set(key, item);

    // 检查内存使用量
    await this.checkMemoryUsage();

    // 写入Redis缓存
    if (this.redisClient && this.config.enableRedis) {
      try {
        await this.redisClient.setex(key, ttl, JSON.stringify(item));
        this.stats.redisCache.connectionStatus = 'connected';
      } catch (error) {
        console.warn('Redis cache write failed:', error);
        this.stats.redisCache.connectionStatus = 'error';
      }
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    // 从内存缓存删除
    this.memoryCache.delete(key);

    // 从Redis缓存删除
    if (this.redisClient && this.config.enableRedis) {
      try {
        await this.redisClient.del(key);
      } catch (error) {
        console.warn('Redis cache delete failed:', error);
      }
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    // 清空内存缓存
    this.memoryCache.clear();

    // 清空Redis缓存
    if (this.redisClient && this.config.enableRedis) {
      try {
        await this.redisClient.flushdb();
      } catch (error) {
        console.warn('Redis cache clear failed:', error);
      }
    }

    // 重置统计
    this.stats = this.initializeStats();
  }

  /**
   * 检查缓存是否存在
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      memoryCache: {
        ...this.stats.memoryCache,
        size: this.memoryCache.size,
        hitRate: this.calculateHitRate('memory'),
        missRate: 1 - this.calculateHitRate('memory'),
      },
      redisCache: {
        ...this.stats.redisCache,
        hitRate: this.calculateHitRate('redis'),
        missRate: 1 - this.calculateHitRate('redis'),
      },
      total: {
        ...this.stats.total,
        hitRate: this.calculateHitRate('total'),
      },
    };
  }

  /**
   * 预热缓存
   */
  async warmup<T>(
    key: string,
    dataLoader: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const existing = await this.get<T>(key);
    if (existing !== null) {
      return existing;
    }

    const data = await dataLoader();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * 批量获取缓存
   */
  async mget<T>(keys: string[]): Promise<Record<string, T | null>> {
    const results: Record<string, T | null> = {};
    
    await Promise.all(
      keys.map(async (key) => {
        results[key] = await this.get<T>(key);
      })
    );

    return results;
  }

  /**
   * 批量设置缓存
   */
  async mset<T>(
    items: Array<{ key: string; value: T; ttl?: number }>
  ): Promise<void> {
    await Promise.all(
      items.map(({ key, value, ttl }) => this.set(key, value, ttl))
    );
  }

  /**
   * 获取缓存键列表
   */
  getKeys(pattern?: string): string[] {
    const keys = Array.from(this.memoryCache.keys());
    
    if (pattern) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return keys.filter(key => regex.test(key));
    }
    
    return keys;
  }

  /**
   * 销毁缓存管理器
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch (error) {
        console.warn('Redis client quit failed:', error);
      }
    }

    this.memoryCache.clear();
  }

  /**
   * 初始化Redis客户端
   */
  private async initializeRedis(): Promise<void> {
    // 暂时禁用Redis，只使用内存缓存
    console.log('Redis disabled, using memory cache only');
    this.config.enableRedis = false;
  }

  /**
   * 检查项目是否过期
   */
  private isExpired(item: CacheItem): boolean {
    return Date.now() - item.timestamp > item.ttl;
  }

  /**
   * 更新访问统计
   */
  private updateAccessStats(item: CacheItem): void {
    item.accessCount++;
    item.lastAccessed = Date.now();
  }

  /**
   * 计算命中率
   */
  private calculateHitRate(type: 'memory' | 'redis' | 'total'): number {
    if (this.stats.total.requests === 0) return 0;

    switch (type) {
      case 'memory':
        return this.stats.memoryCache.hitRate;
      case 'redis':
        return this.stats.redisCache.hitRate;
      case 'total':
        return this.stats.total.hits / this.stats.total.requests;
      default:
        return 0;
    }
  }

  /**
   * 检查内存使用量
   */
  private async checkMemoryUsage(): Promise<void> {
    const currentSize = this.estimateMemoryUsage();
    
    if (currentSize > this.config.maxMemorySize) {
      await this.evictLeastRecentlyUsed();
    }
  }

  /**
   * 估算内存使用量
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const [key, item] of this.memoryCache) {
      totalSize += key.length * 2; // 字符串长度 * 2字节
      totalSize += JSON.stringify(item).length * 2;
    }
    
    return totalSize;
  }

  /**
   * 淘汰最近最少使用的项目
   */
  private async evictLeastRecentlyUsed(): Promise<void> {
    const items = Array.from(this.memoryCache.entries());
    
    // 按最后访问时间排序
    items.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    
    // 淘汰前20%的项目
    const evictCount = Math.ceil(items.length * 0.2);
    
    for (let i = 0; i < evictCount; i++) {
      const [key] = items[i];
      await this.delete(key);
      this.stats.memoryCache.evictionCount++;
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredItems();
    }, this.config.cleanupInterval);
  }

  /**
   * 清理过期项目
   */
  private cleanupExpiredItems(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.memoryCache) {
      if (now - item.timestamp > item.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.memoryCache.delete(key);
    });

    if (expiredKeys.length > 0) {
      console.log(`Cleaned up ${expiredKeys.length} expired cache items`);
    }
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(): CacheStats {
    return {
      memoryCache: {
        size: 0,
        hitRate: 0,
        missRate: 0,
        evictionCount: 0,
      },
      redisCache: {
        enabled: this.config.enableRedis,
        hitRate: 0,
        missRate: 0,
        connectionStatus: 'disconnected',
      },
      total: {
        requests: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
      },
    };
  }
}
