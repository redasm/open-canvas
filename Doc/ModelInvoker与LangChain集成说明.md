# ModelInvoker与LangChain/LangGraph集成说明

## 概述

本文档详细说明了Open Canvas项目中ModelInvoker的正确实现，以及它如何与LangChain和LangGraph框架完美集成，解决原始项目配置困难的问题。

## 设计理念

### 1. **解决原始项目的配置困难**

根据[Open Canvas GitHub仓库](https://github.com/langchain-ai/open-canvas)的说明，原始项目添加新模型需要：

1. **修改 `packages/shared/src/models.ts`** - 添加模型定义
2. **修改 `apps/agents/src/utils.ts`** - 更新 `getModelConfig` 函数  
3. **安装新的依赖包** - 如 `@langchain/anthropic`
4. **设置环境变量** - API密钥等
5. **手动测试** - 验证所有功能是否正常

这种方式需要修改多个文件，容易出错且维护困难。

### 2. **保持LangChain兼容性**

ModelInvoker的设计原则：
- **不重新实现LangChain功能** - 内部使用LangChain的`initChatModel`
- **保持完全兼容** - 返回标准的LangChain模型实例
- **简化配置流程** - 通过配置文件管理所有模型
- **与LangGraph集成** - 提供兼容的接口供LangGraph节点使用

## 核心实现

### 1. **ModelInvoker类结构**

```typescript
export class ModelInvoker {
  private static instance: ModelInvoker;
  private registry: ModelRegistry;
  
  // 单例模式
  static getInstance(): ModelInvoker;
  
  // 主要方法
  async invokeModel(modelId: string, messages: BaseMessage[], config: CustomModelConfig, options?: ModelInvokeOptions): Promise<ModelResponse>;
  async getModelInstance(modelId: string, config: CustomModelConfig, options?: ModelInvokeOptions);
  async getModelFromConfig(langGraphConfig: any, extra?: {...});
}
```

### 2. **LangChain集成**

ModelInvoker内部使用LangChain的`initChatModel`：

```typescript
private async createLangChainModel(
  model: ModelDefinition,
  provider: ModelProviderConfig,
  config: CustomModelConfig,
  options?: ModelInvokeOptions
) {
  // 构建LangChain模型配置
  const modelConfig: any = {
    modelProvider: model.provider,
    ...(includeStandardParams
      ? { maxTokens, temperature }
      : { max_completion_tokens: maxTokens }),
  };

  // 添加API密钥和基础URL
  if (provider.apiKey) {
    modelConfig.apiKey = provider.apiKey;
  }
  if (provider.baseUrl) {
    modelConfig.baseUrl = provider.baseUrl;
  }

  // 特殊处理Azure配置
  if (model.provider === 'azure_openai') {
    // Azure特定配置...
  }

  // 使用LangChain的initChatModel创建模型实例
  return await initChatModel(model.name, modelConfig);
}
```

### 3. **LangGraph集成**

提供兼容原始项目的`getModelFromConfig`方法：

```typescript
async getModelFromConfig(
  langGraphConfig: any,
  extra?: {
    temperature?: number;
    maxTokens?: number;
    isToolCalling?: boolean;
  }
) {
  const customModelName = langGraphConfig.configurable?.customModelName as string;
  const modelConfig = langGraphConfig.configurable?.modelConfig as CustomModelConfig;
  
  return await this.getModelInstance(customModelName, modelConfig, extra);
}
```

## 在LangGraph节点中的使用

### 1. **替换原有的getModelFromConfig调用**

```typescript
// 原始代码
import { getModelFromConfig } from "../../../utils.js";

const model = await getModelFromConfig(config, {
  temperature: 0.3,
  isToolCalling: true,
});

// 新代码
import { modelInvoker } from '../models/model-invoker';

const model = await modelInvoker.getModelFromConfig(config, {
  temperature: 0.3,
  isToolCalling: true,
});
```

### 2. **完整的LangGraph节点示例**

```typescript
import { modelInvoker } from '../models/model-invoker';
import { LangGraphRunnableConfig } from "@langchain/langgraph";

export const generateArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  // 使用ModelInvoker获取LangChain模型实例
  const model = await modelInvoker.getModelFromConfig(config, {
    temperature: 0.3,
    isToolCalling: true,
  });

  // 直接使用LangChain模型实例进行工具调用
  const modelWithArtifactTool = model.bindTools([artifactTool], {
    tool_choice: "artifact_generator",
  });

  const response = await modelWithArtifactTool.invoke([
    { role: "system", content: fullSystemPrompt },
    ...contextDocumentMessages,
    ...state._messages,
  ], { runName: "generate_artifact" });

  return { artifact: newArtifact };
};
```

## 配置简化流程

### 1. **添加新模型**

现在只需要：

1. **编辑 `config/models.json`** - 添加模型配置
2. **设置环境变量** - API密钥
3. **重启服务** - 自动加载新配置

### 2. **配置文件示例**

```json
{
  "providers": {
    "openai": {
      "name": "OpenAI",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "${OPENAI_API_KEY}"
    }
  },
  "models": {
    "openai/gpt-4": {
      "name": "gpt-4",
      "provider": "openai",
      "capabilities": {
        "maxTokens": 8192,
        "temperatureRange": { "min": 0, "max": 2, "default": 0.7 },
        "supportsToolCalling": true,
        "supportsStreaming": true
      },
      "metadata": {
        "isNew": false,
        "category": "general"
      }
    }
  }
}
```

## 错误处理

### 1. **自定义错误类型**

```typescript
export class ModelNotFoundError extends Error { }
export class ProviderNotFoundError extends Error { }
export class ModelInvocationError extends Error { }
export class UnsupportedProviderError extends Error { }
```

### 2. **重试机制**

```typescript
private async executeWithRetry<T>(
  operation: () => Promise<T>,
  retries: number = 3
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (i === retries) break;
      
      // 指数退避
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
```

## 优势总结

### 1. **配置简化**
- 从修改多个文件到只需编辑JSON配置文件
- 支持热重载，无需重启服务
- 统一的配置管理界面

### 2. **LangChain兼容**
- 完全使用LangChain的`initChatModel`
- 支持所有LangChain功能（工具调用、流式响应等）
- 返回标准的LangChain模型实例

### 3. **LangGraph集成**
- 提供兼容的`getModelFromConfig`方法
- 可直接在LangGraph节点中使用
- 保持原有的工作流逻辑

### 4. **错误处理**
- 统一的错误类型和处理机制
- 自动重试和指数退避
- 详细的错误信息和调试支持

## 结论

ModelInvoker成功解决了原始项目配置困难的问题，同时保持了与LangChain和LangGraph框架的完美兼容。它不是一个替代品，而是一个配置管理层的增强，让开发者能够更轻松地管理和使用AI模型，而不需要修改框架本身。

通过这种方式，Open Canvas项目既保持了原有的技术架构优势，又大大简化了模型配置和维护的复杂度。
