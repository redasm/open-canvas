/**
 * 现代化React特性Hook - 使用最新React特性
 * 主要功能：
 * 1. 使用useTransition优化用户体验
 * 2. 使用useDeferredValue优化性能
 * 3. 使用useId生成唯一ID
 * 4. 使用useSyncExternalStore管理外部状态
 */

'use client';

import { 
  useTransition, 
  useDeferredValue, 
  useId, 
  useSyncExternalStore,
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef
} from 'react';

/**
 * 使用useTransition优化用户体验
 */
export function useOptimizedState<T>(initialState: T) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState(initialState);

  const setOptimizedState = useCallback((newState: T | ((prev: T) => T)) => {
    startTransition(() => {
      setState(newState);
    });
  }, [startTransition]);

  return {
    state,
    setState: setOptimizedState,
    isPending,
  };
}

/**
 * 使用useDeferredValue优化搜索性能
 */
export function useOptimizedSearch<T>(
  items: T[],
  searchFn: (item: T, query: string) => boolean
) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const filteredItems = useMemo(() => {
    if (!deferredQuery.trim()) {
      return items;
    }

    return items.filter(item => searchFn(item, deferredQuery));
  }, [items, deferredQuery, searchFn]);

  const isStale = query !== deferredQuery;

  return {
    query,
    setQuery,
    filteredItems,
    isStale,
  };
}

/**
 * 使用useId生成唯一ID
 */
export function useUniqueId(prefix?: string): string {
  const id = useId();
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * 使用useSyncExternalStore管理外部状态
 */
export function useExternalStore<T>(
  subscribe: (callback: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T
): T {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
}

/**
 * 使用useCallback优化函数引用
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
}

/**
 * 使用useMemo优化计算
 */
export function useStableMemo<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(factory, deps);
}

/**
 * 使用useRef管理可变值
 */
export function useStableRef<T>(initialValue: T) {
  const ref = useRef<T>(initialValue);
  return ref;
}

/**
 * 使用useEffect优化副作用
 */
export function useOptimizedEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList
) {
  useEffect(effect, deps);
}

/**
 * 组合Hook：优化列表渲染
 */
export function useOptimizedList<T>(
  items: T[],
  keyExtractor: (item: T) => string,
  searchFn?: (item: T, query: string) => boolean
) {
  const { query, setQuery, filteredItems, isStale } = useOptimizedSearch(
    items,
    searchFn || ((item: T, query: string) => 
      JSON.stringify(item).toLowerCase().includes(query.toLowerCase())
    )
  );

  const memoizedItems = useStableMemo(() => filteredItems, [filteredItems]);

  return {
    items: memoizedItems,
    query,
    setQuery,
    isStale,
    keyExtractor,
  };
}

/**
 * 组合Hook：优化表单状态
 */
export function useOptimizedForm<T extends Record<string, any>>(
  initialData: T,
  validationRules?: Record<string, (value: any) => string | null>
) {
  const { state: data, setState: setData, isPending } = useOptimizedState(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback((fieldName?: string) => {
    if (!validationRules) return true;

    const newErrors: Record<string, string> = {};
    const fieldsToValidate = fieldName ? [fieldName] : Object.keys(validationRules);

    fieldsToValidate.forEach(field => {
      const rule = validationRules[field];
      if (rule) {
        const error = rule(data[field]);
        if (error) {
          newErrors[field] = error;
        }
      }
    });

    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  }, [data, validationRules]);

  const setField = useCallback((fieldName: keyof T, value: T[keyof T]) => {
    setData(prev => ({ ...prev, [fieldName]: value }));
    
    // 清除该字段的错误
    if (errors[fieldName as string]) {
      setErrors(prev => ({ ...prev, [fieldName as string]: '' }));
    }
  }, [setData, errors]);

  const setFieldWithValidation = useCallback((fieldName: keyof T, value: T[keyof T]) => {
    setField(fieldName, value);
    validate(fieldName as string);
  }, [setField, validate]);

  return {
    data,
    setData,
    setField,
    setFieldWithValidation,
    errors,
    validate,
    isPending,
    isValid: Object.keys(errors).length === 0,
  };
}
