/**
 * 统一错误处理系统重构 - 错误类型定义
 * 主要改动：
 * 1. 定义标准化的错误代码枚举
 * 2. 创建统一的错误类
 * 3. 提供错误上下文和详细信息
 * 4. 支持错误分类和优先级
 */

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // 认证错误
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // 模型错误
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  MODEL_INVOCATION_FAILED = 'MODEL_INVOCATION_FAILED',
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  UNSUPPORTED_PROVIDER = 'UNSUPPORTED_PROVIDER',
  MODEL_RATE_LIMITED = 'MODEL_RATE_LIMITED',
  MODEL_TIMEOUT = 'MODEL_TIMEOUT',
  
  // 智能体错误
  ASSISTANT_NOT_FOUND = 'ASSISTANT_NOT_FOUND',
  ASSISTANT_CREATION_FAILED = 'ASSISTANT_CREATION_FAILED',
  ASSISTANT_UPDATE_FAILED = 'ASSISTANT_UPDATE_FAILED',
  ASSISTANT_DELETION_FAILED = 'ASSISTANT_DELETION_FAILED',
  INVALID_ASSISTANT_CONFIG = 'INVALID_ASSISTANT_CONFIG',
  DUPLICATE_ASSISTANT_NAME = 'DUPLICATE_ASSISTANT_NAME',
  
  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  DNS_RESOLUTION_FAILED = 'DNS_RESOLUTION_FAILED',
  
  // 验证错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // 数据库错误
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  DUPLICATE_RECORD = 'DUPLICATE_RECORD',
  
  // 文件错误
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  FILE_SIZE_EXCEEDED = 'FILE_SIZE_EXCEEDED',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',
  
  // 系统错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  INVALID_CONFIG = 'INVALID_CONFIG',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * 错误分类
 */
export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  FILE_SYSTEM = 'FILE_SYSTEM',
  MODEL = 'MODEL',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM',
  USER_INPUT = 'USER_INPUT',
}

/**
 * 错误上下文接口
 */
export interface ErrorContext {
  /** 用户ID */
  userId?: string;
  /** 请求ID */
  requestId?: string;
  /** 组件名称 */
  component?: string;
  /** 操作名称 */
  operation?: string;
  /** 额外上下文数据 */
  metadata?: Record<string, any>;
}

