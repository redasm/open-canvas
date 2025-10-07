# 免费Redis替代方案

## 概述

本文档提供了多种免费的Redis替代方案，包括免费托管服务、Docker本地Redis、自建方案和内存缓存方案。

## 方案一：Docker本地Redis（推荐）

### 优势
- **完全免费**：无任何费用
- **本地部署**：数据完全控制
- **高性能**：无网络延迟
- **简单配置**：一键启动

### 配置步骤
```bash
# 1. 启动Redis服务
docker-compose -f database/docker-compose.yml up -d redis

# 2. 配置环境变量
REDIS_URL=redis://localhost:6379
```

详细配置请参考 `Doc/Docker本地Redis配置指南.md`

## 方案二：免费Redis托管服务

### 1. **Redis Cloud (Redis Labs)**

#### 优势
- **免费额度**：30MB存储空间，30个连接
- **全球分布**：多区域部署
- **高可用性**：99.9% SLA
- **简单配置**：一键部署

#### 配置步骤
```bash
# 1. 访问 https://redis.com/try-free/
# 2. 创建免费账户
# 3. 创建新的Redis数据库
# 4. 获取连接信息
```

```env
# .env.local
REDIS_URL=redis://default:password@redis-12345.c1.us-east-1-1.ec2.cloud.redislabs.com:12345
```

### 2. **Aiven Redis**

#### 优势
- **免费额度**：1GB存储空间，100个连接
- **开源友好**：支持开源项目
- **多云支持**：AWS、GCP、Azure
- **自动备份**：每日自动备份

#### 配置步骤
```bash
# 1. 访问 https://aiven.io/
# 2. 注册免费账户
# 3. 创建Redis服务
# 4. 获取连接信息
```

### 3. **Railway Redis**

#### 优势
- **免费额度**：$5/月免费额度
- **简单部署**：一键部署
- **自动扩展**：按需扩展
- **GitHub集成**：与GitHub无缝集成

## 方案三：自建Redis服务器

### 1. **Docker部署**

```bash
# 使用Docker Compose部署Redis
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped

volumes:
  redis_data:
```

### 2. **云服务器部署**

#### 推荐云服务商
- **Oracle Cloud**：永久免费2个VM实例
- **Google Cloud**：$300免费额度
- **AWS**：免费套餐
- **Azure**：$200免费额度

#### 部署脚本
```bash
#!/bin/bash
# Redis安装脚本
sudo apt update
sudo apt install redis-server -y
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

## 方案四：内存缓存方案（推荐用于开发）

### 1. **纯内存缓存**

如果不需要持久化，可以使用纯内存缓存：

```typescript
// apps/web/src/lib/cache/memory-cache-manager.ts
class MemoryCacheManager {
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  
  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }
  
  async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds
    });
  }
  
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
  }
}
```

### 2. **文件缓存**

使用文件系统作为缓存存储：

```typescript
// apps/web/src/lib/cache/file-cache-manager.ts
import fs from 'fs/promises';
import path from 'path';

class FileCacheManager {
  private cacheDir: string;
  
  constructor(cacheDir: string = './cache') {
    this.cacheDir = cacheDir;
  }
  
  async get<T>(key: string): Promise<T | null> {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const item = JSON.parse(data);
      
      if (Date.now() - item.timestamp > item.ttl * 1000) {
        await this.delete(key);
        return null;
      }
      
      return item.data as T;
    } catch {
      return null;
    }
  }
  
  async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
    const filePath = path.join(this.cacheDir, `${key}.json`);
    const item = {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds
    };
    
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(item));
  }
  
  async delete(key: string): Promise<void> {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      await fs.unlink(filePath);
    } catch {
      // 文件不存在，忽略错误
    }
  }
}
```

## 方案五：混合缓存策略

### 1. **多级缓存**

```typescript
// apps/web/src/lib/cache/hybrid-cache-manager.ts
class HybridCacheManager {
  private memoryCache: MemoryCacheManager;
  private fileCache: FileCacheManager;
  private redisCache: RedisCacheManager | null = null;
  
