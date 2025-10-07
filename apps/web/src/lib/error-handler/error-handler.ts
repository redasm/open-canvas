/**
 * 统一错误处理器 - 重构错误处理逻辑
 * 主要改动：
 * 1. 实现统一的错误处理逻辑
 * 2. 支持错误日志记录和通知
 * 3. 提供用户友好的错误消息
 * 4. 支持错误恢复和重试机制
 */

import { AppError, ErrorCode, ErrorSeverity, ErrorContext } from '@opencanvas/shared/errors/error-types';

export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  userMessage: string;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: ErrorContext;
  details?: any;
  retryable: boolean;
}

export interface ErrorLogger {
  log(error: AppError, context?: ErrorContext): Promise<void>;
}

export interface ErrorNotifier {
  notify(message: string, code: ErrorCode, severity: ErrorSeverity): void;
}

/**
 * 控制台错误日志记录器
 */
export class ConsoleErrorLogger implements ErrorLogger {
  async log(error: AppError, context?: ErrorContext): Promise<void> {
    const logData = {
      error: error.toJSON(),
      context,
      timestamp: new Date().toISOString(),
    };

    // 根据严重程度选择日志级别
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        console.error('🚨 严重错误:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('⚠️  警告:', logData);
        break;
      case ErrorSeverity.LOW:
        console.info('ℹ️  信息:', logData);
        break;
      default:
        console.log('📝 日志:', logData);
    }
  }
}

/**
 * Toast通知器
 */
export class ToastErrorNotifier implements ErrorNotifier {
  private toast?: any; // Toast实例，将在运行时注入

  setToast(toast: any): void {
    this.toast = toast;
  }

  notify(message: string, code: ErrorCode, severity: ErrorSeverity): void {
    if (!this.toast) {
      console.warn('Toast notifier not initialized');
      return;
    }

    // 根据严重程度选择通知类型
    const variant = severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH 
      ? 'destructive' 
      : 'default';

    this.toast({
      title: this.getNotificationTitle(severity),
      description: message,
      variant,
      duration: this.getNotificationDuration(severity),
    });
  }

  private getNotificationTitle(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return '系统错误';
      case ErrorSeverity.HIGH:
        return '操作失败';
      case ErrorSeverity.MEDIUM:
        return '警告';
      case ErrorSeverity.LOW:
        return '提示';
      default:
        return '通知';
    }
  }

  private getNotificationDuration(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 8000; // 8秒
      case ErrorSeverity.MEDIUM:
        return 5000; // 5秒
      case ErrorSeverity.LOW:
        return 3000; // 3秒
      default:
        return 4000; // 4秒
    }
  }
}

