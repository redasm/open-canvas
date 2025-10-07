/**
 * 重构后的模型选择器组件 - 使用新的模型配置系统
 * 主要改动：
 * 1. 使用新的模型注册器替代硬编码模型列表
 * 2. 简化模型选择逻辑
 * 3. 集成搜索和过滤功能
 * 4. 优化用户体验和性能
 */

'use client';

import React, { useState, useMemo } from 'react';
import { ModelDefinition } from '@opencanvas/shared/config/model-config';
import { useModelSelector } from '@/hooks/use-model-registry';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronDown, Search, Settings, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RefactoredModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  showConfig?: boolean;
  className?: string;
}

/**
 * 模型卡片组件
 */
interface ModelCardProps {
  model: ModelDefinition;
  isSelected: boolean;
  onSelect: (model: ModelDefinition) => void;
  onConfig?: (model: ModelDefinition) => void;
  showConfig?: boolean;
}

function ModelCard({ model, isSelected, onSelect, onConfig, showConfig }: ModelCardProps) {
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isSelected && "ring-2 ring-blue-500 bg-blue-50"
      )}
      onClick={() => onSelect(model)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Zap className="w-4 h-4 text-gray-600" />
            </div>
            {model.metadata.isNew && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                新
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {model.metadata.category}
            </Badge>
          </div>
          {showConfig && onConfig && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onConfig(model);
              }}
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}
        </div>
        <CardTitle className="text-lg">{model.displayName}</CardTitle>
        <CardDescription className="text-sm">
          {model.metadata.description || 'AI模型'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>提供商:</span>
            <Badge variant="outline" className="text-xs">
              {model.provider}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>最大令牌:</span>
            <span>{model.capabilities.maxTokens.toLocaleString()}</span>
          </div>
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            {model.capabilities.supportsToolCalling && (
              <Badge variant="secondary" className="text-xs">工具调用</Badge>
            )}
            {model.capabilities.supportsStreaming && (
              <Badge variant="secondary" className="text-xs">流式响应</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 重构后的模型选择器主组件
 */
export function RefactoredModelSelector({ 
  selectedModel, 
  onModelChange, 
  disabled = false,
  showConfig = true,
  className
}: RefactoredModelSelectorProps) {
  const {
    models,
    categories,
    selectedCategory,
    setSelectedCategory,
    selectedProvider,
    setSelectedProvider,
    searchQuery,
    setSearchQuery,
    loading,
    error,
  } = useModelSelector();

  const [open, setOpen] = useState(false);
  const { handleError } = useErrorHandler();

  /**
   * 处理模型选择
   */
  const handleModelSelect = async (model: ModelDefinition) => {
    try {
      onModelChange(model.id);
      setOpen(false);
    } catch (error) {
      await handleError(error as Error, {
        operation: 'select_model',
        metadata: { modelId: model.id }
      });
    }
  };

  /**
   * 处理模型配置
   */
  const handleModelConfig = (model: ModelDefinition) => {
    // TODO: 实现模型配置面板
    console.log('配置模型:', model.id);
  };

  /**
   * 获取选中的模型
   */
  const selectedModelData = useMemo(() => {
    return models.find(model => model.id === selectedModel);
  }, [models, selectedModel]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">加载模型中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="text-center">
          <p className="text-sm text-red-600 mb-2">加载模型失败: {error}</p>
          <Button size="sm" onClick={() => window.location.reload()}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* 模型选择器 */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedModelData ? (
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4" />
                <span>{selectedModelData.displayName}</span>
                {selectedModelData.metadata.isNew && (
                  <Badge variant="secondary" className="text-xs">新</Badge>
                )}
              </div>
            ) : (
              "选择模型..."
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="搜索模型..." />
            <CommandList>
              <CommandEmpty>没有找到匹配的模型</CommandEmpty>
              {categories.map(category => (
                <CommandGroup key={category} heading={category}>
                  {models
                    .filter(model => model.metadata.category === category)
                    .map(model => (
                      <CommandItem
                        key={model.id}
                        value={model.id}
                        onSelect={() => handleModelSelect(model)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <Check
                            className={cn(
                              "h-4 w-4",
                              selectedModel === model.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div>
                            <div className="font-medium">{model.displayName}</div>
                            <div className="text-xs text-gray-500">{model.provider}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {model.metadata.isNew && (
                            <Badge variant="secondary" className="text-xs">新</Badge>
                          )}
                          {model.capabilities.supportsToolCalling && (
                            <Badge variant="outline" className="text-xs">工具</Badge>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* 模型详情 */}
      {selectedModelData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>{selectedModelData.displayName}</span>
              {selectedModelData.metadata.isNew && (
                <Badge variant="secondary" className="text-xs">新模型</Badge>
              )}
            </CardTitle>
            <CardDescription className="text-sm">
              {selectedModelData.metadata.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">提供商:</span>
                <div className="font-medium">{selectedModelData.provider}</div>
              </div>
              <div>
                <span className="text-gray-500">最大令牌:</span>
                <div className="font-medium">{selectedModelData.capabilities.maxTokens.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-gray-500">温度范围:</span>
                <div className="font-medium">
                  {selectedModelData.capabilities.temperatureRange.min} - {selectedModelData.capabilities.temperatureRange.max}
                </div>
              </div>
              <div>
                <span className="text-gray-500">能力:</span>
                <div className="flex space-x-1 mt-1">
                  {selectedModelData.capabilities.supportsToolCalling && (
                    <Badge variant="outline" className="text-xs">工具调用</Badge>
                  )}
                  {selectedModelData.capabilities.supportsStreaming && (
                    <Badge variant="outline" className="text-xs">流式响应</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * 模型配置面板组件
 */
interface ModelConfigPanelProps {
  model: ModelDefinition;
  config: any;
  onConfigChange: (config: any) => void;
}

export function ModelConfigPanel({ model, config, onConfigChange }: ModelConfigPanelProps) {
  const { capabilities } = model;
  
  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="font-semibold mb-2">基础设置</h3>
        <div className="space-y-3">
          {/* 温度设置 */}
          <div>
            <label className="text-sm font-medium">温度: {config.temperature}</label>
            <input
              type="range"
              min={capabilities.temperatureRange.min}
              max={capabilities.temperatureRange.max}
              step="0.1"
              value={config.temperature}
              onChange={(e) => onConfigChange({ ...config, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{capabilities.temperatureRange.min}</span>
              <span>{capabilities.temperatureRange.max}</span>
            </div>
          </div>

          {/* 最大令牌设置 */}
          <div>
            <label className="text-sm font-medium">最大令牌: {config.maxTokens}</label>
            <input
              type="range"
              min="1"
              max={capabilities.maxTokens}
              step="100"
              value={config.maxTokens}
              onChange={(e) => onConfigChange({ ...config, maxTokens: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>{capabilities.maxTokens.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">高级设置</h3>
        <div className="space-y-3">
          {/* 工具调用开关 */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">工具调用</label>
            <input
              type="checkbox"
              checked={config.toolCalling}
              onChange={(e) => onConfigChange({ ...config, toolCalling: e.target.checked })}
              disabled={!capabilities.supportsToolCalling}
              className="rounded"
            />
          </div>

          {/* 流式响应开关 */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">流式响应</label>
            <input
              type="checkbox"
              checked={config.streaming}
              onChange={(e) => onConfigChange({ ...config, streaming: e.target.checked })}
              disabled={!capabilities.supportsStreaming}
              className="rounded"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
