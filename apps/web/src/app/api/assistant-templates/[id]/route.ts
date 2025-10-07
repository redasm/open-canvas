/**
 * 单个智能体模板API路由 - 获取特定模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, createSuccessResponse, createErrorResponse } from '../../middleware/error-handler';
import { ErrorCode } from '@opencanvas/shared/errors/error-types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 获取单个智能体模板
 */
async function getAssistantTemplate(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const configPath = path.join(process.cwd(), 'config', 'assistant-templates.json');
    
    if (!fs.existsSync(configPath)) {
      return createErrorResponse(
        ErrorCode.FILE_NOT_FOUND,
        '智能体模板配置文件不存在',
        404
      );
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    const template = config.templates.find((t: any) => t.id === params.id);
    
    if (!template) {
      return createErrorResponse(
        ErrorCode.RECORD_NOT_FOUND,
        `智能体模板 ${params.id} 不存在`,
        404
      );
    }

    return createSuccessResponse(template);

  } catch (error) {
    console.error('Failed to load assistant template:', error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      '加载智能体模板失败',
      500,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

export const GET = withErrorHandler(getAssistantTemplate);
