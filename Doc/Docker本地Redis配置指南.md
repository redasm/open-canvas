# Docker本地Redis配置指南

## 概述

本指南详细说明如何使用Docker在本地创建和管理Redis服务，为Open Canvas项目提供高性能的缓存解决方案。

## 快速开始

### 1. 启动Redis服务

```bash
# 启动Redis服务（在项目根目录执行）
docker-compose -f database/docker-compose.yml up -d redis

# 查看服务状态
docker-compose -f database/docker-compose.yml ps

# 查看Redis日志
docker-compose -f database/docker-compose.yml logs -f redis
```

### 2. 连接Redis

```bash
# 使用Redis CLI连接
docker exec -it open-canvas-redis redis-cli

# 测试连接
redis-cli ping
# 应该返回: PONG
```

### 3. 启动Redis管理界面（可选）

```bash
# 启动Redis Commander
docker-compose -f database/docker-compose.yml --profile tools up -d redis-commander

# 访问管理界面
# http://localhost:8081
# 用户名: admin
# 密码: admin
```

## 详细配置

### 1. Docker Compose配置

`database/docker-compose.yml` 文件包含：

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: open-canvas-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    restart: unless-stopped
    networks:
      - open-canvas-network

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: open-canvas-redis-commander
    ports:
      - "8081:8081"
    environment:
      - REDIS_HOSTS=local:redis:6379
    depends_on:
      - redis
    networks:
      - open-canvas-network
    profiles:
      - tools
```

### 2. Redis配置文件

`database/redis.conf` 文件包含优化的Redis配置：

```conf
# 基本配置
port 6379
bind 0.0.0.0
protected-mode no

# 内存配置
maxmemory 256mb
maxmemory-policy allkeys-lru

# 持久化配置
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
```

### 3. 环境变量配置

创建 `.env` 文件（基于 `database/env.docker.example`）：

```env
# Redis配置
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Redis Commander配置
REDIS_COMMANDER_USER=admin
REDIS_COMMANDER_PASSWORD=admin
```

## 常用命令

### 1. 服务管理

```bash
# 启动Redis
docker-compose -f database/docker-compose.yml up -d redis

# 停止Redis
docker-compose -f database/docker-compose.yml down redis

# 重启Redis
docker-compose -f database/docker-compose.yml restart redis

# 查看状态
docker-compose -f database/docker-compose.yml ps

# 查看日志
docker-compose -f database/docker-compose.yml logs -f redis
```

### 2. 数据管理

```bash
# 进入Redis容器
docker exec -it open-canvas-redis sh

# 使用Redis CLI
docker exec -it open-canvas-redis redis-cli

# 清空所有数据
docker exec -it open-canvas-redis redis-cli FLUSHALL

# 查看数据库信息
docker exec -it open-canvas-redis redis-cli INFO

# 查看内存使用
docker exec -it open-canvas-redis redis-cli INFO memory
```

### 3. 备份和恢复

```bash
# 创建备份
docker exec open-canvas-redis redis-cli BGSAVE

# 查看备份文件
docker exec -it open-canvas-redis ls -la /data/

# 手动备份
docker cp open-canvas-redis:/data/dump.rdb ./backup/

# 恢复备份
docker cp ./backup/dump.rdb open-canvas-redis:/data/
docker-compose restart redis
```

## 应用集成

### 1. 更新缓存管理器

更新 `apps/web/src/lib/cache/enhanced-cache-manager.ts`：

```typescript
import { Redis } from 'ioredis';

class EnhancedCacheManager {
  private redisClient: Redis | null = null;
  
  private constructor() {
    // 初始化Redis客户端
    if (process.env.REDIS_URL) {
      this.redisClient = new Redis(process.env.REDIS_URL, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
      });
      
      this.redisClient.on('connect', () => {
        console.log('✅ Redis客户端连接成功');
      });
      
      this.redisClient.on('error', (err) => {
        console.error('❌ Redis客户端错误:', err);
      });
    }
  }
  
  async get<T>(key: string): Promise<T | null> {
    if (!this.redisClient) return null;
    
    try {
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis GET错误:', error);
      return null;
    }
  }
  
  async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
    if (!this.redisClient) return;
    
    try {
      await this.redisClient.setex(key, ttlSeconds, JSON.stringify(data));
    } catch (error) {
      console.error('Redis SET错误:', error);
    }
  }
  
  async delete(key: string): Promise<void> {
    if (!this.redisClient) return;
    
    try {
      await this.redisClient.del(key);
    } catch (error) {
      console.error('Redis DEL错误:', error);
    }
  }
}
```

### 2. 安装依赖

```bash
# 安装Redis客户端
npm install ioredis
npm install --save-dev @types/ioredis
```

### 3. 测试连接

创建测试脚本 `scripts/test-redis.js`：

```javascript
const Redis = require('ioredis');

