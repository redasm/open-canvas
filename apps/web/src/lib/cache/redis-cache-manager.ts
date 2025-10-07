/**
 * Redis缓存管理器 - 支持Docker本地Redis
 * 主要功能：
 * 1. 连接Docker本地Redis服务
 * 2. 提供统一的缓存接口
 * 3. 错误处理和重连机制
 * 4. 性能监控和统计
 */

// 动态导入Redis，避免在客户端构建时出现问题
let Redis: any = null;

if (typeof window === 'undefined') {
  // 只在服务端导入Redis
  try {
    Redis = require('ioredis').default;
  } catch (error) {
    console.warn('ioredis not available:', error);
  }
}

interface RedisCacheConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number | null;
  lazyConnect?: boolean;
  keepAlive?: number;
  connectTimeout?: number;
  commandTimeout?: number;
}

interface CacheStats {
  requests: number;
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
  avgResponseTime: number;
}

/**
 * Redis缓存管理器
 */
export class RedisCacheManager {
  private static instance: RedisCacheManager;
  private redis: Redis | null = null;
  private isConnected: boolean = false;
  private config: RedisCacheConfig;
  private stats: CacheStats;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private constructor(config?: RedisCacheConfig) {
    this.config = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      ...config,
    };

    this.stats = {
      requests: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      hitRate: 0,
      avgResponseTime: 0,
    };

    this.initializeRedis();
  }

  static getInstance(config?: RedisCacheConfig): RedisCacheManager {
    if (!RedisCacheManager.instance) {
      RedisCacheManager.instance = new RedisCacheManager(config);
    }
    return RedisCacheManager.instance;
  }

  /**
   * 初始化Redis连接
   */
  private initializeRedis(): void {
    // 暂时禁用Redis连接，避免网络问题
    console.warn('⚠️ Redis连接已禁用（Docker网络问题），使用内存缓存');
    return;
    
    // 检查是否在服务端环境
    if (typeof window !== 'undefined') {
      console.warn('⚠️ Redis只能在服务端使用，回退到内存缓存');
      return;
    }

    if (!Redis) {
      console.warn('⚠️ Redis客户端不可用，回退到内存缓存');
      return;
    }

    try {
      this.redis = new Redis(this.config.url || {
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        retryDelayOnFailover: this.config.retryDelayOnFailover,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        lazyConnect: this.config.lazyConnect,
        keepAlive: this.config.keepAlive,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
      });

      this.setupEventHandlers();
      
      console.log('✅ Redis客户端初始化成功');
    } catch (error) {
      console.error('❌ Redis客户端初始化失败:', error);
      this.stats.errors++;
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.redis) return;

    this.redis.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ Redis连接成功');
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      console.log('✅ Redis准备就绪');
    });

    this.redis.on('error', (error) => {
      this.isConnected = false;
      this.stats.errors++;
      console.error('❌ Redis连接错误:', error);
      this.scheduleReconnect();
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      console.warn('⚠️ Redis连接关闭');
    });

    this.redis.on('reconnecting', () => {
      console.log('🔄 Redis重新连接中...');
    });
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Redis重连次数超过限制，停止重连');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // 指数退避
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`🔄 尝试重连Redis (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      if (this.redis) {
        this.redis.connect();
      }
    }, delay);
  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis || !this.isConnected) {
      console.warn('⚠️ Redis未连接，无法获取缓存');
      return null;
    }

    const startTime = Date.now();
    this.stats.requests++;

    try {
      const data = await this.redis.get(key);
      const responseTime = Date.now() - startTime;
      this.updateAvgResponseTime(responseTime);

      if (data === null) {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();
      
      return JSON.parse(data) as T;
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Redis GET错误:', error);
      return null;
    }
  }

  /**
   * 设置缓存数据
   */
  async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
    if (!this.redis || !this.isConnected) {
      console.warn('⚠️ Redis未连接，无法设置缓存');
      return;
    }

    const startTime = Date.now();

    try {
      const serializedData = JSON.stringify(data);
      await this.redis.setex(key, ttlSeconds, serializedData);
      
      const responseTime = Date.now() - startTime;
      this.updateAvgResponseTime(responseTime);
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Redis SET错误:', error);
    }
  }

  /**
   * 删除缓存数据
   */
  async delete(key: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      console.warn('⚠️ Redis未连接，无法删除缓存');
      return;
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Redis DEL错误:', error);
    }
  }

  /**
   * 检查缓存是否存在
   */
  async exists(key: string): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Redis EXISTS错误:', error);
      return false;
    }
  }

  /**
   * 批量获取缓存数据
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.redis || !this.isConnected) {
      return keys.map(() => null);
    }

    try {
      const results = await this.redis.mget(...keys);
      return results.map(result => result ? JSON.parse(result) : null);
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Redis MGET错误:', error);
      return keys.map(() => null);
    }
  }

  /**
   * 批量设置缓存数据
   */
  async mset<T>(items: Array<{ key: string; data: T; ttl?: number }>): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }

    try {
      const pipeline = this.redis.pipeline();
      
      items.forEach(item => {
        const serializedData = JSON.stringify(item.data);
        if (item.ttl) {
          pipeline.setex(item.key, item.ttl, serializedData);
        } else {
          pipeline.set(item.key, serializedData);
        }
      });
      
      await pipeline.exec();
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Redis MSET错误:', error);
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    if (!this.redis || !this.isConnected) {
      console.warn('⚠️ Redis未连接，无法清空缓存');
      return;
    }

    try {
      await this.redis.flushdb();
      console.log('✅ Redis缓存已清空');
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Redis FLUSHDB错误:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 检查连接状态
   */
  isConnectedAndReady(): boolean {
    return this.isConnected && this.redis?.status === 'ready';
  }

  /**
   * 获取Redis信息
   */
  async getInfo(): Promise<Record<string, string> | null> {
    if (!this.redis || !this.isConnected) {
      return null;
    }

    try {
      const info = await this.redis.info();
      const infoObj: Record<string, string> = {};
      
      info.split('\r\n').forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          infoObj[key] = value;
        }
      });
      
      return infoObj;
    } catch (error) {
      console.error('❌ Redis INFO错误:', error);
      return null;
    }
  }

  /**
   * 更新平均响应时间
   */
  private updateAvgResponseTime(responseTime: number): void {
    const totalRequests = this.stats.requests;
    this.stats.avgResponseTime = 
      (this.stats.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    this.stats.hitRate = this.stats.requests > 0 
      ? this.stats.hits / this.stats.requests 
      : 0;
  }

  /**
   * 销毁Redis连接
   */
  destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.redis) {
      this.redis.disconnect();
      this.redis = null;
    }

    this.isConnected = false;
    console.log('✅ Redis连接已销毁');
  }
}

/**
 * 创建Redis缓存管理器实例
 */
export function createRedisCacheManager(config?: RedisCacheConfig): RedisCacheManager {
  return RedisCacheManager.getInstance(config);
}

/**
 * 默认Redis缓存管理器实例
 */
export const redisCacheManager = createRedisCacheManager();
