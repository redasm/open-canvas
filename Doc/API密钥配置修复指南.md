# 阿里云百炼 API 密钥配置修复指南

## 问题诊断

从错误日志可以看到：
```
Error: 401 Incorrect API key provided: sk-5f7a6***********************1912
You can find your API key at https://platform.openai.com/account/api-keys
```

**问题原因**：
1. ❌ 环境变量 `FIREWORKS_API_KEY` 没有正确设置
2. ❌ LangChain 的 OpenAI 客户端仍然在尝试验证 API 密钥
3. ❌ 可能仍然在使用默认的 OpenAI 端点进行验证

## 解决方案

### 步骤 1：创建环境变量文件

在项目根目录创建 `.env` 文件：

```bash
# 阿里云百炼 API 密钥
FIREWORKS_API_KEY=sk-your-actual-dashscope-api-key

# 启用 Fireworks 模型
NEXT_PUBLIC_FIREWORKS_ENABLED=true

# Supabase 配置（如果需要）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# 开发配置
BYPASS_AUTH=true
LANGSMITH_TRACING=false
```

### 步骤 2：获取正确的 API 密钥

1. 访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/)
2. 登录您的阿里云账号
3. 创建或获取 API 密钥
4. 将密钥复制到 `.env` 文件中的 `FIREWORKS_API_KEY`

### 步骤 3：验证环境变量

在 PowerShell 中验证环境变量是否正确加载：

```powershell
# 检查环境变量
echo $env:FIREWORKS_API_KEY

# 如果为空，需要重启终端或重新加载环境变量
```

### 步骤 4：重启服务

```bash
# 停止所有 Node.js 进程
taskkill /F /IM node.exe

# 重新启动 LangGraph 服务
cd apps/agents
yarn dev

# 重新启动前端服务（新终端）
cd apps/web
yarn dev
```

## 替代解决方案

如果上述方法仍然不工作，可以尝试以下替代方案：

### 方案 1：使用 DASHSCOPE_API_KEY 环境变量

修改 `apps/agents/src/utils.ts`：

```typescript
return {
  ...providerConfig,
  modelName: actualModelName,
  modelProvider: "openai",
  apiKey: process.env.DASHSCOPE_API_KEY, // 使用 DASHSCOPE_API_KEY
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
};
```

然后在 `.env` 文件中设置：
```bash
DASHSCOPE_API_KEY=sk-your-actual-dashscope-api-key
```

### 方案 2：使用 Fireworks 提供商

修改 `apps/agents/src/utils.ts`：

```typescript
return {
  ...providerConfig,
  modelName: actualModelName,
  modelProvider: "fireworks", // 使用 Fireworks 提供商
  apiKey: process.env.FIREWORKS_API_KEY,
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", // 完整端点
};
```

### 方案 3：直接测试 API

使用 PowerShell 直接测试阿里云百炼 API：

```powershell
$headers = @{
    "Authorization" = "Bearer sk-your-dashscope-api-key"
    "Content-Type" = "application/json"
}

$body = @{
    model = "deepseek-r1"
    messages = @(
        @{
            role = "user"
            content = "你是谁"
        }
    )
    stream = $false
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" -Method POST -Headers $headers -Body $body
```

## 调试步骤

### 1. 检查环境变量加载

在 `apps/agents/src/utils.ts` 中添加调试日志：

```typescript
if (customModelName.includes("fireworks/")) {
  console.log("🔍 FIREWORKS_API_KEY:", process.env.FIREWORKS_API_KEY ? "SET" : "NOT SET");
  console.log("🔍 FIREWORKS_API_URL:", process.env.FIREWORKS_API_URL);
  
  // ... 其他代码
}
```

### 2. 检查 API 调用

在 `getModelFromConfig` 函数中添加调试日志：

```typescript
console.log("🚀 initChatModel 调用参数:", {
  modelName,
  modelProvider,
  apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : "NOT SET",
  baseUrl: baseUrl || "NOT SET",
});
```

### 3. 验证 API 密钥格式

确保 API 密钥格式正确：
- 应该以 `sk-` 开头
- 长度通常为 32-64 个字符
- 没有多余的空格或换行符

## 常见问题

### Q: 为什么仍然出现 OpenAI 的错误信息？

A: LangChain 的 OpenAI 客户端可能仍然在尝试验证 API 密钥。这通常是因为：
1. 环境变量没有正确加载
2. 服务没有重启
3. 缓存问题

### Q: 如何确认 API 密钥是否正确？

A: 使用 curl 或 PowerShell 直接测试 API：

```bash
curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions \
-H "Authorization: Bearer sk-your-api-key" \
-H "Content-Type: application/json" \
-d '{"model": "deepseek-r1", "messages": [{"role": "user", "content": "你是谁"}], "stream": false}'
```

### Q: 环境变量设置后仍然不工作？

A: 尝试以下步骤：
1. 重启终端
2. 重启 IDE
3. 清除 Node.js 缓存：`npm cache clean --force`
4. 重新安装依赖：`yarn install`

## 总结

主要问题是环境变量 `FIREWORKS_API_KEY` 没有正确设置。按照上述步骤配置环境变量并重启服务，应该能够解决 401 认证错误。
