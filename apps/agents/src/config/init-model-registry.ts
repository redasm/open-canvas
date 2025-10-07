/**
 * 模型注册器初始化系统 - 集成新模型配置系统
 * 主要改动：
 * 1. 在应用启动时初始化模型注册器
 * 2. 加载配置文件到注册器
 * 3. 提供初始化状态检查
 * 4. 支持热重载配置
 */

import { ModelRegistry } from '@opencanvas/shared/config/model-registry';
import { ModelConfigLoader } from '@opencanvas/shared/config/model-loader';
import { ModelError, ModelErrorCode } from '@opencanvas/shared/config/model-config';
import * as path from 'path';

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * 初始化模型注册器
 */
export async function initializeModelRegistry(): Promise<void> {
  // 如果已经初始化，直接返回
  if (isInitialized) {
    return;
  }

  // 如果正在初始化，等待完成
  if (initializationPromise) {
    return initializationPromise;
  }

  // 开始初始化
  initializationPromise = performInitialization();
  
  try {
    await initializationPromise;
    isInitialized = true;
    console.log('✅ 模型注册器初始化成功');
  } catch (error) {
    isInitialized = false;
    initializationPromise = null;
    console.error('❌ 模型注册器初始化失败:', error);
    throw error;
  }
}

/**
 * 执行初始化
 */
async function performInitialization(): Promise<void> {
  try {
    // 获取项目根目录的绝对路径
    const projectRoot = path.resolve(__dirname, '../../../..');
    const configPath = path.join(projectRoot, 'config', 'models.json');
    
    const loader = ModelConfigLoader.getInstance(configPath);
    await loader.loadConfig();
    
    const registry = ModelRegistry.getInstance();
    const stats = registry.getStats();
    
    console.log(`📊 模型注册器统计:`, {
      totalModels: stats.totalModels,
      totalProviders: stats.totalProviders,
      modelsByProvider: stats.modelsByProvider,
      modelsByCategory: stats.modelsByCategory,
    });
  } catch (error) {
    throw new ModelError(
      ModelErrorCode.INVALID_CONFIG,
      `模型注册器初始化失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { error }
    );
  }
}

/**
 * 重新初始化模型注册器
 */
export async function reinitializeModelRegistry(): Promise<void> {
  isInitialized = false;
  initializationPromise = null;
  return initializeModelRegistry();
}

/**
 * 检查是否已初始化
 */
export function isModelRegistryInitialized(): boolean {
  return isInitialized;
}

/**
 * 获取模型注册器实例（确保已初始化）
 */
export async function getInitializedModelRegistry(): Promise<ModelRegistry> {
  await initializeModelRegistry();
  return ModelRegistry.getInstance();
}

/**
 * 获取模型配置加载器实例
 */
export function getModelConfigLoader(): ModelConfigLoader {
  const projectRoot = path.resolve(__dirname, '../../../..');
  const configPath = path.join(projectRoot, 'config', 'models.json');
  return ModelConfigLoader.getInstance(configPath);
}

/**
 * 检查配置是否已更改并重新加载
 */
export async function checkAndReloadConfig(): Promise<boolean> {
  try {
    const loader = getModelConfigLoader();
    
    if (loader.hasConfigChanged()) {
      console.log('🔄 检测到配置文件更改，重新加载...');
      await loader.reloadConfig();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ 重新加载配置失败:', error);
    return false;
  }
}

/**
 * 启动配置监控（可选）
 */
export function startConfigMonitoring(intervalMs: number = 30000): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      await checkAndReloadConfig();
    } catch (error) {
      console.error('配置监控错误:', error);
    }
  }, intervalMs);
}

/**
 * 停止配置监控
 */
export function stopConfigMonitoring(timer: NodeJS.Timeout): void {
  clearInterval(timer);
}