/**
 * 统一错误处理器
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLogger: ErrorLogger;
  private errorNotifier: ErrorNotifier;
  private errorCounts: Map<ErrorCode, number> = new Map();
  private lastErrorTime: Map<ErrorCode, Date> = new Map();

  private constructor() {
    this.errorLogger = new ConsoleErrorLogger();
    this.errorNotifier = new ToastErrorNotifier();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 设置错误日志记录器
   */
  setErrorLogger(logger: ErrorLogger): void {
    this.errorLogger = logger;
  }

  /**
   * 设置错误通知器
   */
  setErrorNotifier(notifier: ErrorNotifier): void {
    this.errorNotifier = notifier;
  }

  /**
   * 处理错误
   */
  async handleError(error: Error, context?: ErrorContext): Promise<ErrorResponse> {
    const appError = this.normalizeError(error, context);
    
    // 记录错误
    await this.errorLogger.log(appError, context);
    
    // 更新错误统计
    this.updateErrorStats(appError);
    
    // 通知用户（如果不是用户输入错误）
    if (!appError.isUserInputError()) {
      const userMessage = appError.getUserFriendlyMessage();
      this.errorNotifier.notify(userMessage, appError.code, appError.severity);
    }
    
    // 返回标准错误响应
    return {
      code: appError.code,
      message: appError.message,
      userMessage: appError.getUserFriendlyMessage(),
      severity: appError.severity,
      timestamp: appError.timestamp,
      context: appError.context,
      details: appError.details,
      retryable: appError.isRetryable(),
    };
  }

  /**
   * 规范化错误
   */
  private normalizeError(error: Error, context?: ErrorContext): AppError {
    if (error instanceof AppError) {
      return error;
    }

    // 根据错误类型映射到标准错误代码
    const errorCode = this.mapErrorToCode(error);
    
    return new AppError(
      errorCode,
      error.message,
      {
        context,
        cause: error,
      }
    );
  }

  /**
   * 映射错误到错误代码
   */
  private mapErrorToCode(error: Error): ErrorCode {
    const errorName = error.name.toLowerCase();
    const errorMessage = error.message.toLowerCase();

    // 网络错误
    if (errorName.includes('network') || errorMessage.includes('network')) {
      return ErrorCode.NETWORK_ERROR;
    }
    
    if (errorMessage.includes('timeout')) {
      return ErrorCode.TIMEOUT_ERROR;
    }
    
    if (errorMessage.includes('connection refused')) {
      return ErrorCode.CONNECTION_REFUSED;
    }
    
    if (errorMessage.includes('dns')) {
      return ErrorCode.DNS_RESOLUTION_FAILED;
    }

    // 数据库错误
    if (errorName.includes('database') || errorMessage.includes('database')) {
      return ErrorCode.DATABASE_CONNECTION_ERROR;
    }
    
    if (errorMessage.includes('query failed')) {
      return ErrorCode.DATABASE_QUERY_FAILED;
    }
    
    if (errorMessage.includes('record not found')) {
      return ErrorCode.RECORD_NOT_FOUND;
    }
    
    if (errorMessage.includes('duplicate')) {
      return ErrorCode.DUPLICATE_RECORD;
    }

    // 文件错误
    if (errorMessage.includes('file not found')) {
      return ErrorCode.FILE_NOT_FOUND;
    }
    
    if (errorMessage.includes('file read')) {
      return ErrorCode.FILE_READ_ERROR;
    }
    
    if (errorMessage.includes('file write')) {
      return ErrorCode.FILE_WRITE_ERROR;
    }
    
    if (errorMessage.includes('file size')) {
      return ErrorCode.FILE_SIZE_EXCEEDED;
    }

    // 验证错误
    if (errorName.includes('validation') || errorMessage.includes('validation')) {
      return ErrorCode.VALIDATION_ERROR;
    }
    
    if (errorMessage.includes('invalid input')) {
      return ErrorCode.INVALID_INPUT;
    }
    
    if (errorMessage.includes('missing required')) {
      return ErrorCode.MISSING_REQUIRED_FIELD;
    }
    
    if (errorMessage.includes('invalid format')) {
      return ErrorCode.INVALID_FORMAT;
    }

    // 认证错误
    if (errorMessage.includes('unauthorized')) {
      return ErrorCode.UNAUTHORIZED;
    }
    
    if (errorMessage.includes('forbidden')) {
      return ErrorCode.FORBIDDEN;
    }
    
    if (errorMessage.includes('token expired')) {
      return ErrorCode.TOKEN_EXPIRED;
    }
    
    if (errorMessage.includes('invalid credentials')) {
      return ErrorCode.INVALID_CREDENTIALS;
    }

    // 模型错误
    if (errorMessage.includes('model not found')) {
      return ErrorCode.MODEL_NOT_FOUND;
    }
    
    if (errorMessage.includes('model invocation')) {
      return ErrorCode.MODEL_INVOCATION_FAILED;
    }
    
    if (errorMessage.includes('provider not found')) {
      return ErrorCode.PROVIDER_NOT_FOUND;
    }
    
    if (errorMessage.includes('rate limit')) {
      return ErrorCode.MODEL_RATE_LIMITED;
    }

    // 智能体错误
    if (errorMessage.includes('assistant not found')) {
      return ErrorCode.ASSISTANT_NOT_FOUND;
    }
    
    if (errorMessage.includes('assistant creation')) {
      return ErrorCode.ASSISTANT_CREATION_FAILED;
    }
    
    if (errorMessage.includes('assistant update')) {
      return ErrorCode.ASSISTANT_UPDATE_FAILED;
    }
    
    if (errorMessage.includes('duplicate assistant')) {
      return ErrorCode.DUPLICATE_ASSISTANT_NAME;
    }

    // 默认系统错误
    return ErrorCode.INTERNAL_ERROR;
  }

  /**
   * 更新错误统计
   */
  private updateErrorStats(error: AppError): void {
    const count = this.errorCounts.get(error.code) || 0;
    this.errorCounts.set(error.code, count + 1);
    this.lastErrorTime.set(error.code, error.timestamp);
  }

  /**
   * 获取错误统计信息
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByCode: Record<ErrorCode, number>;
    lastErrorTimes: Record<ErrorCode, Date>;
  } {
    const errorsByCode: Record<ErrorCode, number> = {};
    const lastErrorTimes: Record<ErrorCode, Date> = {};
    
    this.errorCounts.forEach((count, code) => {
      errorsByCode[code] = count;
    });
    
    this.lastErrorTime.forEach((time, code) => {
      lastErrorTimes[code] = time;
    });

    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      errorsByCode,
      lastErrorTimes,
    };
  }

  /**
   * 清除错误统计
   */
  clearErrorStats(): void {
    this.errorCounts.clear();
    this.lastErrorTime.clear();
  }

  /**
   * 检查错误频率
   */
  isErrorRateHigh(code: ErrorCode, threshold: number = 10, timeWindowMs: number = 60000): boolean {
    const count = this.errorCounts.get(code) || 0;
    const lastTime = this.lastErrorTime.get(code);
    
    if (!lastTime) {
      return false;
    }
    
    const timeSinceLastError = Date.now() - lastTime.getTime();
    
    return count >= threshold && timeSinceLastError < timeWindowMs;
  }

  /**
   * 创建错误响应
   */
  createErrorResponse(
    code: ErrorCode,
    message: string,
    context?: ErrorContext,
    details?: any
  ): ErrorResponse {
    const appError = new AppError(code, message, { context, details });
    
    return {
      code: appError.code,
      message: appError.message,
      userMessage: appError.getUserFriendlyMessage(),
      severity: appError.severity,
      timestamp: appError.timestamp,
      context: appError.context,
      details: appError.details,
      retryable: appError.isRetryable(),
    };
  }
}
