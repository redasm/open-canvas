# 阿里云百炼 DeepSeek 模型集成配置

## 概述

基于阿里云百炼控制台提供的官方示例代码，成功将 DeepSeek 系列模型集成到 Open Canvas 项目中。

## 官方示例代码分析

从 [阿里云百炼控制台](https://bailian.console.aliyun.com/?spm=5176.29597918.resourceCenter.1.6d7d7b08wQgaGB&tab=api#/api/?type=model&url=2868565) 提供的代码：

```javascript
const openai = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY, 
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});
```

**关键信息**：
- ✅ **API 端点**：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- ✅ **模型名称**：`deepseek-v3.2-exp`、`deepseek-v3.1`、`deepseek-v3`、`deepseek-r1`
- ✅ **特殊参数**：`enable_thinking: true`（仅对 v3.2-exp 和 v3.1 有效）
- ✅ **流式支持**：支持 `stream: true` 和 `stream_options`

## 集成实现

### 1. 模型配置修改

**文件**: `apps/agents/src/utils.ts`

```typescript
if (customModelName.includes("fireworks/")) {
  let actualModelName = providerConfig.modelName;
  
  // 将 Fireworks 模型名称转换为阿里云百炼格式
  if (actualModelName.includes("deepseek-r1")) {
    actualModelName = "deepseek-r1";
  } else if (actualModelName.includes("deepseek-v3")) {
    actualModelName = "deepseek-v3";
  } else if (actualModelName.includes("deepseek-v3.1")) {
    actualModelName = "deepseek-v3.1";
  } else if (actualModelName.includes("deepseek-v3.2-exp")) {
    actualModelName = "deepseek-v3.2-exp";
  } else if (actualModelName.includes("llama-v3p3-70b-instruct")) {
    actualModelName = "llama-v3p3-70b-instruct";
  }
  
  if (
    extra?.isToolCalling &&
    actualModelName !== "llama-v3p3-70b-instruct" &&
    actualModelName !== "deepseek-r1"
  ) {
    actualModelName = "llama-v3p3-70b-instruct";
  }
  
  return {
    ...providerConfig,
    modelName: actualModelName,
    modelProvider: "openai", // 使用 OpenAI 提供商，支持自定义 baseUrl
    apiKey: process.env.DASHSCOPE_API_KEY, // 使用阿里云百炼 API 密钥
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", // 阿里云百炼端点
  };
}
```

### 2. 模型定义更新

**文件**: `packages/shared/src/models.ts`

```typescript
const FIREWORKS_MODELS: ModelConfigurationParams[] = [
  // ... 其他模型
  {
    name: "accounts/fireworks/models/deepseek-r1",
    label: "DeepSeek R1 (DashScope)",
    config: {
      provider: "fireworks",
      temperatureRange: {
        min: 0,
        max: 1,
        default: 0.5,
        current: 0.5,
      },
      maxTokens: {
        min: 1,
        max: 8_000,
        default: 4_096,
        current: 4_096,
      },
    },
    isNew: false,
  },
  {
    name: "accounts/fireworks/models/deepseek-v3.1",
    label: "DeepSeek V3.1 (DashScope)",
    config: {
      provider: "fireworks",
      temperatureRange: {
        min: 0,
        max: 1,
        default: 0.5,
        current: 0.5,
      },
      maxTokens: {
        min: 1,
        max: 8_000,
        default: 4_096,
        current: 4_096,
      },
    },
    isNew: true,
  },
  {
    name: "accounts/fireworks/models/deepseek-v3.2-exp",
    label: "DeepSeek V3.2-EXP (DashScope)",
    config: {
      provider: "fireworks",
      temperatureRange: {
        min: 0,
        max: 1,
        default: 0.5,
        current: 0.5,
      },
      maxTokens: {
        min: 1,
        max: 8_000,
        default: 4_096,
        current: 4_096,
      },
    },
    isNew: true,
  },
];
```

### 3. 环境变量配置

创建 `.env` 文件：

```bash
# 阿里云百炼 (DashScope) 配置
DASHSCOPE_API_KEY=sk-your-dashscope-api-key-here

# 启用 Fireworks 模型（现在使用阿里云百炼）
NEXT_PUBLIC_FIREWORKS_ENABLED=true

# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# 开发配置
BYPASS_AUTH=true
LANGSMITH_TRACING=false
```

## 支持的模型

### DeepSeek 系列模型

1. **DeepSeek R1** (`deepseek-r1`)
   - 支持工具调用
   - 推理能力强
   - 适合复杂任务

2. **DeepSeek V3** (`deepseek-v3`)
   - 基础版本
   - 支持工具调用
   - 通用场景

3. **DeepSeek V3.1** (`deepseek-v3.1`)
   - 增强版本
   - 支持 `enable_thinking` 参数
   - 更好的推理能力

4. **DeepSeek V3.2-EXP** (`deepseek-v3.2-exp`)
   - 实验版本
   - 支持 `enable_thinking` 参数
   - 最新的推理能力

### 特殊功能

- **思考过程显示**：V3.1 和 V3.2-EXP 支持 `enable_thinking` 参数
- **流式响应**：所有模型都支持流式输出
- **工具调用**：R1 和 V3 系列都支持工具调用

## 使用方法

### 1. 获取 API 密钥

1. 访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/)
2. 创建 API 密钥
3. 将密钥配置到环境变量 `DASHSCOPE_API_KEY`