  constructor() {
    this.memoryCache = new MemoryCacheManager();
    this.fileCache = new FileCacheManager();
    
    // 如果配置了Redis，则启用
    if (process.env.REDIS_URL) {
      this.redisCache = new RedisCacheManager();
    }
  }
  
  async get<T>(key: string): Promise<T | null> {
    // 1. 尝试内存缓存
    let data = await this.memoryCache.get<T>(key);
    if (data) return data;
    
    // 2. 尝试文件缓存
    data = await this.fileCache.get<T>(key);
    if (data) {
      // 回写到内存缓存
      await this.memoryCache.set(key, data, 300);
      return data;
    }
    
    // 3. 尝试Redis缓存
    if (this.redisCache) {
      data = await this.redisCache.get<T>(key);
      if (data) {
        // 回写到内存和文件缓存
        await this.memoryCache.set(key, data, 300);
        await this.fileCache.set(key, data, 3600);
        return data;
      }
    }
    
    return null;
  }
  
  async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
    // 写入所有可用的缓存层
    await Promise.all([
      this.memoryCache.set(key, data, ttlSeconds),
      this.fileCache.set(key, data, ttlSeconds * 2), // 文件缓存时间更长
      this.redisCache?.set(key, data, ttlSeconds)
    ]);
  }
}
```

## 推荐方案

### 开发环境
- **Docker本地Redis**：推荐方案，完全免费且功能完整
- **内存缓存**：简单快速，无需外部依赖
- **文件缓存**：支持持久化，适合开发测试

### 生产环境
- **Docker本地Redis**：推荐方案，完全控制且免费
- **Redis Cloud免费版**：30MB存储，适合小型应用
- **Aiven Redis免费版**：1GB存储，适合中型应用
- **自建Redis**：完全控制，适合大型应用

### 混合方案
- **多级缓存**：内存 + 文件 + Redis，最佳性能

## 配置更新

更新 `apps/web/src/lib/cache/enhanced-cache-manager.ts`：

```typescript
// 支持多种缓存后端
export class EnhancedCacheManager {
  private memoryCache: Map<string, CacheItem> = new Map();
  private fileCache: FileCacheManager;
  private redisCache: RedisCacheManager | null = null;
  
  private constructor() {
    this.fileCache = new FileCacheManager('./cache');
    
    // 优先使用免费Redis服务
    if (process.env.REDIS_CLOUD_URL) {
      this.redisCache = new RedisCacheManager(process.env.REDIS_CLOUD_URL);
    } else if (process.env.AIVEN_REDIS_URL) {
      this.redisCache = new RedisCacheManager(process.env.AIVEN_REDIS_URL);
    }
  }
  
  // ... 其他方法
}
```

## 环境变量配置

```env
# .env.local
# Docker本地Redis（推荐）
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 或者选择其他Redis服务
# REDIS_CLOUD_URL=redis://default:password@redis-12345.c1.us-east-1-1.ec2.cloud.redislabs.com:12345
# AIVEN_REDIS_URL=redis://default:password@redis-12345.aivencloud.com:12345

# 缓存配置
CACHE_STRATEGY=hybrid  # memory, file, redis, hybrid
CACHE_TTL=300  # 默认缓存时间（秒）
```

## 总结

通过以上方案，您可以根据项目需求选择合适的免费Redis替代方案：

1. **推荐方案**：使用Docker本地Redis，完全免费且功能完整
2. **小型项目**：使用内存缓存或文件缓存
3. **中型项目**：使用Redis Cloud或Aiven免费版
4. **大型项目**：自建Redis服务器
5. **最佳性能**：使用多级缓存策略

所有方案都保持了与现有代码的兼容性，只需要更新环境变量配置即可。
