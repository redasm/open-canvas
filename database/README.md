# Database 配置目录

本目录包含Open Canvas项目的数据库相关配置文件，主要用于本地开发和测试环境。

## 文件说明

- `docker-compose.yml` - Docker Compose配置文件，用于启动Redis服务
- `redis.conf` - Redis服务器配置文件
- `env.docker.example` - Docker环境变量配置示例

## 快速开始

### 1. 启动Redis服务

```bash
# 在项目根目录执行
docker-compose -f database/docker-compose.yml up -d redis
```

### 2. 查看服务状态

```bash
docker-compose -f database/docker-compose.yml ps
```

### 3. 连接Redis

```bash
# 使用Redis CLI
docker exec -it open-canvas-redis redis-cli

# 测试连接
redis-cli ping
```

### 4. 启动Redis管理界面（可选）

```bash
# 启动Redis Commander
docker-compose -f database/docker-compose.yml --profile tools up -d redis-commander

# 访问管理界面
# http://localhost:8081
# 用户名: admin
# 密码: admin
```

## 环境变量配置

1. 复制环境变量示例文件：
```bash
cp database/env.docker.example .env
```

2. 编辑 `.env` 文件，配置Redis连接信息：
```env
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
```

## 常用命令

### 服务管理
```bash
# 启动服务
docker-compose -f database/docker-compose.yml up -d

# 停止服务
docker-compose -f database/docker-compose.yml down

# 重启服务
docker-compose -f database/docker-compose.yml restart

# 查看日志
docker-compose -f database/docker-compose.yml logs -f redis
```

### 数据管理
```bash
# 清空所有数据
docker exec -it open-canvas-redis redis-cli FLUSHALL

# 查看数据库信息
docker exec -it open-canvas-redis redis-cli INFO

# 查看内存使用
docker exec -it open-canvas-redis redis-cli INFO memory
```

## 配置说明

### Redis配置 (redis.conf)
- 端口: 6379
- 最大内存: 256MB
- 持久化: AOF + RDB
- 内存策略: allkeys-lru

### Docker配置 (docker-compose.yml)
- Redis服务: 端口6379
- Redis Commander: 端口8081
- 数据持久化: 使用Docker卷
- 网络: 自定义网络

## 故障排除

### 端口冲突
如果6379端口被占用，可以修改docker-compose.yml中的端口映射：
```yaml
ports:
  - "6380:6379"  # 使用6380端口
```

### 权限问题
确保Docker有足够的权限访问配置文件：
```bash
chmod 644 database/redis.conf
```

### 数据持久化
Redis数据存储在Docker卷中，即使容器重启数据也不会丢失。如需完全清理：
```bash
docker-compose -f database/docker-compose.yml down -v
```

## 生产环境

在生产环境中，建议：
1. 设置Redis密码
2. 限制网络访问
3. 配置适当的资源限制
4. 启用监控和日志

详细配置请参考 `Doc/Docker本地Redis配置指南.md`。