async function testRedis() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  try {
    // 测试连接
    await redis.ping();
    console.log('✅ Redis连接成功');
    
    // 测试读写
    await redis.set('test:key', 'Hello Redis!');
    const value = await redis.get('test:key');
    console.log('✅ 读写测试成功:', value);
    
    // 测试过期
    await redis.setex('test:expire', 5, 'This will expire');
    console.log('✅ 过期测试设置成功');
    
    // 清理测试数据
    await redis.del('test:key', 'test:expire');
    console.log('✅ 清理测试数据完成');
    
  } catch (error) {
    console.error('❌ Redis测试失败:', error);
  } finally {
    await redis.disconnect();
  }
}

testRedis();
```

运行测试：

```bash
node scripts/test-redis.js
```

## 性能优化

### 1. 内存优化

```conf
# redis.conf
maxmemory 512mb
maxmemory-policy allkeys-lru
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
```

### 2. 持久化优化

```conf
# redis.conf
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
```

### 3. 网络优化

```conf
# redis.conf
tcp-keepalive 300
timeout 300
```

## 监控和调试

### 1. 使用Redis Commander

```bash
# 启动管理界面
docker-compose --profile tools up -d redis-commander

# 访问 http://localhost:8081
```

### 2. 监控命令

```bash
# 实时监控
docker exec -it open-canvas-redis redis-cli MONITOR

# 查看慢查询
docker exec -it open-canvas-redis redis-cli SLOWLOG GET 10

# 查看客户端连接
docker exec -it open-canvas-redis redis-cli CLIENT LIST
```

### 3. 性能分析

```bash
# 查看统计信息
docker exec -it open-canvas-redis redis-cli INFO stats

# 查看内存使用
docker exec -it open-canvas-redis redis-cli INFO memory

# 查看持久化信息
docker exec -it open-canvas-redis redis-cli INFO persistence
```

## 故障排除

### 1. 常见问题

#### 连接被拒绝
```bash
# 检查服务状态
docker-compose ps

# 检查端口占用
netstat -tulpn | grep 6379

# 重启服务
docker-compose restart redis
```

#### 内存不足
```bash
# 查看内存使用
docker exec -it open-canvas-redis redis-cli INFO memory

# 清理过期键
docker exec -it open-canvas-redis redis-cli --scan --pattern "*" | head -100 | xargs docker exec -i open-canvas-redis redis-cli DEL
```

#### 持久化问题
```bash
# 检查AOF文件
docker exec -it open-canvas-redis ls -la /data/

# 修复AOF文件
docker exec -it open-canvas-redis redis-cli --rdb /data/dump.rdb
```

### 2. 日志分析

```bash
# 查看Redis日志
docker-compose logs -f redis

# 查看系统日志
docker exec -it open-canvas-redis dmesg | tail -20
```

## 生产环境建议

### 1. 安全配置

```conf
# redis.conf
requirepass your_strong_password_here
bind 127.0.0.1
protected-mode yes
```

### 2. 高可用配置

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    
  redis-slave:
    image: redis:7-alpine
    command: redis-server --slaveof redis-master 6379 --requirepass ${REDIS_PASSWORD}
```

### 3. 资源限制

```yaml
# docker-compose.yml
services:
  redis:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

## 总结

使用Docker创建本地Redis服务具有以下优势：

1. **简单易用**：一键启动，无需复杂配置
2. **隔离性好**：容器化部署，不影响主机环境
3. **可移植性**：配置标准化，易于迁移
4. **管理方便**：提供Web管理界面
5. **性能优秀**：优化的配置，适合开发和生产环境

通过以上配置，您可以在本地快速搭建一个高性能的Redis缓存服务，为Open Canvas项目提供强大的缓存支持。
