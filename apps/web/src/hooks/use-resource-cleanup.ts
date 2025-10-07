/**
 * 资源清理Hook - 内存管理优化
 * 主要改动：
 * 1. 实现资源清理机制
 * 2. 防止内存泄漏
 * 3. 支持定时器和事件监听器清理
 * 4. 提供资源使用监控
 */

'use client';

import * as React from 'react';
import { useCallback, useEffect, useRef } from 'react';

interface ResourceCleanup {
  /** 清理函数 */
  cleanup: () => void;
  /** 资源类型 */
  type: 'timer' | 'listener' | 'subscription' | 'connection' | 'other';
  /** 资源描述 */
  description?: string;
}

interface UseResourceCleanupReturn {
  /** 添加清理函数 */
  addCleanup: (cleanup: () => void, type?: ResourceCleanup['type'], description?: string) => void;
  /** 执行所有清理 */
  cleanup: () => void;
  /** 获取资源统计 */
  getResourceStats: () => {
    total: number;
    byType: Record<string, number>;
    resources: Array<{ type: string; description?: string }>;
  };
}

/**
 * 资源清理Hook
 */
export function useResourceCleanup(): UseResourceCleanupReturn {
  const cleanupFunctions = useRef<ResourceCleanup[]>([]);

  /**
   * 添加清理函数
   */
  const addCleanup = useCallback((
    cleanup: () => void, 
    type: ResourceCleanup['type'] = 'other',
    description?: string
  ) => {
    cleanupFunctions.current.push({
      cleanup,
      type,
      description,
    });
  }, []);

  /**
   * 执行所有清理
   */
  const cleanup = useCallback(() => {
    cleanupFunctions.current.forEach(({ cleanup, type, description }) => {
      try {
        cleanup();
      } catch (error) {
        console.warn(`Cleanup function failed for ${type}${description ? ` (${description})` : ''}:`, error);
      }
    });
    cleanupFunctions.current = [];
  }, []);

  /**
   * 获取资源统计
   */
  const getResourceStats = useCallback(() => {
    const byType: Record<string, number> = {};
    const resources: Array<{ type: string; description?: string }> = [];

    cleanupFunctions.current.forEach(({ type, description }) => {
      byType[type] = (byType[type] || 0) + 1;
      resources.push({ type, description });
    });

    return {
      total: cleanupFunctions.current.length,
      byType,
      resources,
    };
  }, []);

  // 组件卸载时自动清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    addCleanup,
    cleanup,
    getResourceStats,
  };
}

/**
 * 定时器管理Hook
 */
export function useTimerManager() {
  const { addCleanup } = useResourceCleanup();

  /**
   * 创建定时器
   */
  const createTimer = useCallback((
    callback: () => void,
    delay: number,
    description?: string
  ): NodeJS.Timeout => {
    const timer = setTimeout(callback, delay);
    addCleanup(
      () => clearTimeout(timer),
      'timer',
      description || `Timer (${delay}ms)`
    );
    return timer;
  }, [addCleanup]);

  /**
   * 创建间隔定时器
   */
  const createInterval = useCallback((
    callback: () => void,
    interval: number,
    description?: string
  ): NodeJS.Timeout => {
    const timer = setInterval(callback, interval);
    addCleanup(
      () => clearInterval(timer),
      'timer',
      description || `Interval (${interval}ms)`
    );
    return timer;
  }, [addCleanup]);

  return {
    createTimer,
    createInterval,
  };
}

/**
 * 事件监听器管理Hook
 */
export function useEventListenerManager() {
  const { addCleanup } = useResourceCleanup();

  /**
   * 添加事件监听器
   */
  const addEventListener = useCallback((
    target: EventTarget,
    event: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
    description?: string
  ) => {
    target.addEventListener(event, listener, options);
    addCleanup(
      () => target.removeEventListener(event, listener, options),
      'listener',
      description || `${event} listener`
    );
  }, [addCleanup]);

  /**
   * 添加窗口事件监听器
   */
  const addWindowListener = useCallback((
    event: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
    description?: string
  ) => {
    addEventListener(window, event, listener, options, description);
  }, [addEventListener]);

  /**
   * 添加文档事件监听器
   */
  const addDocumentListener = useCallback((
    event: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
    description?: string
  ) => {
    addEventListener(document, event, listener, options, description);
  }, [addEventListener]);

  return {
    addEventListener,
    addWindowListener,
    addDocumentListener,
  };
}

/**
 * 订阅管理Hook
 */
export function useSubscriptionManager() {
  const { addCleanup } = useResourceCleanup();

  /**
   * 创建订阅
   */
  const createSubscription = useCallback((
    subscribe: (callback: () => void) => () => void,
    description?: string
  ) => {
    let unsubscribe: (() => void) | null = null;
    
    const cleanup = () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    // 立即订阅
    unsubscribe = subscribe(cleanup);

    addCleanup(
      cleanup,
      'subscription',
      description || 'Subscription'
    );

    return cleanup;
  }, [addCleanup]);

  return {
    createSubscription,
  };
}

/**
 * 连接管理Hook
 */
export function useConnectionManager() {
  const { addCleanup } = useResourceCleanup();

  /**
   * 创建连接
   */
  const createConnection = useCallback((
    connect: () => () => void,
    description?: string
  ) => {
    const disconnect = connect();
    
    addCleanup(
      disconnect,
      'connection',
      description || 'Connection'
    );

    return disconnect;
  }, [addCleanup]);

  return {
    createConnection,
  };
}

/**
 * 内存使用监控Hook
 */
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null>(null);

  const { createInterval } = useTimerManager();

  useEffect(() => {
    // 检查是否支持performance.memory
    if (!('memory' in performance)) {
      console.warn('performance.memory is not supported');
      return;
    }

    const updateMemoryInfo = () => {
      const memory = (performance as any).memory;
      setMemoryInfo({
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      });
    };

    // 立即更新一次
    updateMemoryInfo();

    // 每5秒更新一次
    createInterval(updateMemoryInfo, 5000, 'Memory monitor');
  }, [createInterval]);

  return {
    memoryInfo,
    getMemoryUsagePercentage: () => {
      if (!memoryInfo) return 0;
      return (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
    },
    getMemoryUsageMB: () => {
      if (!memoryInfo) return 0;
      return memoryInfo.usedJSHeapSize / (1024 * 1024);
    },
  };
}
