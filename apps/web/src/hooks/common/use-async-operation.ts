/**
 * 通用异步操作Hook - 减少重复代码
 * 主要改动：
 * 1. 提取通用的异步操作逻辑
 * 2. 统一加载状态和错误处理
 * 3. 支持重试和取消操作
 * 4. 提供类型安全的操作接口
 */

'use client';

import * as React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useErrorHandler } from '@/hooks/use-error-handler';

export interface AsyncOperationState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface AsyncOperationOptions {
  /** 是否在组件挂载时自动执行 */
  autoExecute?: boolean;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 是否启用取消功能 */
  enableCancel?: boolean;
}

export interface AsyncOperationReturn<T, P extends any[]> {
  /** 当前状态 */
  state: AsyncOperationState<T>;
  /** 执行异步操作 */
  execute: (...args: P) => Promise<T>;
  /** 重置状态 */
  reset: () => void;
  /** 取消操作 */
  cancel: () => void;
  /** 重试操作 */
  retry: (...args: P) => Promise<T>;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否有错误 */
  hasError: boolean;
  /** 是否有数据 */
  hasData: boolean;
}

/**
 * 通用异步操作Hook
 */
export function useAsyncOperation<T, P extends any[]>(
  operation: (...args: P) => Promise<T>,
  options: AsyncOperationOptions = {}
): AsyncOperationReturn<T, P> {
  const {
    autoExecute = false,
    maxRetries = 0,
    retryDelay = 1000,
    enableCancel = true,
  } = options;

  const { handleError } = useErrorHandler();
  const [state, setState] = useState<AsyncOperationState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastArgsRef = useRef<P | null>(null);
  const retryCountRef = useRef(0);

  /**
   * 执行异步操作
   */
  const execute = useCallback(async (...args: P): Promise<T> => {
    // 取消之前的操作
    if (enableCancel && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的AbortController
    if (enableCancel) {
      abortControllerRef.current = new AbortController();
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    lastArgsRef.current = args;
    retryCountRef.current = 0;

    try {
      const result = await operation(...args);
      
      // 检查是否被取消
      if (enableCancel && abortControllerRef.current?.signal.aborted) {
        throw new Error('Operation was cancelled');
      }

      setState({ data: result, loading: false, error: null });
      return result;
    } catch (error) {
      const err = error as Error;
      
      // 检查是否被取消
      if (enableCancel && abortControllerRef.current?.signal.aborted) {
        setState(prev => ({ ...prev, loading: false }));
        throw err;
      }

      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: err 
      }));

      // 处理错误
      await handleError(err, {
        operation: 'async_operation',
        metadata: { args, retryCount: retryCountRef.current },
      });

      throw err;
    }
  }, [operation, handleError, enableCancel]);

  /**
   * 重试操作
   */
  const retry = useCallback(async (...args: P): Promise<T> => {
    if (retryCountRef.current >= maxRetries) {
      throw new Error(`Maximum retry attempts (${maxRetries}) exceeded`);
    }

    retryCountRef.current++;
    
    // 等待重试延迟
    if (retryDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    return execute(...args);
  }, [execute, maxRetries, retryDelay]);

  /**
   * 取消操作
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    if (enableCancel && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setState({
      data: null,
      loading: false,
      error: null,
    });
    
    retryCountRef.current = 0;
    lastArgsRef.current = null;
  }, [enableCancel]);

  // 自动执行
  React.useEffect(() => {
    if (autoExecute && lastArgsRef.current) {
      execute(...lastArgsRef.current);
    }
  }, [autoExecute, execute]);

  return {
    state,
    execute,
    reset,
    cancel,
    retry,
    isLoading: state.loading,
    hasError: state.error !== null,
    hasData: state.data !== null,
  };
}

/**
 * 带缓存的异步操作Hook
 */
export function useCachedAsyncOperation<T, P extends any[]>(
  operation: (...args: P) => Promise<T>,
  cacheKey: string,
  options: AsyncOperationOptions & {
    cacheTtl?: number; // 缓存生存时间（毫秒）
  } = {}
) {
  const { cacheTtl = 300000, ...restOptions } = options; // 默认5分钟缓存
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());
  
  const cachedOperation = useCallback(async (...args: P): Promise<T> => {
    const key = `${cacheKey}:${JSON.stringify(args)}`;
    const cached = cacheRef.current.get(key);
    
    // 检查缓存是否有效
    if (cached && Date.now() - cached.timestamp < cacheTtl) {
      return cached.data;
    }

    // 执行操作并缓存结果
    const result = await operation(...args);
    cacheRef.current.set(key, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  }, [operation, cacheKey, cacheTtl]);

  return useAsyncOperation(cachedOperation, restOptions);
}

/**
 * 批量异步操作Hook
 */
export function useBatchAsyncOperation<T, P extends any[]>(
  operation: (...args: P) => Promise<T>,
  batchSize: number = 5,
  options: AsyncOperationOptions = {}
) {
  const [batchState, setBatchState] = useState<{
    results: T[];
    errors: Error[];
    completed: number;
    total: number;
  }>({
    results: [],
    errors: [],
    completed: 0,
    total: 0,
  });

  const executeBatch = useCallback(async (argsList: P[]): Promise<T[]> => {
    setBatchState({
      results: [],
      errors: [],
      completed: 0,
      total: argsList.length,
    });

    const results: T[] = [];
    const errors: Error[] = [];

    // 分批执行
    for (let i = 0; i < argsList.length; i += batchSize) {
      const batch = argsList.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (args) => {
        try {
          const result = await operation(...args);
          results.push(result);
          return { success: true, result };
        } catch (error) {
          errors.push(error as Error);
          return { success: false, error };
        }
      });

      await Promise.all(batchPromises);

      setBatchState(prev => ({
        ...prev,
        results: [...results],
        errors: [...errors],
        completed: Math.min(i + batchSize, argsList.length),
      }));
    }

    return results;
  }, [operation, batchSize]);

  return {
    executeBatch,
    batchState,
    isBatchComplete: batchState.completed === batchState.total,
    batchProgress: batchState.total > 0 ? batchState.completed / batchState.total : 0,
  };
}
