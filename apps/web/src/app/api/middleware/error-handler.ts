/**
 * API错误处理中间件 - 简化版本
 * 主要改动：
 * 1. 统一API错误响应格式
 * 2. 实现错误处理中间件
 * 3. 支持错误日志记录
 * 4. 提供CORS和错误响应头
 */

import { NextRequest, NextResponse } from 'next/server';
import { AppError, ErrorCode } from '@opencanvas/shared/errors/error-types';

/**
 * 错误处理中间件
 */
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error: any) {
      console.error('API Error:', error);
      const req = args[0] instanceof NextRequest ? args[0] : undefined;

      // 创建标准错误响应
      const appError = error instanceof AppError ? error : new AppError(
        ErrorCode.INTERNAL_ERROR,
        error.message || 'Internal server error',
        { originalError: error }
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: appError.code,
            message: appError.message,
            details: appError.details,
            timestamp: appError.timestamp,
          },
        },
        {
          status: getHttpStatusFromErrorCode(appError.code),
          headers: getCorsHeaders(),
        }
      );
    }
  };
}

/**
 * 创建成功响应
 */
export function createSuccessResponse(data: any, status: number = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    {
      status,
      headers: getCorsHeaders(),
    }
  );
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number = 500,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date(),
      },
    },
    {
      status,
      headers: getCorsHeaders(),
    }
  );
}

/**
 * 获取CORS头
 */
function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

/**
 * 根据内部错误代码映射到HTTP状态码
 */
function getHttpStatusFromErrorCode(code: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    [ErrorCode.UNAUTHORIZED]: 401,
    [ErrorCode.FORBIDDEN]: 403,
    [ErrorCode.MODEL_NOT_FOUND]: 404,
    [ErrorCode.ASSISTANT_NOT_FOUND]: 404,
    [ErrorCode.TEMPLATE_NOT_FOUND]: 404,
    [ErrorCode.VALIDATION_ERROR]: 400,
    [ErrorCode.INVALID_INPUT]: 400,
    [ErrorCode.INVALID_MODEL_CONFIG]: 400,
    [ErrorCode.INVALID_ASSISTANT_CONFIG]: 400,
    [ErrorCode.INVALID_CONFIG]: 500,
    [ErrorCode.NETWORK_ERROR]: 502,
    [ErrorCode.TIMEOUT_ERROR]: 504,
    [ErrorCode.SERVICE_UNAVAILABLE]: 503,
    [ErrorCode.API_ERROR]: 500,
    [ErrorCode.MODEL_INVOCATION_FAILED]: 500,
    [ErrorCode.PROVIDER_NOT_FOUND]: 500,
    [ErrorCode.ASSISTANT_CREATION_FAILED]: 500,
    [ErrorCode.ASSISTANT_UPDATE_FAILED]: 500,
    [ErrorCode.ASSISTANT_DELETE_FAILED]: 500,
    [ErrorCode.CONFIG_LOAD_FAILED]: 500,
    [ErrorCode.CACHE_ERROR]: 500,
    [ErrorCode.REDIS_ERROR]: 500,
    [ErrorCode.INTERNAL_ERROR]: 500,
    [ErrorCode.UNKNOWN_ERROR]: 500,
  };

  return statusMap[code] || 500;
}