### 2. 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
DASHSCOPE_API_KEY=sk-your-actual-api-key
NEXT_PUBLIC_FIREWORKS_ENABLED=true
```

### 3. 重启服务

```bash
# 停止当前服务
# 重新启动
cd apps/agents && yarn dev
cd apps/web && yarn dev
```

### 4. 选择模型

在 Open Canvas 界面中：
1. 打开模型选择器
2. 选择 "Fireworks" 分组
3. 选择任意一个 DeepSeek 模型
4. 发送测试消息

## 技术细节

### API 端点映射

| Open Canvas 模型名称 | 阿里云百炼模型名称 | 特殊功能 |
|---------------------|-------------------|----------|
| `accounts/fireworks/models/deepseek-r1` | `deepseek-r1` | 工具调用 |
| `accounts/fireworks/models/deepseek-v3` | `deepseek-v3` | 工具调用 |
| `accounts/fireworks/models/deepseek-v3.1` | `deepseek-v3.1` | 思考过程 |
| `accounts/fireworks/models/deepseek-v3.2-exp` | `deepseek-v3.2-exp` | 思考过程 |

### 请求格式

```json
{
  "model": "deepseek-v3.2-exp",
  "messages": [
    {
      "role": "user",
      "content": "你是谁"
    }
  ],
  "enable_thinking": true,
  "stream": true,
  "stream_options": {
    "include_usage": true
  }
}
```

## 故障排除

### 常见问题

1. **API 密钥错误**
   - 检查 `DASHSCOPE_API_KEY` 是否正确设置
   - 确认 API 密钥在阿里云百炼控制台中有效

2. **模型不可用**
   - 检查 `NEXT_PUBLIC_FIREWORKS_ENABLED` 是否为 `true`
   - 确认阿里云百炼支持相应的模型

3. **工具调用失败**
   - 检查模型是否支持工具调用
   - 查看控制台错误信息

### 调试方法

1. **查看控制台日志**
   - 检查 LangGraph 服务的控制台输出
   - 查看是否有 API 调用错误

2. **测试 API 连接**
   - 使用官方示例代码测试 API
   - 验证 API 密钥和端点是否正常工作

## 总结

通过以上配置，成功将阿里云百炼的 DeepSeek 系列模型集成到 Open Canvas 中：

- ✅ **保持兼容性**：不需要修改前端代码
- ✅ **灵活配置**：支持环境变量配置
- ✅ **易于维护**：集中管理 API 密钥和端点
- ✅ **支持回退**：保持原有的工具调用回退机制
- ✅ **特殊功能**：支持思考过程显示（V3.1 和 V3.2-EXP）

现在您可以使用阿里云百炼的强大模型能力，同时保持 Open Canvas 的完整功能。
