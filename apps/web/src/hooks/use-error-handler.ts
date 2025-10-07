/**
 * 错误处理Hook - 重构客户端错误处理
 * 主要改动：
 * 1. 提供统一的错误处理Hook
 * 2. 集成Toast通知系统
 * 3. 支持异步操作错误处理
 * 4. 提供错误重试机制
 */

'use client';

import * as React from 'react';
import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ErrorHandler } from '@/lib/error-handler/error-handler';
import { AppError, ErrorCode, ErrorContext } from '@opencanvas/shared/errors/error-types';

export interface UseErrorHandlerReturn {
  handleError: (error: Error, context?: ErrorContext) => Promise<void>;
  handleAsync: <T>(
    asyncFn: () => Promise<T>,
    context?: ErrorContext
  ) => Promise<T | null>;
  createError: (
    code: ErrorCode,
    message: string,
    context?: ErrorContext,
    details?: any
  ) => AppError;
  isRetryable: (error: Error) => boolean;
}

/**
 * 错误处理Hook
 */
export function useErrorHandler(): UseErrorHandlerReturn {
  const { toast } = useToast();
  const errorHandler = ErrorHandler.getInstance();

  // 初始化Toast通知器
  React.useEffect(() => {
    const notifier = errorHandler['errorNotifier'];
    if (notifier && typeof notifier.setToast === 'function') {
      notifier.setToast(toast);
    }
  }, [toast, errorHandler]);

  /**
   * 处理错误
   */
  const handleError = useCallback(async (
    error: Error, 
    context?: ErrorContext
  ) => {
    try {
      const errorResponse = await errorHandler.handleError(error, context);
      
      // 如果错误处理器没有显示通知，我们在这里显示
      if (!errorResponse.userMessage) {
        toast({
          title: '操作失败',
          description: errorResponse.userMessage,
          variant: 'destructive',
          duration: 5000,
        });
      }
    } catch (handlerError) {
      // 如果错误处理器本身出错，显示通用错误消息
      console.error('Error handler failed:', handlerError);
      toast({
        title: '系统错误',
        description: '处理错误时发生问题，请稍后重试',
        variant: 'destructive',
        duration: 5000,
      });
    }
  }, [toast, errorHandler]);

  /**
   * 处理异步操作
   */
  const handleAsync = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    context?: ErrorContext
  ): Promise<T | null> => {
    try {
      return await asyncFn();
    } catch (error) {
      await handleError(error as Error, context);
      return null;
    }
  }, [handleError]);

  /**
   * 创建错误
   */
  const createError = useCallback((
    code: ErrorCode,
    message: string,
    context?: ErrorContext,
    details?: any
  ): AppError => {
    return new AppError(code, message, { context, details });
  }, []);

  /**
   * 检查错误是否可重试
   */
  const isRetryable = useCallback((error: Error): boolean => {
    if (error instanceof AppError) {
      return error.isRetryable();
    }
    
    // 对于非AppError，根据错误类型判断
    const errorMessage = error.message.toLowerCase();
    const retryablePatterns = [
      'network',
      'timeout',
      'connection',
      'temporary',
      'unavailable',
      'rate limit',
    ];
    
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }, []);

  return {
    handleError,
    handleAsync,
    createError,
    isRetryable,
  };
}

/**
 * 带重试的异步操作Hook
 */
export function useAsyncWithRetry<T>(
  asyncFn: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
) {
  const { handleError, isRetryable } = useErrorHandler();
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);

  const execute = useCallback(async (context?: ErrorContext) => {
    setLoading(true);
    setError(null);
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await asyncFn();
        setData(result);
        setRetryCount(0);
        setLoading(false);
        return result;
      } catch (err) {
        lastError = err as Error;
        setError(lastError);
        
        // 如果是最后一次尝试或错误不可重试，停止重试
        if (attempt === maxRetries || !isRetryable(lastError)) {
          await handleError(lastError, context);
          setLoading(false);
          return null;
        }
        
        // 等待后重试
        setRetryCount(attempt + 1);
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }
    
    setLoading(false);
    return null;
  }, [asyncFn, maxRetries, retryDelay, isRetryable, handleError]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setRetryCount(0);
  }, []);

  return {
    data,
    loading,
    error,
    retryCount,
    execute,
    reset,
  };
}

/**
 * 表单错误处理Hook
 */
export function useFormErrorHandler() {
  const { handleError, createError } = useErrorHandler();
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);

  const setFieldError = useCallback((field: string, message: string) => {
    setFieldErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
    setGeneralError(null);
  }, []);

  const handleFormError = useCallback(async (
    error: Error,
    context?: ErrorContext
  ) => {
    await handleError(error, context);
    
    // 如果是验证错误，尝试提取字段错误
    if (error instanceof AppError && error.code === ErrorCode.VALIDATION_ERROR) {
      const details = error.details;
      if (details && typeof details === 'object' && 'fieldErrors' in details) {
        setFieldErrors(details.fieldErrors as Record<string, string>);
      } else {
        setGeneralError(error.getUserFriendlyMessage());
      }
    } else {
      setGeneralError(error instanceof AppError ? error.getUserFriendlyMessage() : error.message);
    }
  }, [handleError]);

  const createValidationError = useCallback((
    field: string,
    message: string
  ) => {
    return createError(
      ErrorCode.VALIDATION_ERROR,
      message,
      { operation: 'form_validation' },
      { field, fieldErrors: { [field]: message } }
    );
  }, [createError]);

  return {
    fieldErrors,
    generalError,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    handleFormError,
    createValidationError,
  };
}
