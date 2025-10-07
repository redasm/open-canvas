/**
 * 模型注册器Hook - 前端使用模型配置系统
 * 主要改动：
 * 1. 提供模型加载和管理功能
 * 2. 支持模型搜索和分类过滤
 * 3. 集成缓存和错误处理
 * 4. 提供模型配置功能
 */

'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ModelDefinition, ModelProviderConfig } from '@opencanvas/shared/config/model-config';
import { useErrorHandler } from './use-error-handler';
import { enhancedCacheManager } from '@/lib/cache/enhanced-cache-manager';

interface UseModelRegistryReturn {
  /** 所有模型 */
  models: ModelDefinition[];
  /** 所有提供商 */
  providers: ModelProviderConfig[];
  /** 按分类分组的模型 */
  modelsByCategory: Record<string, ModelDefinition[]>;
  /** 按提供商分组的模型 */
  modelsByProvider: Record<string, ModelDefinition[]>;
  /** 所有分类 */
  categories: string[];
  /** 所有提供商名称 */
  providerNames: string[];
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 重新加载模型 */
  reloadModels: () => Promise<void>;
  /** 根据ID获取模型 */
  getModel: (id: string) => ModelDefinition | undefined;
  /** 根据提供商获取模型 */
  getModelsByProvider: (provider: string) => ModelDefinition[];
  /** 根据分类获取模型 */
  getModelsByCategory: (category: string) => ModelDefinition[];
  /** 搜索模型 */
  searchModels: (query: string) => ModelDefinition[];
  /** 获取新模型 */
  getNewModels: () => ModelDefinition[];
}

/**
 * 模型注册器Hook
 */
export function useModelRegistry(): UseModelRegistryReturn {
  const [models, setModels] = useState<ModelDefinition[]>([]);
  const [providers, setProviders] = useState<ModelProviderConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleError } = useErrorHandler();
  const cacheManager = enhancedCacheManager;

  /**
   * 加载模型
   */
  const loadModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 首先尝试从缓存获取
      const cacheKey = 'models:all';
      const cachedData = await cacheManager.get<{models: ModelDefinition[], providers: ModelProviderConfig[]}>(cacheKey);
      
      if (cachedData) {
        console.log('✅ 从缓存加载模型数据');
        setModels(cachedData.models);
        setProviders(cachedData.providers);
        setLoading(false);
        return;
      }
      
      // 缓存未命中，从API获取
      console.log('🔄 从API获取模型数据');
      const response = await fetch('/api/models');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error?.message || '获取模型列表失败');
      }
      
      const modelsData = data.data.models || [];
      const providersData = data.data.providers || [];
      
      setModels(modelsData);
      setProviders(providersData);
      
      // 缓存数据（5分钟）
      await cacheManager.set(cacheKey, {
        models: modelsData,
        providers: providersData
      }, 300);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取模型列表失败';
      setError(errorMessage);
      await handleError(err as Error, {
        operation: 'load_models'
      });
    } finally {
      setLoading(false);
    }
  }, [handleError, cacheManager]);

  /**
   * 重新加载模型
   */
  const reloadModels = useCallback(async () => {
    // 清除缓存
    await cacheManager.delete('models:all');
    await loadModels();
  }, [loadModels, cacheManager]);

  /**
   * 根据ID获取模型
   */
  const getModel = useCallback((id: string): ModelDefinition | undefined => {
    return models.find(model => model.id === id);
  }, [models]);

  /**
   * 根据提供商获取模型
   */
  const getModelsByProvider = useCallback((provider: string): ModelDefinition[] => {
    return models.filter(model => model.provider === provider);
  }, [models]);

  /**
   * 根据分类获取模型
   */
  const getModelsByCategory = useCallback((category: string): ModelDefinition[] => {
    return models.filter(model => model.metadata.category === category);
  }, [models]);

  /**
   * 搜索模型
   */
  const searchModels = useCallback((query: string): ModelDefinition[] => {
    if (!query.trim()) {
      return models;
    }
    
    const lowerQuery = query.toLowerCase();
    return models.filter(model => 
      model.name.toLowerCase().includes(lowerQuery) ||
      model.displayName.toLowerCase().includes(lowerQuery) ||
      model.metadata.description?.toLowerCase().includes(lowerQuery)
    );
  }, [models]);

  /**
   * 获取新模型
   */
  const getNewModels = useCallback((): ModelDefinition[] => {
    return models.filter(model => model.metadata?.isNew);
  }, [models]);

  // 计算派生数据
  const modelsByCategory = models.reduce((acc, model) => {
    const category = model.metadata?.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(model);
    return acc;
  }, {} as Record<string, ModelDefinition[]>);

  const modelsByProvider = models.reduce((acc, model) => {
    const provider = model.provider;
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(model);
    return acc;
  }, {} as Record<string, ModelDefinition[]>);

  const categories = Array.from(new Set(models.map(m => m.metadata?.category || 'general')));
  const providerNames = Array.from(new Set(models.map(m => m.provider)));

  // 初始化加载
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  return {
    models,
    providers,
    modelsByCategory,
    modelsByProvider,
    categories,
    providerNames,
    loading,
    error,
    reloadModels,
    getModel,
    getModelsByProvider,
    getModelsByCategory,
    searchModels,
    getNewModels,
  };
}

/**
 * 模型选择Hook
 */
export function useModelSelector() {
  const { models, categories, loading, error } = useModelRegistry();
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [selectedProvider, setSelectedProvider] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * 过滤后的模型
   */
  const filteredModels = useCallback(() => {
    let filtered = models;

    // 按分类过滤
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(model => model.metadata.category === selectedCategory);
    }

    // 按提供商过滤
    if (selectedProvider !== 'all') {
      filtered = filtered.filter(model => model.provider === selectedProvider);
    }

    // 按搜索查询过滤
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(model => 
        model.name.toLowerCase().includes(lowerQuery) ||
        model.displayName.toLowerCase().includes(lowerQuery) ||
        model.metadata.description?.toLowerCase().includes(lowerQuery)
      );
    }

    return filtered;
  }, [models, selectedCategory, selectedProvider, searchQuery]);

  return {
    models: filteredModels(),
    categories,
    selectedCategory,
    setSelectedCategory,
    selectedProvider,
    setSelectedProvider,
    searchQuery,
    setSearchQuery,
    loading,
    error,
  };
}
