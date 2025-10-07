import { NextRequest, NextResponse } from 'next/server';
import { ModelConfigLoader } from '@opencanvas/shared/config/model-loader';
import { ModelRegistry } from '@opencanvas/shared/config/model-registry';
import { ModelDefinition, ModelProviderConfig } from '@opencanvas/shared/config/model-config';
import * as fs from 'fs';
import * as path from 'path';

// 获取模型注册表实例
const modelRegistry = ModelRegistry.getInstance();

// 获取CORS头
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'http://localhost:3001', // 允许前端的源
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// 处理OPTIONS请求
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

export async function GET(request: NextRequest) {
  try {
    // 加载模型配置 - 使用绝对路径指向项目根目录的config文件夹
    const configPath = path.resolve(process.cwd(), '../../config/models.json');
    const configLoader = ModelConfigLoader.getInstance(configPath);
    await configLoader.loadConfig();

    const { searchParams } = new URL(request.url);
    const providerFilter = searchParams.get('provider');
    const categoryFilter = searchParams.get('category');

    // 从注册表获取模型和提供商
    let models = modelRegistry.getAllModels();
    let providers = modelRegistry.getAllProviders();

    // 应用过滤器
    if (providerFilter) {
      models = models.filter(model => model.provider === providerFilter);
      providers = providers.filter(provider => provider.id === providerFilter);
    }

    if (categoryFilter) {
      models = models.filter(model => model.metadata?.category === categoryFilter);
    } else {
      // 如果没有类别过滤器，确保所有模型都至少有一个默认类别
      models = models.map(model => ({
        ...model,
        metadata: {
          ...model.metadata,
          category: model.metadata?.category || 'general'
        }
      }));
    }

    // 提取所有唯一的类别
    const categories = Array.from(new Set(models.map(m => m.metadata?.category || 'general')));

    return NextResponse.json(
      {
        success: true,
        data: {
          models,
          providers,
          total: models.length,
          categories,
        },
      },
      { headers: getCorsHeaders() }
    );
  } catch (error) {
    console.error('Failed to load models:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: '加载模型配置失败',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}