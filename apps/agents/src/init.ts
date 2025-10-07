/**
 * 应用初始化脚本 - 启动时初始化新系统
 * 主要功能：
 * 1. 初始化模型注册器
 * 2. 验证系统状态
 * 3. 提供健康检查
 */

import { initializeModelRegistry } from './config/init-model-registry';

let isInitialized = false;

/**
 * 初始化应用
 */
export async function initializeApp(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    console.log('🚀 初始化 Open Canvas 应用...');
    
    // 初始化模型注册器
    await initializeModelRegistry();
    
    isInitialized = true;
    console.log('✅ 应用初始化完成');
  } catch (error) {
    console.error('❌ 应用初始化失败:', error);
    throw error;
  }
}

/**
 * 检查应用是否已初始化
 */
export function isAppInitialized(): boolean {
  return isInitialized;
}

/**
 * 获取初始化状态
 */
export function getInitializationStatus(): {
  initialized: boolean;
  timestamp?: Date;
} {
  return {
    initialized: isInitialized,
    timestamp: isInitialized ? new Date() : undefined,
  };
}
