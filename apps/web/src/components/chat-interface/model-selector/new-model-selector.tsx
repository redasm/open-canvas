/**
 * 新的模型选择器组件 - 使用新的模型配置系统
 * 主要改动：
 * 1. 完全替换硬编码的ALL_MODELS
 * 2. 使用新的模型注册器系统
 * 3. 集成缓存和错误处理
 * 4. 保持与现有接口的兼容性
 */

"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { ModelDefinition } from '@opencanvas/shared/config/model-config';
import { CustomModelConfig } from '@opencanvas/shared/types';
import { useModelRegistry } from '@/hooks/use-model-registry';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { useUserContext } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronDown, Search, Settings, Zap, Loader2 } from 'lucide-react';
import { CaretSortIcon, GearIcon } from "@radix-ui/react-icons";
import NextImage from "next/image";
import LLMIcon from "@/components/icons/svg/LLMIcon.svg";
import { cn } from '@/lib/utils';
import { ModelConfigPanel } from './model-config-pannel';
import { IsNewBadge } from './new-badge';

// 兼容性类型定义
type ALL_MODEL_NAMES = string;

interface NewModelSelectorProps {
  modelName: ALL_MODEL_NAMES;
  setModelName: (name: ALL_MODEL_NAMES) => void;
  modelConfig: CustomModelConfig;
  setModelConfig: (
    modelName: ALL_MODEL_NAMES,
    config: CustomModelConfig
  ) => void;
  modelConfigs: Record<string, CustomModelConfig>;
}

interface ModelItemProps {
  model: ModelDefinition;
  isSelected: boolean;
  onSelect: (model: ModelDefinition) => void;
  onConfig: (model: ModelDefinition) => void;
  showConfig?: boolean;
}

function ModelItem({ model, isSelected, onSelect, onConfig, showConfig = true }: ModelItemProps) {
  return (
    <CommandItem
      value={model.id}
      onSelect={() => onSelect(model)}
      className="flex items-center"
    >
      <Check
        className={cn(
          "mr-1 size-4",
          isSelected ? "opacity-100" : "opacity-0"
        )}
      />
      <span className="flex flex-row w-full items-center justify-start gap-2">
        {model.displayName}
        {model.metadata?.isNew && <IsNewBadge />}
      </span>

      {showConfig && (
        <button
          className="ml-auto flex-shrink-0 flex size-6 items-center justify-center focus:outline-none focus:ring-0"
          onClick={(e) => {
            e.stopPropagation();
            onConfig(model);
          }}
        >
          <GearIcon className="size-4" />
        </button>
      )}
    </CommandItem>
  );
}

