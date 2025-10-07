/**
 * 智能体模板加载器 - 加载和管理智能体模板
 * 主要改动：
 * 1. 实现模板配置文件加载和解析
 * 2. 支持模板验证和错误处理
 * 3. 提供模板查询和过滤功能
 * 4. 支持热重载配置
 */

import { AssistantTemplate, AssistantTemplateCategory } from './assistant-config.js';
import * as fs from 'fs';

export class AssistantTemplateLoader {
  private static instance: AssistantTemplateLoader;
  private templates: Map<string, AssistantTemplate> = new Map();
  private configPath: string;
  private lastModified: number = 0;

  private constructor(configPath: string = 'config/assistant-templates.json') {
    this.configPath = configPath;
  }

  /**
   * 获取单例实例
   */
  static getInstance(configPath?: string): AssistantTemplateLoader {
    if (!AssistantTemplateLoader.instance) {
      AssistantTemplateLoader.instance = new AssistantTemplateLoader(configPath);
    }
    return AssistantTemplateLoader.instance;
  }

  /**
   * 加载模板配置
   */
  async loadTemplates(): Promise<void> {
    try {
      const configData = await this.readConfigFile();
      const templates = this.processTemplates(configData);
      
      // 验证模板
      this.validateTemplates(templates);
      
      // 清空现有模板
      this.templates.clear();
      
      // 加载新模板
      templates.forEach(template => {
        this.templates.set(template.id, template);
      });
      
      console.log(`✅ 成功加载智能体模板: ${templates.length} 个模板`);
    } catch (error) {
      console.error('❌ 加载智能体模板失败:', error);
      throw new Error(`Failed to load assistant templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 重新加载模板
   */
  async reloadTemplates(): Promise<void> {
    if (this.hasConfigChanged()) {
      await this.loadTemplates();
    }
  }

  /**
   * 检查配置是否已更改
   */
  hasConfigChanged(): boolean {
    try {
      const stats = fs.statSync(this.configPath);
      return stats.mtime.getTime() > this.lastModified;
    } catch {
      return false;
    }
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): AssistantTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 根据ID获取模板
   */
  getTemplate(id: string): AssistantTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 根据分类获取模板
   */
  getTemplatesByCategory(category: AssistantTemplateCategory): AssistantTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.category === category);
  }

  /**
   * 搜索模板
   */
  searchTemplates(query: string): AssistantTemplate[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.templates.values())
      .filter(template => 
        template.name.toLowerCase().includes(lowerQuery) ||
        template.description.toLowerCase().includes(lowerQuery)
      );
  }

  /**
   * 获取所有分类
   */
  getCategories(): AssistantTemplateCategory[] {
    const categories = new Set<AssistantTemplateCategory>();
    this.templates.forEach(template => {
      categories.add(template.category);
    });
    return Array.from(categories);
  }

  /**
   * 获取模板统计信息
   */
  getStats(): {
    totalTemplates: number;
    templatesByCategory: Record<string, number>;
  } {
    const templates = Array.from(this.templates.values());
    const templatesByCategory: Record<string, number> = {};
    
    templates.forEach(template => {
      templatesByCategory[template.category] = (templatesByCategory[template.category] || 0) + 1;
    });

    return {
      totalTemplates: templates.length,
      templatesByCategory,
    };
  }

  /**
   * 读取配置文件
   */
  private async readConfigFile(): Promise<any> {
    try {
      const configContent = fs.readFileSync(this.configPath, 'utf-8');
      const stats = fs.statSync(this.configPath);
      this.lastModified = stats.mtime.getTime();
      
      return JSON.parse(configContent);
    } catch (error) {
      throw new Error(`Failed to read template configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 处理模板配置
   */
  private processTemplates(config: any): AssistantTemplate[] {
    if (!config.templates || !Array.isArray(config.templates)) {
      throw new Error('Invalid template configuration: templates array not found');
    }

    return config.templates.map((templateData: any, index: number) => {
      try {
        return this.processTemplate(templateData);
      } catch (error) {
        throw new Error(`Failed to process template at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  /**
   * 处理单个模板
   */
  private processTemplate(templateData: any): AssistantTemplate {
    return {
      id: templateData.id,
      name: templateData.name,
      description: templateData.description,
      category: templateData.category,
      config: templateData.config || {},
      preview: {
        icon: templateData.preview?.icon || 'User',
        color: templateData.preview?.color || '#000000',
        description: templateData.preview?.description || templateData.description,
      },
    };
  }

  /**
   * 验证模板
   */
  private validateTemplates(templates: AssistantTemplate[]): void {
    const ids = new Set<string>();
    
    templates.forEach((template, index) => {
      // 检查必填字段
      if (!template.id) {
        throw new Error(`Template at index ${index} is missing required field: id`);
      }
      if (!template.name) {
        throw new Error(`Template at index ${index} is missing required field: name`);
      }
      if (!template.description) {
        throw new Error(`Template at index ${index} is missing required field: description`);
      }
      if (!template.category) {
        throw new Error(`Template at index ${index} is missing required field: category`);
      }

      // 检查ID唯一性
      if (ids.has(template.id)) {
        throw new Error(`Duplicate template ID: ${template.id}`);
      }
      ids.add(template.id);

      // 检查分类有效性
      const validCategories: AssistantTemplateCategory[] = [
        'general', 'coding', 'writing', 'analysis', 'creative', 'education', 'business'
      ];
      if (!validCategories.includes(template.category)) {
        throw new Error(`Invalid template category: ${template.category}`);
      }
    });
  }

  /**
   * 设置配置路径
   */
  setConfigPath(configPath: string): void {
    this.configPath = configPath;
    this.lastModified = 0; // 重置修改时间
  }

  /**
   * 获取配置统计信息
   */
  getConfigStats(): {
    configPath: string;
    lastModified: Date;
    templatesCount: number;
  } {
    return {
      configPath: this.configPath,
      lastModified: new Date(this.lastModified),
      templatesCount: this.templates.size,
    };
  }
}
