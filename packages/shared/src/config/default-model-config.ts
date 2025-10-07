/**
 * 默认模型配置 - 替代硬编码的默认配置
 * 主要改动：
 * 1. 从配置文件获取默认模型
 * 2. 支持动态默认模型选择
 * 3. 提供向后兼容的接口
 */

import { ModelRegistry } from './model-registry';
import { CustomModelConfig } from '../types';

/**
 * 获取默认模型ID
 */
export function getDefaultModelId(): string {
  try {
    const registry = ModelRegistry.getInstance();
    if (!registry.isInitialized()) {
      // 如果注册器未初始化，返回硬编码默认值
      return 'gpt-4o-mini';
    }

    const models = registry.getAllModels();
    if (models.length === 0) {
      return 'gpt-4o-mini';
    }

    // 优先选择非新模型作为默认模型
    const nonNewModels = models.filter(m => !m.metadata.isNew);
    if (nonNewModels.length > 0) {
      return nonNewModels[0].id;
    }

    // 如果没有非新模型，选择第一个模型
    return models[0].id;
  } catch (error) {
    console.warn('Failed to get default model from registry, using fallback:', error);
    return 'gpt-4o-mini';
  }
}

/**
 * 获取默认模型配置
 */
export function getDefaultModelConfig(): CustomModelConfig {
  try {
    const registry = ModelRegistry.getInstance();
    const defaultModelId = getDefaultModelId();
    const model = registry.getModel(defaultModelId);

    if (model) {
      return {
        provider: model.provider,
        temperatureRange: {
          min: model.capabilities.temperatureRange.min,
          max: model.capabilities.temperatureRange.max,
          default: model.capabilities.temperatureRange.default,
          current: model.capabilities.temperatureRange.default,
        },
        maxTokens: {
          min: 1,
          max: model.capabilities.maxTokens,
          default: Math.min(model.capabilities.maxTokens, 4096),
          current: Math.min(model.capabilities.maxTokens, 4096),
        },
        ...(model.provider === "azure_openai" && {
          azureConfig: {
            azureOpenAIApiKey: process.env._AZURE_OPENAI_API_KEY || "",
            azureOpenAIApiInstanceName: process.env._AZURE_OPENAI_API_INSTANCE_NAME || "",
            azureOpenAIApiDeploymentName: process.env._AZURE_OPENAI_API_DEPLOYMENT_NAME || "",
            azureOpenAIApiVersion: process.env._AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
            azureOpenAIBasePath: process.env._AZURE_OPENAI_API_BASE_PATH,
          },
        }),
      };
    }
  } catch (error) {
    console.warn('Failed to get default model config from registry, using fallback:', error);
  }

  // 回退到硬编码配置
  return {
    provider: "openai",
    temperatureRange: {
      min: 0,
      max: 1,
      default: 0.5,
      current: 0.5,
    },
    maxTokens: {
      min: 1,
      max: 4096,
      default: 4096,
      current: 4096,
    },
  };
}

/**
 * 检查模型是否支持流式文本
 */
export function isNonStreamingTextModel(modelId: string): boolean {
  try {
    const registry = ModelRegistry.getInstance();
    const model = registry.getModel(modelId);
    return model ? !model.capabilities.supportsStreaming : false;
  } catch (error) {
    console.warn('Failed to check model streaming capability, using fallback:', error);
    // 回退到硬编码列表
    const nonStreamingModels = [
      "o1",
      "gemini-2.0-flash-thinking-exp-01-21",
    ];
    return nonStreamingModels.includes(modelId);
  }
}

/**
 * 检查模型是否支持流式工具调用
 */
export function isNonStreamingToolCallingModel(modelId: string): boolean {
  try {
    const registry = ModelRegistry.getInstance();
    const model = registry.getModel(modelId);
    return model ? !model.capabilities.supportsStreaming : false;
  } catch (error) {
    console.warn('Failed to check model tool calling capability, using fallback:', error);
    // 回退到硬编码列表
    const nonStreamingToolCallingModels = [
      "gemini-2.0-flash-exp",
      "gemini-1.5-flash",
      "gemini-2.5-pro-preview-05-06",
      "gemini-2.5-flash-preview-05-20",
    ];
    return nonStreamingToolCallingModels.includes(modelId);
  }
}

/**
 * 检查模型是否支持温度参数
 */
export function isTemperatureExcludedModel(modelId: string): boolean {
  try {
    const registry = ModelRegistry.getInstance();
    const model = registry.getModel(modelId);
    return model ? !model.capabilities.temperatureRange : false;
  } catch (error) {
    console.warn('Failed to check model temperature capability, using fallback:', error);
    // 回退到硬编码列表
    const temperatureExcludedModels = [
      "o1-mini",
      "o3-mini",
      "o1",
      "o4-mini",
    ];
    return temperatureExcludedModels.includes(modelId);
  }
}

/**
 * 检查模型是否为思考模型
 */
export function isThinkingModel(modelId: string): boolean {
  try {
    const registry = ModelRegistry.getInstance();
    const model = registry.getModel(modelId);
    return model ? model.metadata.category === 'thinking' : false;
  } catch (error) {
    console.warn('Failed to check model thinking capability, using fallback:', error);
    // 回退到硬编码列表
    const thinkingModels = [
      "accounts/fireworks/models/deepseek-r1",
      "groq/deepseek-r1-distill-llama-70b",
    ];
    return thinkingModels.includes(modelId);
  }
}
