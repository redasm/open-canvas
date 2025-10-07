/**
 * 智能体模板选择器组件 - 使用新的智能体模板系统
 * 主要改动：
 * 1. 使用新的智能体模板系统替代硬编码模板列表
 * 2. 简化模板选择逻辑
 * 3. 集成搜索和过滤功能
 * 4. 优化用户体验和性能
 */

'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { AssistantTemplate, AssistantTemplateCategory } from '@opencanvas/shared/config/assistant-config';
import { useAssistantTemplateSelector } from '@/hooks/use-assistant-templates';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageCircle, Code, PenTool, BarChart, Palette, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateSelectorProps {
  onTemplateSelect: (template: AssistantTemplate) => void;
  onCustomCreate: () => void;
  className?: string;
}

/**
 * 模板卡片组件
 */
interface TemplateCardProps {
  template: AssistantTemplate;
  onSelect: (template: AssistantTemplate) => void;
  isSelected?: boolean;
}

function TemplateCard({ template, onSelect, isSelected }: TemplateCardProps) {
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105",
        isSelected && "ring-2 ring-blue-500 bg-blue-50"
      )}
      onClick={() => onSelect(template)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-full" style={{ backgroundColor: `${template.preview.color}20` }}>
              <TemplateIcon name={template.preview.icon} color={template.preview.color} />
            </div>
            <div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <Badge variant="outline" className="text-xs mt-1">
                {template.category}
              </Badge>
            </div>
          </div>
          <Sparkles className="w-5 h-5 text-gray-400" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="text-sm leading-relaxed">
          {template.preview.description}
        </CardDescription>
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>模板ID: {template.id}</span>
          <Badge variant="secondary" className="text-xs">
            {template.category}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 模板图标组件
 */
interface TemplateIconProps {
  name: string;
  color: string;
}

function TemplateIcon({ name, color }: TemplateIconProps) {
  const IconComponent = useMemo(() => {
    switch (name) {
      case 'MessageCircle': return MessageCircle;
      case 'Code': return Code;
      case 'PenTool': return PenTool;
      case 'BarChart': return BarChart;
      case 'Palette': return Palette;
      default: return MessageCircle;
    }
  }, [name]);

  return <IconComponent className="h-6 w-6" style={{ color }} />;
}

/**
 * 智能体模板选择器主组件
 */
export function TemplateSelector({ 
  onTemplateSelect, 
  onCustomCreate,
  className
}: TemplateSelectorProps) {
  const {
    templates,
    categories,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    loading,
    error,
  } = useAssistantTemplateSelector();

  const [selectedTemplate, setSelectedTemplate] = useState<AssistantTemplate | null>(null);
  const { handleError } = useErrorHandler();

  /**
   * 处理模板选择
   */
  const handleTemplateSelect = async (template: AssistantTemplate) => {
    try {
      setSelectedTemplate(template);
      onTemplateSelect(template);
    } catch (error) {
      await handleError(error as Error, {
        operation: 'select_template',
        metadata: { templateId: template.id }
      });
    }
  };

  /**
   * 处理自定义创建
   */
  const handleCustomCreate = () => {
    setSelectedTemplate(null);
    onCustomCreate();
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-sm text-gray-600">加载智能体模板中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="text-center">
          <p className="text-sm text-red-600 mb-4">加载模板失败: {error}</p>
          <Button size="sm" onClick={() => window.location.reload()}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* 搜索和过滤 */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="搜索智能体模板..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
          >
            全部
          </Button>
          {categories.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category === 'general' ? '通用' : 
               category === 'coding' ? '编程' :
               category === 'writing' ? '写作' :
               category === 'analysis' ? '分析' :
               category === 'creative' ? '创意' :
               category === 'custom' ? '自定义' : category}
            </Button>
          ))}
        </div>
      </div>

      {/* 模板列表 */}
      <ScrollArea className="h-96">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={handleTemplateSelect}
              isSelected={selectedTemplate?.id === template.id}
            />
          ))}
          
          {/* 自定义创建卡片 */}
          <Card
            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 cursor-pointer"
            onClick={handleCustomCreate}
          >
            <div className="text-center">
              <Plus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <CardTitle className="text-lg text-gray-600 mb-2">创建自定义智能体</CardTitle>
              <CardDescription className="text-center text-gray-500">
                从头开始配置您的智能体
              </CardDescription>
            </div>
          </Card>
        </div>
      </ScrollArea>

      {/* 统计信息 */}
      <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
        <span>共找到 {templates.length} 个模板</span>
        <span>
          {selectedCategory !== 'all' && `分类: ${selectedCategory}`}
          {searchQuery && ` | 搜索: "${searchQuery}"`}
        </span>
      </div>
    </div>
  );
}

/**
 * 模板预览组件
 */
interface TemplatePreviewProps {
  template: AssistantTemplate;
  className?: string;
}

export function TemplatePreview({ template, className }: TemplatePreviewProps) {
  return (
    <div className={cn("space-y-4 p-4 bg-gray-50 rounded-lg", className)}>
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-full" style={{ backgroundColor: `${template.preview.color}20` }}>
          <TemplateIcon name={template.preview.icon} color={template.preview.color} />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{template.name}</h3>
          <Badge variant="outline" className="text-xs">
            {template.category}
          </Badge>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 leading-relaxed">
        {template.preview.description}
      </p>
      
      <div className="text-xs text-gray-500">
        <span>模板ID: {template.id}</span>
      </div>
    </div>
  );
}