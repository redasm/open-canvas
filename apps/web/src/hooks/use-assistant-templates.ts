/**
 * 智能体模板Hook - 前端使用智能体模板系统
 * 主要改动：
 * 1. 提供智能体模板加载和管理功能
 * 2. 支持模板搜索和分类过滤
 * 3. 集成缓存和错误处理
 * 4. 提供模板创建智能体功能
 */

'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { AssistantTemplate, AssistantTemplateCategory } from '@opencanvas/shared/config/assistant-config';
import { useErrorHandler } from './use-error-handler';
import { enhancedCacheManager } from '@/lib/cache/enhanced-cache-manager';

interface UseAssistantTemplatesReturn {
  /** 所有模板 */
  templates: AssistantTemplate[];
  /** 按分类分组的模板 */
  templatesByCategory: Record<string, AssistantTemplate[]>;
  /** 所有分类 */
  categories: string[];
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 重新加载模板 */
  reloadTemplates: () => Promise<void>;
  /** 根据ID获取模板 */
  getTemplate: (id: string) => AssistantTemplate | undefined;
  /** 根据分类获取模板 */
  getTemplatesByCategory: (category: string) => AssistantTemplate[];
  /** 搜索模板 */
  searchTemplates: (query: string) => AssistantTemplate[];
}

/**
 * 智能体模板Hook
 */
export function useAssistantTemplates(): UseAssistantTemplatesReturn {
  const [templates, setTemplates] = useState<AssistantTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleError } = useErrorHandler();
  const cacheManager = enhancedCacheManager;

  /**
   * 加载智能体模板
   */
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 首先尝试从缓存获取
      const cacheKey = 'assistant-templates:all';
      const cachedTemplates = await cacheManager.get<AssistantTemplate[]>(cacheKey);
      
      if (cachedTemplates) {
        console.log('✅ 从缓存加载智能体模板数据');
        setTemplates(cachedTemplates);
        setLoading(false);
        return;
      }
      
      // 缓存未命中，从API获取
      console.log('🔄 从API获取智能体模板数据');
      const response = await fetch('/api/assistant-templates');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error?.message || '获取智能体模板列表失败');
      }
      
      const templatesData = data.data.templates || [];
      setTemplates(templatesData);
      
      // 缓存数据（15分钟）
      await cacheManager.set(cacheKey, templatesData, 900);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取智能体模板列表失败';
      setError(errorMessage);
      await handleError(err as Error, {
        operation: 'load_assistant_templates'
      });
    } finally {
      setLoading(false);
    }
  }, [handleError, cacheManager]);

  /**
   * 重新加载模板
   */
  const reloadTemplates = useCallback(async () => {
    // 清除缓存
    await cacheManager.delete('assistant-templates:all');
    await loadTemplates();
  }, [loadTemplates, cacheManager]);

  /**
   * 根据ID获取模板
   */
  const getTemplate = useCallback((id: string): AssistantTemplate | undefined => {
    return templates.find(template => template.id === id);
  }, [templates]);

  /**
   * 根据分类获取模板
   */
  const getTemplatesByCategory = useCallback((category: string): AssistantTemplate[] => {
    return templates.filter(template => template.category === category);
  }, [templates]);

  /**
   * 搜索模板
   */
  const searchTemplates = useCallback((query: string): AssistantTemplate[] => {
    if (!query.trim()) {
      return templates;
    }
    
    const lowerQuery = query.toLowerCase();
    return templates.filter(template => 
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.category.toLowerCase().includes(lowerQuery)
    );
  }, [templates]);

  // 计算派生数据
  const templatesByCategory = templates.reduce((acc, template) => {
    const category = template.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {} as Record<string, AssistantTemplate[]>);

  const categories = Array.from(new Set(templates.map(t => t.category)));

  // 初始化加载
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  return {
    templates,
    templatesByCategory,
    categories,
    loading,
    error,
    reloadTemplates,
    getTemplate,
    getTemplatesByCategory,
    searchTemplates,
  };
}

/**
 * 智能体模板选择Hook
 */
export function useAssistantTemplateSelector() {
  const { templates, categories, loading, error } = useAssistantTemplates();
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * 过滤后的模板
   */
  const filteredTemplates = useCallback(() => {
    let filtered = templates;

    // 按分类过滤
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    // 按搜索查询过滤
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(template => 
        template.name.toLowerCase().includes(lowerQuery) ||
        template.description.toLowerCase().includes(lowerQuery) ||
        template.category.toLowerCase().includes(lowerQuery)
      );
    }

    return filtered;
  }, [templates, selectedCategory, searchQuery]);

  return {
    templates: filteredTemplates(),
    categories,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    loading,
    error,
  };
}