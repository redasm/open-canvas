/**
 * 简化配置的模型调用器 - 解决原始项目配置困难的问题
 * 主要功能：
 * 1. 统一模型调用接口，简化配置流程
 * 2. 自动处理不同提供商的配置差异
 * 3. 提供错误处理和重试机制
 * 4. 集成新的模型注册器系统，避免硬编码
 */

import { BaseMessage } from '@langchain/core/messages';
import { ModelRegistry } from '@opencanvas/shared/config/model-registry';
import { ModelDefinition, ModelProviderConfig } from '@opencanvas/shared/config/model-config';
import { CustomModelConfig } from '@opencanvas/shared/types';
import { getInitializedModelRegistry } from '../config/init-model-registry';
import { initChatModel } from "langchain/chat_models/universal";

export interface ModelInvokeOptions {
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  toolCalling?: boolean;
  timeout?: number;
  retries?: number;
}

export interface ModelResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

/**
 * 模型未找到错误
 */
export class ModelNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelNotFoundError';
  }
}

/**
 * 提供商未找到错误
 */
export class ProviderNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderNotFoundError';
  }
}

/**
 * 模型调用错误
 */
export class ModelInvocationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ModelInvocationError';
  }
}

/**
 * 不支持的提供商错误
 */
export class UnsupportedProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedProviderError';
  }
}

/**
 * 简化配置的模型调用器
 * 解决原始项目配置困难的问题
 */
export class ModelInvoker {
  private static instance: ModelInvoker;
  private registry: ModelRegistry;
  
  private constructor() {
    this.registry = ModelRegistry.getInstance();
  }

  static getInstance(): ModelInvoker {
    if (!ModelInvoker.instance) {
      ModelInvoker.instance = new ModelInvoker();
    }
    return ModelInvoker.instance;
  }

  /**
   * 调用模型 - 简化配置流程
   */
  async invokeModel(
    modelId: string,
    messages: BaseMessage[],
    config: CustomModelConfig,
    options?: ModelInvokeOptions
  ): Promise<ModelResponse> {
    try {
      // 确保模型注册器已初始化
      await getInitializedModelRegistry();
      
      const model = this.registry.getModel(modelId);
      if (!model) {
        throw new ModelNotFoundError(`Model ${modelId} not found`);
      }

      const provider = this.registry.getProvider(model.provider);
      if (!provider) {
        throw new ProviderNotFoundError(`Provider ${model.provider} not found`);
      }

      // 使用LangChain的initChatModel创建实际模型实例
      const langchainModel = await this.createLangChainModel(model, provider, config, options);
      
      // 调用模型
      const response = await this.executeWithRetry(
        () => langchainModel.invoke(messages),
        options?.retries || 3
      );

      return this.processResponse(response, model);
    } catch (error) {
      if (error instanceof ModelNotFoundError || 
          error instanceof ProviderNotFoundError || 
          error instanceof UnsupportedProviderError) {
        throw error;
      }
      
      throw new ModelInvocationError(
        `Failed to invoke model ${modelId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { modelId, error }
      );
    }
  }

  /**
   * 创建LangChain模型实例 - 简化配置逻辑
   */
  private async createLangChainModel(
    model: ModelDefinition,
    provider: ModelProviderConfig,
    config: CustomModelConfig,
    options?: ModelInvokeOptions
  ) {
    const { temperature = 0.5, maxTokens } = {
      temperature: config.temperatureRange?.current || 0.5,
      maxTokens: config.maxTokens?.current || 4096,
      ...options,
    };

    // 检查是否支持温度参数
    const includeStandardParams = this.shouldIncludeStandardParams(model);

    // 构建LangChain模型配置
    const modelConfig: any = {
      modelProvider: model.provider,
      ...(includeStandardParams
        ? { maxTokens, temperature }
        : {
            max_completion_tokens: maxTokens,
          }),
    };

    // 添加API密钥
    if (provider.apiKey) {
      modelConfig.apiKey = provider.apiKey;
    }

    // 添加基础URL
    if (provider.baseUrl) {
      modelConfig.baseUrl = provider.baseUrl;
    }

    // 特殊处理Azure配置
    if (model.provider === 'azure_openai') {
      modelConfig.azureOpenAIApiKey = process.env._AZURE_OPENAI_API_KEY || "";
      modelConfig.azureOpenAIApiInstanceName = process.env._AZURE_OPENAI_API_INSTANCE_NAME || "";
      modelConfig.azureOpenAIApiDeploymentName = process.env._AZURE_OPENAI_API_DEPLOYMENT_NAME || "";
      modelConfig.azureOpenAIApiVersion = process.env._AZURE_OPENAI_API_VERSION || "2024-08-01-preview";
      modelConfig.azureOpenAIBasePath = process.env._AZURE_OPENAI_API_BASE_PATH;
    }

    // 使用LangChain的initChatModel创建模型实例
    return await initChatModel(model.name, modelConfig);
  }

  /**
   * 检查是否应该包含标准参数
   */
  private shouldIncludeStandardParams(model: ModelDefinition): boolean {
    // 某些模型（如OpenAI o1）不支持温度参数
    const temperatureExcludedModels = ['o1-preview', 'o1-mini', 'o3-mini'];
    return !temperatureExcludedModels.some(excluded => model.name.includes(excluded));
  }

  /**
   * 带重试的执行
   */
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
        
        if (i === retries) {
          break;
        }
        
        // 指数退避
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * 处理响应
   */
  private processResponse(response: any, model: ModelDefinition): ModelResponse {
    return {
      content: response.content || response.text || '',
      usage: response.usage,
      metadata: {
        modelId: model.id,
        provider: model.provider,
        timestamp: new Date().toISOString(),
        ...response.metadata,
      },
    };
  }

  /**
   * 获取LangChain模型实例（用于LangGraph节点集成）
   * 这是与LangGraph节点集成的主要方法
   */
  async getModelInstance(
    modelId: string,
    config: CustomModelConfig,
    options?: ModelInvokeOptions
  ) {
    await getInitializedModelRegistry();
    
    const model = this.registry.getModel(modelId);
    if (!model) {
      throw new ModelNotFoundError(`Model ${modelId} not found`);
    }

    const provider = this.registry.getProvider(model.provider);
    if (!provider) {
      throw new ProviderNotFoundError(`Provider ${model.provider} not found`);
    }

    return await this.createLangChainModel(model, provider, config, options);
  }

  /**
   * 兼容原始项目的getModelFromConfig函数
   * 用于在LangGraph节点中直接替换原有的getModelFromConfig调用
   */
  async getModelFromConfig(
    langGraphConfig: any,
    extra?: {
      temperature?: number;
      maxTokens?: number;
      isToolCalling?: boolean;
    }
  ) {
    const customModelName = langGraphConfig.configurable?.customModelName as string;
    if (!customModelName) {
      throw new Error("Model name is missing in config.");
    }

    const modelConfig = langGraphConfig.configurable?.modelConfig as CustomModelConfig;
    
    return await this.getModelInstance(customModelName, modelConfig, extra);
  }
}

/**
 * 创建模型调用器实例
 */
export function createModelInvoker(): ModelInvoker {
  return ModelInvoker.getInstance();
}

/**
 * 默认模型调用器实例
 */
export const modelInvoker = createModelInvoker();
