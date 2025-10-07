# Supabase Redis 集成方案

## 概述

基于研究结果，Supabase 本身不直接提供 Redis 服务，但可以通过多种方式集成 Redis 来提升应用性能。以下是几种可行的集成方案。

## 方案一：使用 Upstash Redis（推荐）

### 优势
- **无服务器架构**：完全托管的 Redis 服务
- **全球分布**：多区域部署，低延迟
- **自动扩展**：根据使用量自动调整
- **与 Supabase 完美集成**：专为现代应用设计
- **免费额度**：每月 10,000 请求免费

### 配置步骤

#### 1. 创建 Upstash Redis 实例
```bash
# 访问 https://upstash.com/
# 创建新的 Redis 数据库
# 获取连接信息
```

#### 2. 安装依赖
```bash
npm install @upstash/redis
```

#### 3. 配置环境变量
```env
# .env.local
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

#### 4. 更新缓存管理器
```typescript
// apps/web/src/lib/cache/upstash-cache-manager.ts
import { Redis } from '@upstash/redis';

export class UpstashCacheManager {
  private static instance: UpstashCacheManager;
  private redis: Redis;

  private constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  static getInstance(): UpstashCacheManager {
    if (!UpstashCacheManager.instance) {
      UpstashCacheManager.instance = new UpstashCacheManager();
    }
    return UpstashCacheManager.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      return data as T;
    } catch (error) {
      console.warn('Redis get failed:', error);
      return null;
    }
  }

  async set<T>(key: string, data: T, ttl: number = 300): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.warn('Redis set failed:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.warn('Redis delete failed:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.warn('Redis exists failed:', error);
      return false;
    }
  }
}
```

## 方案二：使用 Supabase Edge Functions + Redis

### 优势
- **与 Supabase 深度集成**：使用 Supabase 的 Edge Functions
- **边缘计算**：在全球边缘节点运行
- **统一管理**：所有服务在一个平台

### 配置步骤

#### 1. 创建 Edge Function
```typescript
// supabase/functions/redis-cache/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { method, key, data, ttl } = await req.json()
  
  // 这里可以集成任何 Redis 服务
  // 例如 Upstash、Redis Cloud 等
  
  switch (method) {
    case 'GET':
      // 获取缓存数据
      break
    case 'SET':
      // 设置缓存数据
      break
    case 'DELETE':
      // 删除缓存数据
      break
  }
  
  return new Response(JSON.stringify({ success: true }))
})
```

#### 2. 部署 Edge Function
```bash
supabase functions deploy redis-cache
```

## 方案三：使用 PostgreSQL 的 Redis 扩展

### 优势
- **原生集成**：直接在 Supabase PostgreSQL 中使用
- **数据一致性**：与数据库事务一致
- **简化架构**：减少外部依赖

### 配置步骤

#### 1. 启用 Redis 扩展
```sql
-- 在 Supabase SQL 编辑器中执行
CREATE EXTENSION IF NOT EXISTS redis_fdw;
```

#### 2. 创建外部服务器
```sql
CREATE SERVER redis_server
FOREIGN DATA WRAPPER redis_fdw
OPTIONS (
  address 'your_redis_host',
  port 'your_redis_port'
);
```

#### 3. 创建外部表
```sql
CREATE FOREIGN TABLE redis_cache (
  key text,
  value text,
  ttl integer
) SERVER redis_server
OPTIONS (
  database '0'
);
```

## 推荐方案：Upstash Redis

基于项目需求，**推荐使用 Upstash Redis**，原因如下：

### 1. 性能优势
- **低延迟**：全球边缘节点，延迟 < 10ms
- **高可用性**：99.9% 可用性保证
- **自动扩展**：无需手动管理容量

### 2. 开发体验
- **简单集成**：几行代码即可集成
- **类型安全**：完整的 TypeScript 支持
- **丰富功能**：支持所有 Redis 命令

### 3. 成本效益
- **免费额度**：每月 10,000 请求
- **按需付费**：只为实际使用付费
- **无维护成本**：完全托管服务

## 实施计划

### 阶段一：基础集成（1-2天）
1. 创建 Upstash Redis 实例
2. 更新环境变量配置
3. 创建 UpstashCacheManager
4. 更新现有缓存逻辑

### 阶段二：性能优化（1天）
1. 实现缓存预热
2. 添加缓存统计
3. 优化缓存策略
4. 添加监控告警

### 阶段三：测试验证（1天）
1. 性能测试
2. 压力测试
3. 故障恢复测试
4. 文档更新

## 预期效果

### 性能提升
- **响应时间**：减少 50-80%
- **数据库负载**：减少 70-90%
- **用户体验**：显著提升

### 成本优化
- **数据库成本**：减少 60-80%
- **服务器资源**：减少 40-60%
- **维护成本**：减少 50%

## 注意事项

### 1. 数据一致性
- 实现缓存失效策略
- 处理并发更新问题
- 设置合理的 TTL

### 2. 安全性
- 使用 HTTPS 连接
- 设置访问控制
- 定期轮换密钥

### 3. 监控
- 监控缓存命中率
- 监控响应时间
- 设置告警机制

## 总结

通过集成 Upstash Redis，可以显著提升应用性能，减少数据库负载，改善用户体验。建议优先实施此方案，并根据实际使用情况进一步优化。
