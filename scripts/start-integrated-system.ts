/**
 * 启动集成系统脚本 - 启动新集成的系统
 * 主要功能：
 * 1. 初始化模型注册器
 * 2. 启动配置监控
 * 3. 验证系统状态
 * 4. 提供健康检查
 */

import { initializeModelRegistry, startConfigMonitoring, checkAndReloadConfig } from '../apps/agents/src/config/init-model-registry';
import { ModelRegistry } from '../packages/shared/src/config/model-registry';

class IntegratedSystemStarter {
  private configMonitor?: NodeJS.Timeout;
  private isRunning = false;

  async start(): Promise<void> {
    console.log('🚀 启动集成系统...\n');

    try {
      // 1. 初始化模型注册器
      await this.initializeModelRegistry();
      
      // 2. 验证系统状态
      await this.verifySystemStatus();
      
      // 3. 启动配置监控
      this.startConfigMonitoring();
      
      // 4. 设置优雅关闭
      this.setupGracefulShutdown();
      
      this.isRunning = true;
      console.log('\n✅ 集成系统启动成功！');
      console.log('📊 系统状态: 运行中');
      console.log('🔄 配置监控: 已启用');
      console.log('💡 按 Ctrl+C 优雅关闭系统\n');
      
    } catch (error) {
      console.error('❌ 集成系统启动失败:', error);
      process.exit(1);
    }
  }

  private async initializeModelRegistry(): Promise<void> {
    console.log('📋 初始化模型注册器...');
    
    try {
      await initializeModelRegistry();
      console.log('✅ 模型注册器初始化成功');
    } catch (error) {
      console.error('❌ 模型注册器初始化失败:', error);
      throw error;
    }
  }

  private async verifySystemStatus(): Promise<void> {
    console.log('📋 验证系统状态...');
    
    try {
      const registry = ModelRegistry.getInstance();
      
      if (!registry.isInitialized()) {
        throw new Error('模型注册器未正确初始化');
      }

      const stats = registry.getStats();
      console.log(`✅ 系统状态验证成功:`);
      console.log(`   - 模型数量: ${stats.totalModels}`);
      console.log(`   - 提供商数量: ${stats.totalProviders}`);
      console.log(`   - 分类数量: ${Object.keys(stats.modelsByCategory).length}`);
      
      // 验证关键模型
      const keyModels = ['gpt-4o', 'claude-3-5-sonnet-latest', 'deepseek-v3'];
      const missingModels = keyModels.filter(modelId => !registry.getModel(modelId));
      
      if (missingModels.length > 0) {
        console.warn(`⚠️  缺少关键模型: ${missingModels.join(', ')}`);
      } else {
        console.log('✅ 所有关键模型都已加载');
      }
      
    } catch (error) {
      console.error('❌ 系统状态验证失败:', error);
      throw error;
    }
  }

  private startConfigMonitoring(): void {
    console.log('📋 启动配置监控...');
    
    try {
      this.configMonitor = startConfigMonitoring(30000); // 30秒检查一次
      console.log('✅ 配置监控启动成功 (30秒间隔)');
    } catch (error) {
      console.error('❌ 配置监控启动失败:', error);
      throw error;
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 收到 ${signal} 信号，开始优雅关闭...`);
      
      if (this.configMonitor) {
        console.log('🔄 停止配置监控...');
        clearInterval(this.configMonitor);
        this.configMonitor = undefined;
      }
      
      console.log('✅ 系统已优雅关闭');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  async checkHealth(): Promise<{ healthy: boolean; details: any }> {
    try {
      const registry = ModelRegistry.getInstance();
      const stats = registry.getStats();
      
      return {
        healthy: registry.isInitialized() && stats.totalModels > 0,
        details: {
          initialized: registry.isInitialized(),
          modelCount: stats.totalModels,
          providerCount: stats.totalProviders,
          isRunning: this.isRunning,
          configMonitoring: !!this.configMonitor
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          isRunning: this.isRunning
        }
      };
    }
  }

  async reloadConfig(): Promise<boolean> {
    try {
      console.log('🔄 手动重新加载配置...');
      const changed = await checkAndReloadConfig();
      
      if (changed) {
        console.log('✅ 配置已更新');
      } else {
        console.log('ℹ️  配置无变化');
      }
      
      return changed;
    } catch (error) {
      console.error('❌ 重新加载配置失败:', error);
      return false;
    }
  }
}

// 启动系统
async function main() {
  const starter = new IntegratedSystemStarter();
  await starter.start();
  
  // 保持进程运行
  setInterval(async () => {
    const health = await starter.checkHealth();
    if (!health.healthy) {
      console.warn('⚠️  系统健康检查失败:', health.details);
    }
  }, 60000); // 每分钟检查一次健康状态
}

if (require.main === module) {
  main().catch(console.error);
}

export { IntegratedSystemStarter };
