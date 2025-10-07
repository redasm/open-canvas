/**
 * 增强型缓存管理器 - 支持Docker本地Redis
 * 主要功能：
 * 1. 支持Docker本地Redis和内存缓存
 * 2. 自动选择最佳缓存后端
 * 3. 提供统一的缓存接口
 * 4. 智能降级和错误处理
 */

import { RedisCacheManager } from './redis-cache-manager';

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  total: {
    requests: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  backend: {
    type: 'redis' | 'memory';
    status: 'connected' | 'error' | 'disabled';
    hitRate: number;
  };
  memoryCache: {
    size: number;
    hitRate: number;
  };
}

interface EnhancedCacheConfig {
  defaultTtl: number;
  maxMemorySize: number;
  cleanupInterval: number;
  preferredBackend: 'redis' | 'memory' | 'auto';
  enableMemoryCache: boolean;
}

/**
 * 增强型缓存管理器
 */
export class EnhancedCacheManager {
  private static instance: EnhancedCacheManager;
  private redisCache: RedisCacheManager | null = null;
  private memoryCache: Map<string, CacheItem> = new Map();
  private config: EnhancedCacheConfig;
  private stats: CacheStats;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private backendType: 'redis' | 'memory' = 'memory';

  private constructor(config?: Partial<EnhancedCacheConfig>) {
    this.config = {
      defaultTtl: 300, // 5分钟
      maxMemorySize: 50 * 1024 * 1024, // 50MB
      cleanupInterval: 60000, // 1分钟
      preferredBackend: 'auto',
      enableMemoryCache: true,
      ...config,
    };

    this.stats = {
      total: { requests: 0, hits: 0, misses: 0, hitRate: 0 },
      backend: { type: 'memory', status: 'disabled', hitRate: 0 },
      memoryCache: { size: 0, hitRate: 0 },
    };

    this.initializeBackend();
    this.startCleanupTimer();
  }

  static getInstance(config?: Partial<EnhancedCacheConfig>): EnhancedCacheManager {
    if (!EnhancedCacheManager.instance) {
      EnhancedCacheManager.instance = new EnhancedCacheManager(config);
    }
    return EnhancedCacheManager.instance;
  }

  /**
   * 初始化缓存后端
   */
  private initializeBackend(): void {
    const backend = this.determineBackend();
    
    switch (backend) {
      case 'redis':
        // 暂时跳过Redis初始化，直接使用内存缓存
        console.log('⚠️ 跳过Redis初始化，直接使用内存缓存');
        this.initializeMemoryOnly();
        break;
      default:
        this.initializeMemoryOnly();
        break;
    }
  }

  /**
   * 确定最佳缓存后端
   */
  private determineBackend(): 'redis' | 'memory' {
    if (this.config.preferredBackend !== 'auto') {
      return this.config.preferredBackend;
    }

    // 暂时禁用Redis，使用内存缓存
    // TODO: 当Docker网络问题解决后，可以重新启用Redis
    console.log('⚠️ 暂时禁用Redis，使用内存缓存（Docker网络问题）');
    return 'memory';
    
    // 自动选择：优先Redis，然后是内存
    // if (process.env.REDIS_URL) {
    //   return 'redis';
    // }
    // 
    // return 'memory';
  }

  /**
   * 初始化Redis
   */
  private initializeRedis(): void {
    try {
      this.redisCache = RedisCacheManager.getInstance();
      
      this.backendType = 'redis';
      this.stats.backend.type = 'redis';
      this.stats.backend.status = 'connected';
      
      console.log('✅ 使用 Docker 本地 Redis 作为缓存后端');
    } catch (error) {
      console.error('❌ Redis 初始化失败:', error);
      this.fallbackToMemory();
    }
  }


  /**
   * 初始化纯内存缓存
   */
  private initializeMemoryOnly(): void {
    this.backendType = 'memory';
    this.stats.backend.type = 'memory';
    this.stats.backend.status = 'connected';
    
    console.log('📝 使用内存缓存');
  }

