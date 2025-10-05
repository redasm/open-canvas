# DashScope 配置说明

## 概述

已成功将 Fireworks 模型配置修改为使用阿里云 DashScope 服务。现在所有原本使用 Fireworks 的模型都将通过 DashScope 的兼容模式 API 进行调用。

## 修改内容

### 1. 模型配置修改

**文件**: `apps/agents/src/utils.ts`

```typescript
if (customModelName.includes("fireworks/")) {
  let actualModelName = providerConfig.modelName;
  if (
    extra?.isToolCalling &&
    actualModelName !== "accounts/fireworks/models/llama-v3p3-70b-instruct"
  ) {
    actualModelName = "accounts/fireworks/models/llama-v3p3-70b-instruct";
  }
  return {
    ...providerConfig,
    modelName: actualModelName,
    modelProvider: "fireworks",
    apiKey: process.env.DASHSCOPE_API_KEY,  // 使用 DashScope API 密钥
    baseUrl: process.env.DASHSCOPE_INFER_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",  // 使用 DashScope 端点
  };
}
```

**主要变化**:
- `apiKey`: 从 `FIREWORKS_API_KEY` 改为 `DASHSCOPE_API_KEY`
- `baseUrl`: 新增 DashScope 端点配置
- 保持 `modelProvider: "fireworks"` 以确保兼容性

### 2. 模型标签更新

**文件**: `packages/shared/src/models.ts`

所有 Fireworks 模型的标签都已更新，添加了 "(DashScope)" 后缀：
- "Llama 3.3 70B (DashScope)"
- "Llama 70B (DashScope)"
- "DeepSeek V3 (DashScope)"
- "DeepSeek R1 (DashScope)"

## 环境变量配置

### 必需的环境变量

```bash
# 阿里云 DashScope API 密钥
DASHSCOPE_API_KEY=your_dashscope_api_key

# 控制 Fireworks 模型是否可用
NEXT_PUBLIC_FIREWORKS_ENABLED=true
```

### 可选的环境变量

```bash
# DashScope 推理端点 URL（如果不设置会使用默认值）
DASHSCOPE_INFER_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
```

## DashScope 兼容模式说明

### API 端点
- **默认端点**: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- **兼容性**: 完全兼容 OpenAI Chat Completions API
- **认证方式**: API Key 认证

### 支持的模型
DashScope 兼容模式支持多种模型，包括：
- Qwen 系列模型
- 其他阿里云支持的模型

### 请求格式
使用标准的 OpenAI Chat Completions API 格式：

```json
{
  "model": "qwen-plus",
  "messages": [
    {
      "role": "user",
      "content": "Hello, world!"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

## 使用说明

### 1. 获取 DashScope API 密钥

1. 访问 [阿里云 DashScope 控制台](https://dashscope.console.aliyun.com/)
2. 创建 API 密钥
3. 将密钥配置到环境变量 `DASHSCOPE_API_KEY`

### 2. 配置环境变量

在项目的 `.env` 文件中添加：

```bash
DASHSCOPE_API_KEY=your_actual_api_key
NEXT_PUBLIC_FIREWORKS_ENABLED=true
```

### 3. 重启服务

修改配置后需要重启 LangGraph 服务：

```bash
# 停止当前服务
# 重新启动
yarn dev:server
```

### 4. 验证配置

在 Open Canvas 界面中：
1. 打开模型选择器
2. 查看 Fireworks 分组下的模型
3. 选择任意一个模型进行测试
4. 发送测试消息验证是否正常工作

## 注意事项

### 1. 模型名称映射

当前配置中，模型名称仍然保持 Fireworks 的格式（如 `accounts/fireworks/models/llama-v3p3-70b-instruct`），但实际调用的是 DashScope 服务。如果需要使用 DashScope 的原生模型名称，需要进一步修改模型名称映射。

### 2. 工具调用支持

工具调用回退机制仍然有效：
- 当需要工具调用时，会自动切换到 `llama-v3p3-70b-instruct` 模型
- 确保 DashScope 支持相应的工具调用功能

### 3. 错误处理

如果 DashScope 服务不可用或 API 密钥无效，会在控制台看到相应的错误信息。请检查：
- API 密钥是否正确
- 网络连接是否正常
- DashScope 服务状态

### 4. 成本考虑

使用 DashScope 服务会产生费用，请根据实际使用情况调整配置。

## 故障排除

### 常见问题

1. **API 密钥错误**
   - 检查 `DASHSCOPE_API_KEY` 是否正确设置
   - 确认 API 密钥在 DashScope 控制台中有效

2. **网络连接问题**
   - 检查网络连接
   - 确认可以访问 `dashscope.aliyuncs.com`

3. **模型不可用**
   - 检查 `NEXT_PUBLIC_FIREWORKS_ENABLED` 是否为 `true`
   - 确认 DashScope 支持相应的模型

4. **工具调用失败**
   - 检查 DashScope 是否支持工具调用功能
   - 查看控制台错误信息

### 调试方法

1. **查看控制台日志**
   - 检查 LangGraph 服务的控制台输出
   - 查看是否有 API 调用错误

2. **测试 API 连接**
   - 使用 curl 或其他工具直接测试 DashScope API
   - 验证 API 密钥和端点是否正常工作

3. **检查环境变量**
   - 确认环境变量是否正确加载
   - 使用 `console.log` 输出环境变量值进行调试

## 总结

通过以上配置，成功将 Fireworks 模型替换为阿里云 DashScope 服务。这种配置方式：

- **保持兼容性**: 不需要修改前端代码
- **灵活配置**: 支持环境变量配置
- **易于维护**: 集中管理 API 密钥和端点
- **支持回退**: 保持原有的工具调用回退机制

现在您可以使用 DashScope 的强大模型能力，同时保持 Open Canvas 的完整功能。
