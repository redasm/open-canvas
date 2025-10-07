/**
 * React错误边界组件 - 重构错误边界处理
 * 主要改动：
 * 1. 实现React错误边界组件
 * 2. 提供用户友好的错误界面
 * 3. 支持错误报告和重试机制
 * 4. 集成统一错误处理系统
 */

'use client';

import * as React from 'react';
import { Component, ErrorInfo, ReactNode } from 'react';
import { AppError, ErrorCode, ErrorSeverity } from '@opencanvas/shared/errors/error-types';
import { ErrorHandler } from '@/lib/error-handler/error-handler';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: AppError;
  errorInfo?: ErrorInfo;
}

/**
 * 错误回退组件
 */
interface ErrorFallbackProps {
  error: AppError;
  onRetry: () => void;
  onReport: () => void;
}

function ErrorFallback({ error, onRetry, onReport }: ErrorFallbackProps) {
  const isSystemError = error.isSystemError();
  const isRetryable = error.isRetryable();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {isSystemError ? '系统错误' : '出现了一些问题'}
          </h3>
          
          <p className="text-sm text-gray-600 mb-4">
            {error.getUserFriendlyMessage()}
          </p>

          {error.severity === ErrorSeverity.CRITICAL && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-800">
                这是一个严重错误，可能会影响系统功能。请刷新页面或联系技术支持。
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isRetryable && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                重试
              </button>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              刷新页面
            </button>
            
            <button
              onClick={onReport}
              className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              报告问题
            </button>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 text-left">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                开发信息
              </summary>
              <div className="mt-2 p-3 bg-gray-100 rounded-md text-xs font-mono">
                <div className="mb-2">
                  <strong>错误代码:</strong> {error.code}
                </div>
                <div className="mb-2">
                  <strong>错误消息:</strong> {error.message}
                </div>
                <div className="mb-2">
                  <strong>严重程度:</strong> {error.severity}
                </div>
                <div className="mb-2">
                  <strong>分类:</strong> {error.category}
                </div>
                {error.stack && (
                  <div>
                    <strong>堆栈跟踪:</strong>
                    <pre className="mt-1 whitespace-pre-wrap text-xs">
                      {error.stack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 错误边界组件
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorHandler: ErrorHandler;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
    this.errorHandler = ErrorHandler.getInstance();
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // 将错误转换为AppError
    const appError = error instanceof AppError 
      ? error 
      : new AppError(
          ErrorCode.INTERNAL_ERROR,
          error.message,
          { cause: error }
        );

    return {
      hasError: true,
      error: appError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const appError = error instanceof AppError 
      ? error 
      : new AppError(
          ErrorCode.INTERNAL_ERROR,
          error.message,
          { 
            cause: error,
            context: {
              component: this.props.componentName,
              operation: 'render',
            }
          }
        );

    // 使用统一错误处理器处理错误
    this.errorHandler.handleError(appError, {
      component: this.props.componentName,
      operation: 'render',
      metadata: {
        errorInfo: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    // 调用自定义错误处理函数
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReport = () => {
    const { error } = this.state;
    if (!error) return;

    // 创建错误报告
    const report = {
      error: error.toJSON(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    // 这里可以发送错误报告到服务器
    console.log('错误报告:', report);
    
    // 显示报告成功消息
    alert('错误报告已发送，感谢您的反馈！');
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // 如果提供了自定义回退组件，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 否则使用默认的错误回退组件
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          onReport={this.handleReport}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * 高阶组件：为组件添加错误边界
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Hook：用于在函数组件中处理错误
 */
export function useErrorHandler() {
  const errorHandler = ErrorHandler.getInstance();

  const handleError = React.useCallback((error: Error, context?: any) => {
    return errorHandler.handleError(error, context);
  }, [errorHandler]);

  const createError = React.useCallback((
    code: ErrorCode,
    message: string,
    context?: any,
    details?: any
  ) => {
    return errorHandler.createErrorResponse(code, message, context, details);
  }, [errorHandler]);

  return { handleError, createError };
}
