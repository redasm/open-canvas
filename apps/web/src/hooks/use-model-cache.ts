/**
 * 模型缓存Hook - 性能优化
 * 主要改动：
 * 1. 实现模型配置缓存
 * 2. 支持缓存失效和刷新
 * 3. 提供缓存统计和监控
 * 4. 优化模型加载性能
 */

'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { enhancedCacheManager } from '@/lib/cache/enhanced-cache-manager';
import { ModelDefinition } from '@opencanvas/shared/config/model-config';

interface UseModelCacheReturn {
  /** 获取缓存的模型列表 */
  getCachedModels: () => Promise<ModelDefinition[]>;
  /** 使模型缓存失效 */
  invalidateModelCache: () => Promise<void>;
  /** 刷新模型缓存 */
  refreshModelCache: () => Promise<ModelDefinition[]>;
  /** 获取缓存统计 */
  getCacheStats: () => any;
  /** 缓存状态 */
  cacheStatus: {
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
  };
}

/**
 * 模型缓存Hook
 */
export function useModelCache(): UseModelCacheReturn {
  const [cacheManager] = useState(() => enhancedCacheManager);

  const [cacheStatus, setCacheStatus] = useState({
    loading: false,
    error: null as string | null,
    lastUpdated: null as Date | null,
  });

  /**
   * 获取缓存的模型列表
   */
  const getCachedModels = useCallback(async (): Promise<ModelDefinition[]> => {
    const cacheKey = 'models:all';
    
    try {
      setCacheStatus(prev => ({ ...prev, loading: true, error: null }));
      
      const cached = await cacheManager.get<ModelDefinition[]>(cacheKey);
      
      if (cached) {
        setCacheStatus(prev => ({ 
          ...prev, 
          loading: false, 
          lastUpdated: new Date() 
        }));
        return cached;
      }

      // 缓存未命中，从API获取
      const models = await fetchModels();
      
      // 缓存5分钟
      await cacheManager.set(cacheKey, models, 300);
      
      setCacheStatus(prev => ({ 
        ...prev, 
        loading: false, 
        lastUpdated: new Date() 
      }));
      
      return models;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取模型列表失败';
      setCacheStatus(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage 
      }));
      throw error;
    }
  }, [cacheManager]);

  /**
   * 使模型缓存失效
   */
  const invalidateModelCache = useCallback(async (): Promise<void> => {
    const cacheKey = 'models:all';
    await cacheManager.delete(cacheKey);
    setCacheStatus(prev => ({ 
      ...prev, 
      lastUpdated: null 
    }));
  }, [cacheManager]);

  /**
   * 刷新模型缓存
   */
  const refreshModelCache = useCallback(async (): Promise<ModelDefinition[]> => {
    // 先使缓存失效
    await invalidateModelCache();
    // 然后重新获取
    return await getCachedModels();
  }, [invalidateModelCache, getCachedModels]);

  /**
   * 获取缓存统计
   */
  const getCacheStats = useCallback(() => {
    return cacheManager.getStats();
  }, [cacheManager]);

  return {
    getCachedModels,
    invalidateModelCache,
    refreshModelCache,
    getCacheStats,
    cacheStatus,
  };
}

/**
 * 从API获取模型列表
 */
async function fetchModels(): Promise<ModelDefinition[]> {
  try {
    const response = await fetch('/api/models');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error?.message || '获取模型列表失败');
    }
    
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch models:', error);
    throw error;
  }
}

/**
 * 模型配置缓存Hook
 */
export function useModelConfigCache() {
  const [cacheManager] = useState(() => enhancedCacheManager);

  /**
   * 获取缓存的模型配置
   */
  const getCachedModelConfig = useCallback(async (
    modelId: string
  ): Promise<any | null> => {
    const cacheKey = `model-config:${modelId}`;
    return await cacheManager.get(cacheKey);
  }, [cacheManager]);

  /**
   * 设置模型配置缓存
   */
  const setModelConfigCache = useCallback(async (
    modelId: string,
    config: any,
    ttl: number = 600
  ): Promise<void> => {
    const cacheKey = `model-config:${modelId}`;
    await cacheManager.set(cacheKey, config, ttl);
  }, [cacheManager]);

  /**
   * 使模型配置缓存失效
   */
  const invalidateModelConfigCache = useCallback(async (
    modelId: string
  ): Promise<void> => {
    const cacheKey = `model-config:${modelId}`;
    await cacheManager.delete(cacheKey);
  }, [cacheManager]);

  return {
    getCachedModelConfig,
    setModelConfigCache,
    invalidateModelConfigCache,
  };
}

/**
 * 智能体缓存Hook
 */
export function useAssistantCache() {
  const [cacheManager] = useState(() => enhancedCacheManager);

  /**
   * 获取缓存的智能体列表
   */
  const getCachedAssistants = useCallback(async (
    userId: string
  ): Promise<any[] | null> => {
    const cacheKey = `assistants:${userId}`;
    return await cacheManager.get(cacheKey);
  }, [cacheManager]);

  /**
   * 设置智能体列表缓存
   */
  const setAssistantsCache = useCallback(async (
    userId: string,
    assistants: any[],
    ttl: number = 300
  ): Promise<void> => {
    const cacheKey = `assistants:${userId}`;
    await cacheManager.set(cacheKey, assistants, ttl);
  }, [cacheManager]);

  /**
   * 使智能体缓存失效
   */
  const invalidateAssistantsCache = useCallback(async (
    userId: string
  ): Promise<void> => {
    const cacheKey = `assistants:${userId}`;
    await cacheManager.delete(cacheKey);
  }, [cacheManager]);

  return {
    getCachedAssistants,
    setAssistantsCache,
    invalidateAssistantsCache,
  };
}