  /**
   * 回退到内存缓存
   */
  private fallbackToMemory(): void {
    this.backendType = 'memory';
    this.stats.backend.type = 'memory';
    this.stats.backend.status = 'connected';
    
    console.log('🔄 回退到内存缓存');
  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string): Promise<T | null> {
    this.stats.total.requests++;

    // 1. 检查内存缓存
    if (this.config.enableMemoryCache) {
      const memoryItem = this.memoryCache.get(key);
      if (memoryItem && !this.isExpired(memoryItem)) {
        this.updateAccessStats(memoryItem);
        this.stats.memoryCache.hitRate = this.calculateHitRate('memory');
        this.stats.total.hits++;
        return memoryItem.data as T;
      }
    }

    // 2. 检查后端缓存
    if (this.backendType === 'redis' && this.redisCache) {
      try {
        const result = await this.redisCache.get<T>(key);
        if (result !== null) {
          // 回写到内存缓存
          if (this.config.enableMemoryCache) {
            this.memoryCache.set(key, {
              data: result,
              timestamp: Date.now(),
              ttl: this.config.defaultTtl,
              accessCount: 1,
              lastAccessed: Date.now(),
            });
          }
          
          this.stats.backend.hitRate = this.calculateHitRate('backend');
          this.stats.total.hits++;
          return result;
        }
      } catch (error) {
        console.warn('后端缓存获取失败:', error);
        this.stats.backend.status = 'error';
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
    const item: CacheItem = {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    // 写入内存缓存
    if (this.config.enableMemoryCache) {
      this.memoryCache.set(key, item);
    }

    // 写入后端缓存
    if (this.backendType === 'redis' && this.redisCache) {
      try {
        await this.redisCache.set(key, data, ttl);
      } catch (error) {
        console.warn('后端缓存设置失败:', error);
        this.stats.backend.status = 'error';
      }
    }

    // 检查内存缓存大小
    this.checkMemoryLimit();
  }

  /**
   * 删除缓存数据
   */
  async delete(key: string): Promise<void> {
    // 从内存缓存删除
    if (this.config.enableMemoryCache) {
      this.memoryCache.delete(key);
    }

    // 从后端缓存删除
    if (this.backendType === 'redis' && this.redisCache) {
      try {
        await this.redisCache.delete(key);
      } catch (error) {
        console.warn('后端缓存删除失败:', error);
        this.stats.backend.status = 'error';
      }
    }
  }

  /**
   * 检查缓存是否存在
   */
  async exists(key: string): Promise<boolean> {
    // 检查内存缓存
    if (this.config.enableMemoryCache) {
      const memoryItem = this.memoryCache.get(key);
      if (memoryItem && !this.isExpired(memoryItem)) {
        return true;
      }
    }

    // 检查后端缓存
    if (this.backendType === 'redis' && this.redisCache) {
      try {
        return await this.redisCache.exists(key);
      } catch (error) {
        console.warn('后端缓存检查失败:', error);
        this.stats.backend.status = 'error';
      }
    }

    return false;
  }

  /**
   * 批量获取缓存数据
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    
    for (const key of keys) {
      const result = await this.get<T>(key);
      results.push(result);
    }
    
    return results;
  }

  /**
   * 批量设置缓存数据
   */
  async mset<T>(items: Array<{ key: string; data: T; ttl?: number }>): Promise<void> {
    const promises = items.map(item => this.set(item.key, item.data, item.ttl));
    await Promise.all(promises);
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    // 清空内存缓存
    if (this.config.enableMemoryCache) {
      this.memoryCache.clear();
    }

    // 清空后端缓存
    if (this.backendType === 'redis' && this.redisCache) {
      try {
        await this.redisCache.clear();
      } catch (error) {
        console.warn('后端缓存清空失败:', error);
        this.stats.backend.status = 'error';
      }
    }

    // 重置统计
    this.stats = {
      total: { requests: 0, hits: 0, misses: 0, hitRate: 0 },
      backend: { type: this.backendType, status: 'connected', hitRate: 0 },
      memoryCache: { size: 0, hitRate: 0 },
    };
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    this.stats.memoryCache.size = this.memoryCache.size;
    this.stats.total.hitRate = this.stats.total.requests > 0 
      ? this.stats.total.hits / this.stats.total.requests 
      : 0;
    return { ...this.stats };
  }

  /**
   * 获取后端类型
   */
  getBackendType(): string {
    return this.backendType;
  }

  /**
   * 检查缓存项是否过期
   */
  private isExpired(item: CacheItem): boolean {
    return Date.now() - item.timestamp > item.ttl * 1000;
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
  private calculateHitRate(type: 'memory' | 'backend'): number {
    if (this.stats.total.requests === 0) return 0;
    
    if (type === 'memory') {
      return this.stats.memoryCache.hitRate;
    } else {
      return this.stats.backend.hitRate;
    }
  }

  /**
   * 检查内存限制
   */
  private checkMemoryLimit(): void {
    if (this.memoryCache.size > 1000) { // 简单的大小限制
      // 删除最久未访问的项目
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      const toDelete = entries.slice(0, Math.floor(entries.length * 0.1)); // 删除10%
      toDelete.forEach(([key]) => this.memoryCache.delete(key));
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

    for (const [key, item] of this.memoryCache.entries()) {
      if (now - item.timestamp > item.ttl * 1000) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.memoryCache.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`🧹 清理了 ${expiredKeys.length} 个过期缓存项`);
    }
  }

  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.memoryCache.clear();
    
    if (this.redisCache) {
      this.redisCache.destroy();
      this.redisCache = null;
    }
  }
}

/**
 * 创建增强型缓存管理器实例
 */
export function createEnhancedCacheManager(config?: Partial<EnhancedCacheConfig>): EnhancedCacheManager {
  return EnhancedCacheManager.getInstance(config);
}

/**
 * 默认增强型缓存管理器实例
 */
export const enhancedCacheManager = createEnhancedCacheManager({
  defaultTtl: 300, // 5分钟
  maxMemorySize: 50 * 1024 * 1024, // 50MB
  cleanupInterval: 60000, // 1分钟
  preferredBackend: 'auto', // 自动选择最佳后端
  enableMemoryCache: true,
});
