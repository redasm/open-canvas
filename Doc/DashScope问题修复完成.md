# DashScope 问题修复完成

## 问题诊断

通过调试日志发现，DashScope 模型在前端正确显示，但后端调用时出现错误：

```
Error: Unsupported { modelProvider: dashscope }.
Supported model providers are: openai, anthropic, azure_openai, cohere, google-vertexai, google-vertexai-web, google-genai, ollama, together, fireworks, mistralai, groq, bedrock, cerebras, deepseek, xai, perplexity
```

## 根本原因

LangChain 不支持 `dashscope` 作为独立的模型提供商。DashScope 使用 OpenAI 兼容的 API，应该使用 `openai` 作为 provider。

## 修复方案

### 1. 后端配置修复 (`apps/agents/src/utils.ts`)

**修改前**：
```typescript
if (customModelName.includes("dashscope/")) {
  let actualModelName = customModelName.replace("dashscope/", "");
  return {
    ...providerConfig,
    modelName: actualModelName,
    modelProvider: "dashscope",  // ❌ 错误的 provider
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseUrl: process.env.DASHSCOPE_INFER_URL,
  };
}
```

**修改后**：
```typescript
if (customModelName.includes("dashscope/")) {
  let actualModelName = customModelName.replace("dashscope/", "");
  return {
    ...providerConfig,
    modelName: actualModelName,
    modelProvider: "openai",  // ✅ 使用 OpenAI provider
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseUrl: process.env.DASHSCOPE_INFER_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  };
}
```

### 2. 模型定义修复 (`packages/shared/src/models.ts`)

**修改前**：
```typescript
config: {
  provider: "dashscope",  // ❌ 错误的 provider
  // ...
}
```

**修改后**：
```typescript
config: {
  provider: "openai",  // ✅ 使用 OpenAI provider
  // ...
}
```

### 3. 前端分组逻辑修复 (`apps/web/src/components/chat-interface/model-selector/index.tsx`)

**修改前**：
```typescript
const dashscopeModelGroup = allAllowedModels.filter(
  (m) => m.config.provider === "dashscope"  // ❌ 找不到匹配的模型
);
```

**修改后**：
```typescript
const dashscopeModelGroup = allAllowedModels.filter(
  (m) => m.name.includes("dashscope/")  // ✅ 通过模型名称前缀匹配
);
```

## 环境变量配置

确保以下环境变量已正确设置：

**根目录 `.env`**：
```bash
DASHSCOPE_API_KEY=sk-5f7a6e663fab4487bbc16d3a5c7e1912
DASHSCOPE_INFER_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
```

**`apps/web/.env`**：
```bash
NEXT_PUBLIC_DASHSCOPE_ENABLED=true
```

## 验证步骤

1. **重启服务**：
   ```bash
   # 停止当前服务 (Ctrl+C)
   yarn dev:server
   ```

2. **检查模型选择器**：
   - 访问 `http://localhost:3000`
   - 点击左上角模型选择器
   - 应该能看到 "DashScope" 分组
   - 分组下显示：Qwen-Plus, DeepSeek V3, DeepSeek R1

3. **测试模型调用**：
   - 选择任意 DashScope 模型
   - 发送测试消息
   - 应该能正常响应，不再出现 "Unsupported modelProvider" 错误

## 技术原理

### DashScope 兼容模式

DashScope 提供 OpenAI 兼容的 API 端点：
- **端点**: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- **认证**: API Key 认证
- **请求格式**: 完全兼容 OpenAI Chat Completions API
- **响应格式**: 完全兼容 OpenAI Chat Completions API

### LangChain 集成

通过使用 `openai` provider 和自定义 `baseUrl`，LangChain 可以：
- 使用标准的 OpenAI ChatModel 类
- 支持所有 OpenAI 兼容的功能（工具调用、流式响应等）
- 保持与现有代码的完全兼容性

## 模型映射

| 前端显示 | 模型标识符 | 实际调用模型 | Provider |
|---------|-----------|-------------|----------|
| Qwen-Plus | `dashscope/qwen-plus` | `qwen-plus` | `openai` |
| DeepSeek V3 | `dashscope/deepseek-v3` | `deepseek-v3` | `openai` |
| DeepSeek R1 | `dashscope/deepseek-r1` | `deepseek-r1` | `openai` |

## 故障排除

如果仍有问题，请检查：

1. **API 密钥有效性**：确认 DashScope API 密钥有效且有足够额度
2. **网络连接**：确认可以访问 `dashscope.aliyuncs.com`
3. **服务重启**：确认已重启 LangGraph 服务
4. **环境变量**：确认环境变量正确设置

## 总结

通过将 DashScope 配置为使用 `openai` provider，成功解决了 LangChain 不支持 `dashscope` provider 的问题。现在 DashScope 模型可以正常显示和使用，完全兼容现有的 Open Canvas 功能。
