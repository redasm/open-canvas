/**
 * 模型注册器 - 动态模型管理
 * 主要改动：
 * 1. 实现单例模式的模型注册器
 * 2. 支持运行时动态注册模型和提供商
 * 3. 提供类型安全的模型查询接口
 * 4. 支持模型过滤和分类查询
 */

import { ModelDefinition, ModelProviderConfig, ModelCategory } from './model-config.js';

export class ModelRegistry {
  private static instance: ModelRegistry;
  private models: Map<string, ModelDefinition> = new Map();
  private providers: Map<string, ModelProviderConfig> = new Map();
  private initialized = false;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  /**
   * 注册模型提供商
   */
  registerProvider(config: ModelProviderConfig): void {
    this.providers.set(config.name, config);
  }

  /**
   * 注册模型
   */
  registerModel(model: ModelDefinition): void {
    // 验证模型配置
    this.validateModel(model);
    this.models.set(model.id, model);
  }

  /**
   * 批量注册模型
   */
  registerModels(models: ModelDefinition[]): void {
    models.forEach(model => this.registerModel(model));
  }

  /**
   * 获取模型
   */
  getModel(id: string): ModelDefinition | undefined {
    return this.models.get(id);
  }

  /**
   * 获取所有模型
   */
  getAllModels(): ModelDefinition[] {
    return Array.from(this.models.values());
  }

  /**
   * 根据提供商获取模型
   */
  getModelsByProvider(provider: string): ModelDefinition[] {
    return Array.from(this.models.values())
      .filter(model => model.provider === provider);
  }

  /**
   * 根据分类获取模型
   */
  getModelsByCategory(category: ModelCategory): ModelDefinition[] {
    return Array.from(this.models.values())
      .filter(model => model.metadata.category === category);
  }

  /**
   * 获取新模型
   */
  getNewModels(): ModelDefinition[] {
    return Array.from(this.models.values())
      .filter(model => model.metadata.isNew);
  }

  /**
   * 搜索模型
   */
  searchModels(query: string): ModelDefinition[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.models.values())
      .filter(model => 
        model.name.toLowerCase().includes(lowerQuery) ||
        model.displayName.toLowerCase().includes(lowerQuery) ||
        model.metadata.description?.toLowerCase().includes(lowerQuery)
      );
  }

  /**
   * 获取提供商
   */
  getProvider(name: string): ModelProviderConfig | undefined {
    return this.providers.get(name);
  }

  /**
   * 获取所有提供商
   */
  getAllProviders(): ModelProviderConfig[] {
    return Array.from(this.providers.values());
  }

  /**
   * 检查模型是否存在
   */
  hasModel(id: string): boolean {
    return this.models.has(id);
  }

  /**
   * 检查提供商是否存在
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * 移除模型
   */
  removeModel(id: string): boolean {
    return this.models.delete(id);
  }

  /**
   * 移除提供商
   */
  removeProvider(name: string): boolean {
    return this.providers.delete(name);
  }

  /**
   * 清空所有模型
   */
  clearModels(): void {
    this.models.clear();
  }

  /**
   * 清空所有提供商
   */
  clearProviders(): void {
    this.providers.clear();
  }

  /**
   * 获取模型统计信息
   */
  getStats(): {
    totalModels: number;
    totalProviders: number;
    modelsByProvider: Record<string, number>;
    modelsByCategory: Record<string, number>;
  } {
    const models = Array.from(this.models.values());
    const providers = Array.from(this.providers.values());
    
    const modelsByProvider: Record<string, number> = {};
    const modelsByCategory: Record<string, number> = {};
    
    models.forEach(model => {
      modelsByProvider[model.provider] = (modelsByProvider[model.provider] || 0) + 1;
      modelsByCategory[model.metadata.category] = (modelsByCategory[model.metadata.category] || 0) + 1;
    });

    return {
      totalModels: models.length,
      totalProviders: providers.length,
      modelsByProvider,
      modelsByCategory,
    };
  }

  /**
   * 验证模型配置
   */
  private validateModel(model: ModelDefinition): void {
    if (!model.id) {
      throw new Error('Model ID is required');
    }
    if (!model.name) {
      throw new Error('Model name is required');
    }
    if (!model.provider) {
      throw new Error('Model provider is required');
    }
    if (!this.providers.has(model.provider)) {
      throw new Error(`Provider ${model.provider} is not registered`);
    }
    if (model.capabilities.maxTokens <= 0) {
      throw new Error('Max tokens must be greater than 0');
    }
    if (model.capabilities.temperatureRange.min >= model.capabilities.temperatureRange.max) {
      throw new Error('Invalid temperature range');
    }
  }

  /**
   * 标记为已初始化
   */
  markAsInitialized(): void {
    this.initialized = true;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 导出配置
   */
  exportConfig(): {
    providers: Record<string, ModelProviderConfig>;
    models: Record<string, ModelDefinition>;
  } {
    const providers: Record<string, ModelProviderConfig> = {};
    const models: Record<string, ModelDefinition> = {};
    
    this.providers.forEach((config, name) => {
      providers[name] = config;
    });
    
    this.models.forEach((model, id) => {
      models[id] = model;
    });

    return { providers, models };
  }

  /**
   * 导入配置
   */
  importConfig(config: {
    providers: Record<string, ModelProviderConfig>;
    models: Record<string, ModelDefinition>;
  }): void {
    // 清空现有配置
    this.clearProviders();
    this.clearModels();
    
    // 导入提供商
    Object.entries(config.providers).forEach(([, providerConfig]) => {
      this.registerProvider(providerConfig);
    });
    
    // 导入模型
    Object.entries(config.models).forEach(([, model]) => {
      this.registerModel(model);
    });
    
    this.markAsInitialized();
  }
}