export default function NewModelSelector({
  modelName,
  setModelName,
  modelConfig,
  setModelConfig,
  modelConfigs,
}: NewModelSelectorProps) {
  const { user } = useUserContext();
  const { models, providers, loading, error, reloadModels } = useModelRegistry();
  const { handleError } = useErrorHandler();
  const [open, setOpen] = useState(false);
  const [openConfigModelId, setOpenConfigModelId] = useState<string>();

  // 过滤模型 - 考虑用户权限和环境变量
  const filteredModels = useMemo(() => {
    let filtered = models;

    // 按用户权限过滤
    const isLangChainUser = user?.email?.endsWith("@langchain.dev") || false;
    if (!isLangChainUser) {
      // 过滤掉LangChain专用模型（如果有的话）
      // 这里可以根据需要添加特定的模型过滤逻辑
    }

    // 按环境变量过滤
    filtered = filtered.filter(model => {
      if (model.provider === 'fireworks' && process.env.NEXT_PUBLIC_FIREWORKS_ENABLED === "false") {
        return false;
      }
      if (model.provider === 'anthropic' && process.env.NEXT_PUBLIC_ANTHROPIC_ENABLED === "false") {
        return false;
      }
      if (model.provider === 'openai' && process.env.NEXT_PUBLIC_OPENAI_ENABLED === "false") {
        return false;
      }
      if (model.provider === 'azure_openai' && process.env.NEXT_PUBLIC_AZURE_ENABLED === "false") {
        return false;
      }
      if (model.provider === 'google-genai' && process.env.NEXT_PUBLIC_GEMINI_ENABLED === "false") {
        return false;
      }
      if (model.provider === 'ollama' && process.env.NEXT_PUBLIC_OLLAMA_ENABLED === "false") {
        return false;
      }
      if (model.provider === 'groq' && process.env.NEXT_PUBLIC_GROQ_ENABLED === "false") {
        return false;
      }
      return true;
    });

    return filtered;
  }, [models, user]);

  // 按提供商分组
  const modelsByProvider = useMemo(() => {
    const groups: Record<string, ModelDefinition[]> = {};
    filteredModels.forEach(model => {
      if (!groups[model.provider]) {
        groups[model.provider] = [];
      }
      groups[model.provider].push(model);
    });
    return groups;
  }, [filteredModels]);

  // 获取选中的模型
  const selectedModel = useMemo(() => {
    return models.find(model => model.id === modelName);
  }, [models, modelName]);

  // 处理模型选择
  const handleModelSelect = useCallback(async (model: ModelDefinition) => {
    try {
      setModelName(model.id);
      setOpen(false);
      
      // 如果该模型没有配置，创建默认配置
      if (!modelConfigs[model.id]) {
        const defaultConfig: CustomModelConfig = {
          provider: model.provider,
          temperatureRange: {
            min: model.capabilities.temperatureRange.min,
            max: model.capabilities.temperatureRange.max,
            default: model.capabilities.temperatureRange.default,
            current: model.capabilities.temperatureRange.default,
          },
          maxTokens: {
            min: 1,
            max: model.capabilities.maxTokens,
            default: Math.min(model.capabilities.maxTokens, 4096),
            current: Math.min(model.capabilities.maxTokens, 4096),
          },
        };
        setModelConfig(model.id, defaultConfig);
      }
    } catch (error) {
      await handleError(error as Error, {
        operation: 'select_model',
        metadata: { modelId: model.id }
      });
    }
  }, [setModelName, setModelConfig, modelConfigs, handleError]);

  // 处理模型配置
  const handleModelConfig = useCallback((model: ModelDefinition) => {
    setOpenConfigModelId(model.id);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">加载模型中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-2">加载模型失败: {error}</p>
          <Button size="sm" onClick={reloadModels}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 模型选择器 */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="min-w-[180px] w-[250px] bg-transparent shadow-none focus:outline-none cursor-pointer hover:bg-gray-100 rounded transition-colors border-none text-gray-600 h-9 px-3 py-2 text-sm focus:ring-1 focus:ring-ring"
          asChild
        >
          <div className="flex items-center pr-2 truncate">
            <NextImage
              alt="Model icon"
              src={LLMIcon}
              width={14}
              height={14}
              className="mr-2"
            />
            <span className="flex flex-row items-center justify-start gap-2">
              {selectedModel ? selectedModel.displayName : "选择模型..."}
              {selectedModel?.metadata.isNew && <IsNewBadge />}
            </span>
            <CaretSortIcon className="size-4 opacity-50 ml-auto" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="min-w-[180px] w-[280px] p-0 shadow-md rounded-md">
          <Command>
            <CommandList>
              {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                <CommandGroup key={provider} heading={provider}>
                  {providerModels.map(model => (
                    <ModelItem
                      key={model.id}
                      model={model}
                      isSelected={model.id === modelName}
                      onSelect={handleModelSelect}
                      onConfig={handleModelConfig}
                    />
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>


      {/* 模型配置面板 */}
      {openConfigModelId && (
        <ModelConfigPanel
          model={{
            name: openConfigModelId,
            label: selectedModel?.displayName || openConfigModelId,
            config: modelConfigs[openConfigModelId] || modelConfig,
            isNew: selectedModel?.metadata.isNew || false,
          }}
          modelConfig={modelConfigs[openConfigModelId] || modelConfig}
          isOpen={!!openConfigModelId}
          onOpenChange={(open) => !open && setOpenConfigModelId(undefined)}
          onClick={() => {}}
          setModelConfig={setModelConfig}
        />
      )}
    </div>
  );
}