/**
 * 应用错误类
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly timestamp: Date;
  public readonly context?: ErrorContext;
  public readonly details?: any;
  public readonly stack?: string;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      context?: ErrorContext;
      details?: any;
      cause?: Error;
    } = {}
  ) {
    super(message);
    
    this.name = 'AppError';
    this.code = code;
    this.severity = options.severity || this.getDefaultSeverity(code);
    this.category = options.category || this.getDefaultCategory(code);
    this.timestamp = new Date();
    this.context = options.context;
    this.details = options.details;
    
    // 保持原始错误堆栈
    if (options.cause) {
      this.stack = options.cause.stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 获取默认严重程度
   */
  private getDefaultSeverity(code: ErrorCode): ErrorSeverity {
    const severityMap: Record<ErrorCode, ErrorSeverity> = {
      [ErrorCode.UNAUTHORIZED]: ErrorSeverity.MEDIUM,
      [ErrorCode.FORBIDDEN]: ErrorSeverity.MEDIUM,
      [ErrorCode.TOKEN_EXPIRED]: ErrorSeverity.MEDIUM,
      [ErrorCode.INVALID_CREDENTIALS]: ErrorSeverity.MEDIUM,
      
      [ErrorCode.MODEL_NOT_FOUND]: ErrorSeverity.HIGH,
      [ErrorCode.MODEL_INVOCATION_FAILED]: ErrorSeverity.HIGH,
      [ErrorCode.PROVIDER_NOT_FOUND]: ErrorSeverity.HIGH,
      [ErrorCode.UNSUPPORTED_PROVIDER]: ErrorSeverity.HIGH,
      [ErrorCode.MODEL_RATE_LIMITED]: ErrorSeverity.MEDIUM,
      [ErrorCode.MODEL_TIMEOUT]: ErrorSeverity.MEDIUM,
      
      [ErrorCode.ASSISTANT_NOT_FOUND]: ErrorSeverity.MEDIUM,
      [ErrorCode.ASSISTANT_CREATION_FAILED]: ErrorSeverity.HIGH,
      [ErrorCode.ASSISTANT_UPDATE_FAILED]: ErrorSeverity.HIGH,
      [ErrorCode.ASSISTANT_DELETION_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorCode.INVALID_ASSISTANT_CONFIG]: ErrorSeverity.MEDIUM,
      [ErrorCode.DUPLICATE_ASSISTANT_NAME]: ErrorSeverity.LOW,
      
      [ErrorCode.NETWORK_ERROR]: ErrorSeverity.HIGH,
      [ErrorCode.TIMEOUT_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorCode.CONNECTION_REFUSED]: ErrorSeverity.HIGH,
      [ErrorCode.DNS_RESOLUTION_FAILED]: ErrorSeverity.HIGH,
      
      [ErrorCode.VALIDATION_ERROR]: ErrorSeverity.LOW,
      [ErrorCode.INVALID_INPUT]: ErrorSeverity.LOW,
      [ErrorCode.MISSING_REQUIRED_FIELD]: ErrorSeverity.LOW,
      [ErrorCode.INVALID_FORMAT]: ErrorSeverity.LOW,
      
      [ErrorCode.DATABASE_CONNECTION_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorCode.DATABASE_QUERY_FAILED]: ErrorSeverity.HIGH,
      [ErrorCode.RECORD_NOT_FOUND]: ErrorSeverity.MEDIUM,
      [ErrorCode.DUPLICATE_RECORD]: ErrorSeverity.MEDIUM,
      
      [ErrorCode.FILE_NOT_FOUND]: ErrorSeverity.MEDIUM,
      [ErrorCode.FILE_READ_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorCode.FILE_WRITE_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorCode.FILE_SIZE_EXCEEDED]: ErrorSeverity.LOW,
      [ErrorCode.UNSUPPORTED_FILE_TYPE]: ErrorSeverity.LOW,
      
      [ErrorCode.INTERNAL_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorCode.SERVICE_UNAVAILABLE]: ErrorSeverity.CRITICAL,
      [ErrorCode.CONFIGURATION_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorCode.INVALID_CONFIG]: ErrorSeverity.HIGH,
      [ErrorCode.RESOURCE_EXHAUSTED]: ErrorSeverity.HIGH,
    };

    return severityMap[code] || ErrorSeverity.MEDIUM;
  }

  /**
   * 获取默认分类
   */
  private getDefaultCategory(code: ErrorCode): ErrorCategory {
    const categoryMap: Record<ErrorCode, ErrorCategory> = {
      [ErrorCode.UNAUTHORIZED]: ErrorCategory.AUTHENTICATION,
      [ErrorCode.FORBIDDEN]: ErrorCategory.AUTHORIZATION,
      [ErrorCode.TOKEN_EXPIRED]: ErrorCategory.AUTHENTICATION,
      [ErrorCode.INVALID_CREDENTIALS]: ErrorCategory.AUTHENTICATION,
      
      [ErrorCode.MODEL_NOT_FOUND]: ErrorCategory.MODEL,
      [ErrorCode.MODEL_INVOCATION_FAILED]: ErrorCategory.MODEL,
      [ErrorCode.PROVIDER_NOT_FOUND]: ErrorCategory.MODEL,
      [ErrorCode.UNSUPPORTED_PROVIDER]: ErrorCategory.MODEL,
      [ErrorCode.MODEL_RATE_LIMITED]: ErrorCategory.MODEL,
      [ErrorCode.MODEL_TIMEOUT]: ErrorCategory.MODEL,
      
      [ErrorCode.ASSISTANT_NOT_FOUND]: ErrorCategory.ASSISTANT,
      [ErrorCode.ASSISTANT_CREATION_FAILED]: ErrorCategory.ASSISTANT,
      [ErrorCode.ASSISTANT_UPDATE_FAILED]: ErrorCategory.ASSISTANT,
      [ErrorCode.ASSISTANT_DELETION_FAILED]: ErrorCategory.ASSISTANT,
      [ErrorCode.INVALID_ASSISTANT_CONFIG]: ErrorCategory.ASSISTANT,
      [ErrorCode.DUPLICATE_ASSISTANT_NAME]: ErrorCategory.ASSISTANT,
      
      [ErrorCode.NETWORK_ERROR]: ErrorCategory.NETWORK,
      [ErrorCode.TIMEOUT_ERROR]: ErrorCategory.NETWORK,
      [ErrorCode.CONNECTION_REFUSED]: ErrorCategory.NETWORK,
      [ErrorCode.DNS_RESOLUTION_FAILED]: ErrorCategory.NETWORK,
      
      [ErrorCode.VALIDATION_ERROR]: ErrorCategory.VALIDATION,
      [ErrorCode.INVALID_INPUT]: ErrorCategory.VALIDATION,
      [ErrorCode.MISSING_REQUIRED_FIELD]: ErrorCategory.VALIDATION,
      [ErrorCode.INVALID_FORMAT]: ErrorCategory.VALIDATION,
      
      [ErrorCode.DATABASE_CONNECTION_ERROR]: ErrorCategory.DATABASE,
      [ErrorCode.DATABASE_QUERY_FAILED]: ErrorCategory.DATABASE,
      [ErrorCode.RECORD_NOT_FOUND]: ErrorCategory.DATABASE,
      [ErrorCode.DUPLICATE_RECORD]: ErrorCategory.DATABASE,
      
      [ErrorCode.FILE_NOT_FOUND]: ErrorCategory.FILE_SYSTEM,
      [ErrorCode.FILE_READ_ERROR]: ErrorCategory.FILE_SYSTEM,
      [ErrorCode.FILE_WRITE_ERROR]: ErrorCategory.FILE_SYSTEM,
      [ErrorCode.FILE_SIZE_EXCEEDED]: ErrorCategory.FILE_SYSTEM,
      [ErrorCode.UNSUPPORTED_FILE_TYPE]: ErrorCategory.FILE_SYSTEM,
      
      [ErrorCode.INTERNAL_ERROR]: ErrorCategory.SYSTEM,
      [ErrorCode.SERVICE_UNAVAILABLE]: ErrorCategory.SYSTEM,
      [ErrorCode.CONFIGURATION_ERROR]: ErrorCategory.SYSTEM,
      [ErrorCode.INVALID_CONFIG]: ErrorCategory.SYSTEM,
      [ErrorCode.RESOURCE_EXHAUSTED]: ErrorCategory.SYSTEM,
    };

    return categoryMap[code] || ErrorCategory.SYSTEM;
  }

  /**
   * 转换为JSON格式
   */
  toJSON(): {
    name: string;
    code: ErrorCode;
    message: string;
    severity: ErrorSeverity;
    category: ErrorCategory;
    timestamp: string;
    context?: ErrorContext;
    details?: any;
    stack?: string;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      category: this.category,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      details: this.details,
      stack: this.stack,
    };
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserFriendlyMessage(): string {
    const userMessages: Record<ErrorCode, string> = {
      [ErrorCode.UNAUTHORIZED]: '请先登录后再进行操作',
      [ErrorCode.FORBIDDEN]: '您没有权限执行此操作',
      [ErrorCode.TOKEN_EXPIRED]: '登录已过期，请重新登录',
      [ErrorCode.INVALID_CREDENTIALS]: '用户名或密码错误',
      
      [ErrorCode.MODEL_NOT_FOUND]: '选择的模型不存在，请重新选择',
      [ErrorCode.MODEL_INVOCATION_FAILED]: '模型调用失败，请稍后重试',
      [ErrorCode.PROVIDER_NOT_FOUND]: '模型提供商不存在',
      [ErrorCode.UNSUPPORTED_PROVIDER]: '不支持的模型提供商',
      [ErrorCode.MODEL_RATE_LIMITED]: '模型调用频率过高，请稍后重试',
      [ErrorCode.MODEL_TIMEOUT]: '模型响应超时，请稍后重试',
      
      [ErrorCode.ASSISTANT_NOT_FOUND]: '智能体不存在',
      [ErrorCode.ASSISTANT_CREATION_FAILED]: '创建智能体失败，请检查配置后重试',
      [ErrorCode.ASSISTANT_UPDATE_FAILED]: '更新智能体失败，请稍后重试',
      [ErrorCode.ASSISTANT_DELETION_FAILED]: '删除智能体失败，请稍后重试',
      [ErrorCode.INVALID_ASSISTANT_CONFIG]: '智能体配置无效，请检查配置',
      [ErrorCode.DUPLICATE_ASSISTANT_NAME]: '智能体名称已存在，请使用其他名称',
      
      [ErrorCode.NETWORK_ERROR]: '网络连接异常，请检查网络后重试',
      [ErrorCode.TIMEOUT_ERROR]: '请求超时，请稍后重试',
      [ErrorCode.CONNECTION_REFUSED]: '连接被拒绝，请稍后重试',
      [ErrorCode.DNS_RESOLUTION_FAILED]: '域名解析失败，请检查网络设置',
      
      [ErrorCode.VALIDATION_ERROR]: '输入信息有误，请检查后重试',
      [ErrorCode.INVALID_INPUT]: '输入格式不正确，请检查输入内容',
      [ErrorCode.MISSING_REQUIRED_FIELD]: '缺少必填字段，请完善信息',
      [ErrorCode.INVALID_FORMAT]: '格式不正确，请检查输入格式',
      
      [ErrorCode.DATABASE_CONNECTION_ERROR]: '数据库连接失败，请稍后重试',
      [ErrorCode.DATABASE_QUERY_FAILED]: '数据库查询失败，请稍后重试',
      [ErrorCode.RECORD_NOT_FOUND]: '记录不存在',
      [ErrorCode.DUPLICATE_RECORD]: '记录已存在',
      
      [ErrorCode.FILE_NOT_FOUND]: '文件不存在',
      [ErrorCode.FILE_READ_ERROR]: '文件读取失败',
      [ErrorCode.FILE_WRITE_ERROR]: '文件写入失败',
      [ErrorCode.FILE_SIZE_EXCEEDED]: '文件大小超出限制',
      [ErrorCode.UNSUPPORTED_FILE_TYPE]: '不支持的文件类型',
      
      [ErrorCode.INTERNAL_ERROR]: '系统内部错误，请稍后重试',
      [ErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用，请稍后重试',
      [ErrorCode.CONFIGURATION_ERROR]: '系统配置错误，请联系管理员',
      [ErrorCode.INVALID_CONFIG]: '配置格式无效，请检查配置',
      [ErrorCode.RESOURCE_EXHAUSTED]: '系统资源不足，请稍后重试',
    };

    return userMessages[this.code] || '操作失败，请稍后重试';
  }

  /**
   * 检查是否为可重试的错误
   */
  isRetryable(): boolean {
    const retryableCodes: ErrorCode[] = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT_ERROR,
      ErrorCode.CONNECTION_REFUSED,
      ErrorCode.DATABASE_CONNECTION_ERROR,
      ErrorCode.MODEL_INVOCATION_FAILED,
      ErrorCode.MODEL_TIMEOUT,
      ErrorCode.SERVICE_UNAVAILABLE,
      ErrorCode.RESOURCE_EXHAUSTED,
    ];

    return retryableCodes.includes(this.code);
  }

  /**
   * 检查是否为用户输入错误
   */
  isUserInputError(): boolean {
    return this.category === ErrorCategory.VALIDATION || 
           this.category === ErrorCategory.USER_INPUT;
  }

  /**
   * 检查是否为系统错误
   */
  isSystemError(): boolean {
    return this.category === ErrorCategory.SYSTEM || 
           this.category === ErrorCategory.DATABASE ||
           this.category === ErrorCategory.NETWORK;
  }
}
