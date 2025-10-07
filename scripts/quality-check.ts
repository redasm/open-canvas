/**
 * 代码质量检查脚本 - 验证重构效果
 * 主要功能：
 * 1. 检查硬编码配置是否已消除
 * 2. 验证新系统是否正确集成
 * 3. 检查代码重复度
 * 4. 验证性能优化效果
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface QualityCheckResult {
  name: string;
  success: boolean;
  message: string;
  details?: any;
}

class QualityChecker {
  private results: QualityCheckResult[] = [];

  async runAllChecks(): Promise<void> {
    console.log('🔍 开始代码质量检查...\n');

    await this.checkHardcodedConfigurations();
    await this.checkNewSystemIntegration();
    await this.checkCodeDuplication();
    await this.checkPerformanceOptimizations();
    await this.checkErrorHandlingCoverage();
    await this.checkTypeSafety();

    this.printResults();
  }

  private async checkHardcodedConfigurations(): Promise<void> {
    console.log('📋 检查硬编码配置...');
    
    try {
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        ignore: ['node_modules/**', 'dist/**', '.next/**', '**/*.d.ts']
      });

      const hardcodedPatterns = [
        /ALL_MODELS/g,
        /DEFAULT_MODEL_NAME/g,
        /DEFAULT_MODEL_CONFIG/g,
        /NON_STREAMING_TEXT_MODELS/g,
        /NON_STREAMING_TOOL_CALLING_MODELS/g,
        /TEMPERATURE_EXCLUDED_MODELS/g,
      ];

      const violations: Array<{ file: string; line: number; pattern: string }> = [];

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          hardcodedPatterns.forEach(pattern => {
            if (pattern.test(line)) {
              violations.push({
                file,
                line: index + 1,
                pattern: pattern.source,
              });
            }
          });
        });
      }

      if (violations.length === 0) {
        this.addResult('硬编码配置检查', true, '未发现硬编码配置', { checkedFiles: files.length });
      } else {
        this.addResult('硬编码配置检查', false, `发现 ${violations.length} 个硬编码配置`, { violations });
      }
    } catch (error) {
      this.addResult('硬编码配置检查', false, '检查失败', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async checkNewSystemIntegration(): Promise<void> {
    console.log('📋 检查新系统集成...');
    
    try {
      const integrationFiles = [
        'apps/web/src/hooks/use-model-registry.ts',
        'apps/web/src/hooks/use-assistant-templates.ts',
        'packages/shared/src/config/model-registry.ts',
        'packages/shared/src/config/model-loader.ts',
        'config/models.json',
        'config/assistant-templates.json',
      ];

      const missingFiles: string[] = [];
      const existingFiles: string[] = [];

      for (const file of integrationFiles) {
        if (fs.existsSync(file)) {
          existingFiles.push(file);
        } else {
          missingFiles.push(file);
        }
      }

      if (missingFiles.length === 0) {
        this.addResult('新系统集成检查', true, '所有新系统文件都存在', { files: existingFiles });
      } else {
        this.addResult('新系统集成检查', false, `缺少 ${missingFiles.length} 个文件`, { missingFiles, existingFiles });
      }
    } catch (error) {
      this.addResult('新系统集成检查', false, '检查失败', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async checkCodeDuplication(): Promise<void> {
    console.log('📋 检查代码重复度...');
    
    try {
      const files = await glob('**/*.{ts,tsx}', {
        ignore: ['node_modules/**', 'dist/**', '.next/**', '**/*.d.ts']
      });

      const functionSignatures = new Map<string, string[]>();
      let totalFunctions = 0;
      let duplicateFunctions = 0;

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        
        // 简单的函数签名提取
        const functionMatches = content.match(/export\s+(?:async\s+)?function\s+(\w+)/g);
        if (functionMatches) {
          functionMatches.forEach(match => {
            const functionName = match.replace(/export\s+(?:async\s+)?function\s+/, '');
            totalFunctions++;
            
            if (!functionSignatures.has(functionName)) {
              functionSignatures.set(functionName, []);
            }
            functionSignatures.get(functionName)!.push(file);
          });
        }
      }

      // 检查重复函数
      functionSignatures.forEach((files, functionName) => {
        if (files.length > 1) {
          duplicateFunctions += files.length - 1;
        }
      });

      const duplicationRate = totalFunctions > 0 ? (duplicateFunctions / totalFunctions) * 100 : 0;

      if (duplicationRate < 10) {
        this.addResult('代码重复度检查', true, `代码重复度: ${duplicationRate.toFixed(2)}%`, {
          totalFunctions,
          duplicateFunctions,
          duplicationRate,
        });
      } else {
        this.addResult('代码重复度检查', false, `代码重复度过高: ${duplicationRate.toFixed(2)}%`, {
          totalFunctions,
          duplicateFunctions,
          duplicationRate,
        });
      }
    } catch (error) {
      this.addResult('代码重复度检查', false, '检查失败', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async checkPerformanceOptimizations(): Promise<void> {
    console.log('📋 检查性能优化...');
    
    try {
      const optimizationFiles = [
        'apps/web/src/hooks/use-performance-optimization.ts',
        'apps/web/src/hooks/use-modern-react-features.ts',
        'apps/web/src/hooks/use-resource-cleanup.ts',
        'apps/web/src/lib/cache/cache-manager.ts',
      ];

      const existingOptimizations = optimizationFiles.filter(file => fs.existsSync(file));

      if (existingOptimizations.length === optimizationFiles.length) {
        this.addResult('性能优化检查', true, '所有性能优化文件都存在', { files: existingOptimizations });
      } else {
        this.addResult('性能优化检查', false, '缺少性能优化文件', { 
          existing: existingOptimizations,
          missing: optimizationFiles.filter(f => !existingOptimizations.includes(f))
        });
      }
    } catch (error) {
      this.addResult('性能优化检查', false, '检查失败', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async checkErrorHandlingCoverage(): Promise<void> {
    console.log('📋 检查错误处理覆盖...');
    
    try {
      const errorHandlingFiles = [
        'apps/web/src/components/error-boundary/error-boundary.tsx',
        'apps/web/src/hooks/use-error-handler.ts',
        'apps/web/src/lib/error-handler/error-handler.ts',
        'apps/web/src/app/api/middleware/error-handler.ts',
        'packages/shared/src/errors/error-types.ts',
      ];

      const existingFiles = errorHandlingFiles.filter(file => fs.existsSync(file));

      if (existingFiles.length === errorHandlingFiles.length) {
        this.addResult('错误处理覆盖检查', true, '所有错误处理文件都存在', { files: existingFiles });
      } else {
        this.addResult('错误处理覆盖检查', false, '缺少错误处理文件', {
          existing: existingFiles,
          missing: errorHandlingFiles.filter(f => !existingFiles.includes(f))
        });
      }
    } catch (error) {
      this.addResult('错误处理覆盖检查', false, '检查失败', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async checkTypeSafety(): Promise<void> {
    console.log('📋 检查类型安全...');
    
    try {
      // 检查TypeScript配置文件
      const tsConfigFiles = [
        'tsconfig.json',
        'apps/web/tsconfig.json',
        'apps/agents/tsconfig.json',
        'packages/shared/tsconfig.json',
      ];

      const existingTsConfigs = tsConfigFiles.filter(file => fs.existsSync(file));

      if (existingTsConfigs.length === tsConfigFiles.length) {
        this.addResult('类型安全检查', true, '所有TypeScript配置文件都存在', { files: existingTsConfigs });
      } else {
        this.addResult('类型安全检查', false, '缺少TypeScript配置文件', {
          existing: existingTsConfigs,
          missing: tsConfigFiles.filter(f => !existingTsConfigs.includes(f))
        });
      }
    } catch (error) {
      this.addResult('类型安全检查', false, '检查失败', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private addResult(name: string, success: boolean, message: string, details?: any): void {
    this.results.push({
      name,
      success,
      message,
      details,
    });
  }

  private printResults(): void {
    console.log('\n📊 代码质量检查结果:');
    console.log('='.repeat(60));
    
    let passed = 0;
    let failed = 0;

    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.name.padEnd(25)} ${result.message}`);
      
      if (result.details) {
        console.log(`   └─ 详情: ${JSON.stringify(result.details, null, 2)}`);
      }
      
      if (result.success) {
        passed++;
      } else {
        failed++;
      }
    });

    console.log('='.repeat(60));
    console.log(`总计: ${this.results.length} 个检查`);
    console.log(`通过: ${passed} 个`);
    console.log(`失败: ${failed} 个`);
    
    if (failed === 0) {
      console.log('\n🎉 所有质量检查通过！重构成功！');
    } else {
      console.log(`\n⚠️  有 ${failed} 个检查失败，请修复相关问题。`);
    }
  }
}

// 运行检查
async function main() {
  const checker = new QualityChecker();
  await checker.runAllChecks();
}

if (require.main === module) {
  main().catch(console.error);
}

export { QualityChecker };
