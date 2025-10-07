# Docker网络问题解决方案

## 问题描述

在启动Docker Redis服务时遇到网络连接问题：
```
Error response from daemon: Get "https://registry-1.docker.io/v2/": context deadline exceeded
```

## 解决方案

### 方案1：配置Docker镜像源（推荐）

#### 1.1 修改Docker Desktop配置

1. 打开Docker Desktop
2. 进入 Settings → Docker Engine
3. 添加以下配置：

```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ],
  "dns": ["8.8.8.8", "114.114.114.114"]
}
```

4. 点击 "Apply & Restart"

#### 1.2 使用国内镜像源

修改 `database/docker-compose.yml`：

```yaml
services:
  redis:
    image: registry.cn-hangzhou.aliyuncs.com/library/redis:7-alpine
    # 或者使用其他国内源
    # image: docker.mirrors.ustc.edu.cn/library/redis:7-alpine
```

### 方案2：使用代理

如果您的网络环境需要代理：

1. 配置Docker Desktop代理：
   - Settings → Resources → Proxies
   - 启用代理并配置代理服务器

2. 或者在命令行设置代理：
```bash
# Windows
set HTTP_PROXY=http://proxy-server:port
set HTTPS_PROXY=http://proxy-server:port

# 然后启动Docker服务
docker-compose -f database/docker-compose.yml up -d redis
```

### 方案3：手动下载镜像

```bash
# 使用代理或VPN下载镜像
docker pull redis:7-alpine

# 然后启动服务
docker-compose -f database/docker-compose.yml up -d redis
```

### 方案4：使用本地Redis（临时方案）

如果Docker问题无法解决，可以：

1. **安装本地Redis**：
   - Windows: 下载Redis for Windows
   - 或者使用WSL安装Redis

2. **修改环境变量**：
```env
# .env
REDIS_URL=redis://localhost:6379
```

3. **启动本地Redis**：
```bash
# Windows (如果安装了Redis)
redis-server

# WSL
sudo service redis-server start
```

### 方案5：暂时使用内存缓存

如果以上方案都不行，系统已经配置为自动回退到内存缓存：

```typescript
// 在 enhanced-cache-manager.ts 中
private determineBackend(): 'redis' | 'memory' {
  // 暂时禁用Redis，使用内存缓存
  console.log('⚠️ 暂时禁用Redis，使用内存缓存（Docker网络问题）');
  return 'memory';
}
```

## 验证解决方案

### 检查Docker连接
```bash
docker info
docker pull hello-world
```

### 检查Redis服务
```bash
# 启动Redis
docker-compose -f database/docker-compose.yml up -d redis

# 检查状态
docker-compose -f database/docker-compose.yml ps

# 测试连接
docker exec -it open-canvas-redis redis-cli ping
```

### 检查应用启动
```bash
# 启动agents服务
cd apps/agents
yarn start
```

## 推荐步骤

1. **首先尝试方案1**：配置Docker镜像源
2. **如果不行，尝试方案2**：配置代理
3. **最后选择方案5**：使用内存缓存（系统已配置）

## 注意事项

- 内存缓存数据不会持久化，重启应用会丢失
- 对于开发环境，内存缓存通常足够使用
- 生产环境建议解决Docker网络问题后使用Redis

## 恢复Redis

当Docker网络问题解决后，可以恢复Redis配置：

1. 修改 `enhanced-cache-manager.ts`：
```typescript
private determineBackend(): 'redis' | 'memory' {
  if (this.config.preferredBackend !== 'auto') {
    return this.config.preferredBackend;
  }

  // 恢复自动选择
  if (process.env.REDIS_URL) {
    return 'redis';
  }
  
  return 'memory';
}
```

2. 启动Redis服务：
```bash
docker-compose -f database/docker-compose.yml up -d redis
```
