/**
 * 性能优化Hook - 实现代码分割和懒加载
 * 主要功能：
 * 1. 动态导入重型组件
 * 2. 实现组件级懒加载
 * 3. 优化内存使用
 * 4. 提供性能监控
 */

'use client';

import * as React from 'react';
import { lazy, Suspense, useCallback, useMemo, useRef, useEffect } from 'react';
import { useResourceCleanup } from './use-resource-cleanup';

/**
 * 动态导入组件Hook
 */
export function useDynamicImport<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) {
  const [Component, setComponent] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadComponent = useCallback(async () => {
    if (Component) return Component;

    setLoading(true);
    setError(null);

    try {
      const module = await importFn();
      setComponent(() => module.default);
      return module.default;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load component');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [Component, importFn]);

  return {
    Component: Component || fallback || null,
    loading,
    error,
    loadComponent,
  };
}

/**
 * 懒加载组件包装器
 */
export function LazyComponent<T extends React.ComponentType<any>>({
  importFn,
  fallback,
  ...props
}: {
  importFn: () => Promise<{ default: T }>;
  fallback?: React.ComponentType;
} & React.ComponentProps<T>) {
  const LazyComponent = useMemo(() => lazy(importFn), [importFn]);

  return (
    <Suspense fallback={fallback ? <fallback /> : <div>Loading...</div>}>
      <LazyComponent {...props} />
    </Suspense>
  );
}

/**
 * 性能监控Hook
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const mountTime = useRef<number>();
  const { addCleanup } = useResourceCleanup();

  useEffect(() => {
    mountTime.current = performance.now();
    renderCount.current = 0;

    return () => {
      if (mountTime.current) {
        const unmountTime = performance.now();
        const totalTime = unmountTime - mountTime.current;
        console.log(`📊 ${componentName} 性能统计:`, {
          renderCount: renderCount.current,
          totalTime: `${totalTime.toFixed(2)}ms`,
          avgRenderTime: `${(totalTime / renderCount.current).toFixed(2)}ms`,
        });
      }
    };
  }, [componentName]);

  useEffect(() => {
    renderCount.current++;
  });

  return {
    renderCount: renderCount.current,
    mountTime: mountTime.current,
  };
}

/**
 * 内存使用监控Hook
 */
export function useMemoryMonitor() {
  const { addCleanup } = useResourceCleanup();

  useEffect(() => {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return;
    }

    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        console.log('🧠 内存使用情况:', {
          used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
          total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
          limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`,
        });
      }
    };

    const interval = setInterval(checkMemory, 30000); // 每30秒检查一次
    addCleanup(() => clearInterval(interval));

    return () => clearInterval(interval);
  }, [addCleanup]);
}

/**
 * 防抖Hook
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 节流Hook
 */
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef<number>(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);

  return throttledValue;
}
