/**
 * 智能体配置构建器 - 实现原始计划中的分步骤配置流程
 * 主要功能：
 * 1. 分步骤的智能体配置流程
 * 2. 配置验证和错误处理
 * 3. 模板集成和自定义创建
 * 4. 预览和确认功能
 */

'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { AssistantConfig, AssistantTemplate } from '@opencanvas/shared/config/assistant-config';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssistantConfigBuilderProps {
  initialConfig?: Partial<AssistantConfig>;
  template?: AssistantTemplate;
  onSave: (config: AssistantConfig) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

interface Step {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<StepComponentProps>;
}

interface StepComponentProps {
  config: AssistantConfig;
  onChange: (config: AssistantConfig) => void;
  onNext: () => void;
  onPrevious: () => void;
  isValidating: boolean;
}

/**
 * 基础信息步骤组件
 */
function BasicInfoStep({ config, onChange, onNext }: StepComponentProps) {
  const handleNameChange = (name: string) => {
    onChange({ ...config, name });
  };

  const handleDescriptionChange = (description: string) => {
    onChange({ ...config, description });
  };

  const handleIconChange = (icon: { name: string; color: string }) => {
    onChange({ ...config, icon });
  };

  const canProceed = config.name && config.name.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">智能体名称</label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="输入智能体名称"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">描述（可选）</label>
        <textarea
          value={config.description || ''}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="输入智能体描述"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">图标</label>
        <div className="flex items-center space-x-4">
          <select
            value={config.icon.name}
            onChange={(e) => handleIconChange({ ...config.icon, name: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="User">用户</option>
            <option value="Bot">机器人</option>
            <option value="Code">代码</option>
            <option value="PenTool">写作</option>
            <option value="BarChart">分析</option>
          </select>
          <input
            type="color"
            value={config.icon.color}
            onChange={(e) => handleIconChange({ ...config.icon, color: e.target.value })}
            className="w-12 h-10 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canProceed}>
          下一步
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * 模型配置步骤组件
 */
function ModelConfigStep({ config, onChange, onNext, onPrevious }: StepComponentProps) {
  const handleModelChange = (modelId: string) => {
    onChange({
      ...config,
      model: { ...config.model, id: modelId }
    });
  };

  const handleConfigChange = (modelConfig: any) => {
    onChange({
      ...config,
      model: { ...config.model, config: modelConfig }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">选择模型</label>
        <select
          value={config.model.id}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="gpt-4o">GPT-4o</option>
          <option value="gpt-4o-mini">GPT-4o Mini</option>
          <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
          <option value="gemini-pro">Gemini Pro</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">温度设置</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={config.model.config.temperature || 0.5}
          onChange={(e) => handleConfigChange({ ...config.model.config, temperature: parseFloat(e.target.value) })}
          className="w-full"
        />
        <div className="text-sm text-gray-600 mt-1">
          当前值: {config.model.config.temperature || 0.5}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">最大令牌数</label>
        <input
          type="number"
          min="1"
          max="8192"
          value={config.model.config.maxTokens || 4096}
          onChange={(e) => handleConfigChange({ ...config.model.config, maxTokens: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          上一步
        </Button>
        <Button onClick={onNext}>
          下一步
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * 系统提示步骤组件
 */
function SystemPromptStep({ config, onChange, onNext, onPrevious }: StepComponentProps) {
  const handlePromptChange = (systemPrompt: string) => {
    onChange({ ...config, systemPrompt });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">系统提示</label>
        <textarea
          value={config.systemPrompt || ''}
          onChange={(e) => handlePromptChange(e.target.value)}
          placeholder="输入系统提示，定义智能体的行为和角色..."
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="text-sm text-gray-600 mt-1">
          系统提示将指导智能体的行为和响应方式
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          上一步
        </Button>
        <Button onClick={onNext}>
          下一步
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * 工具配置步骤组件
 */
function ToolsConfigStep({ config, onChange, onNext, onPrevious }: StepComponentProps) {
  const handleToolsChange = (tools: any[]) => {
    onChange({ ...config, tools });
  };

  const availableTools = [
    { name: 'web_search', description: '网络搜索', enabled: false },
    { name: 'code_executor', description: '代码执行', enabled: false },
    { name: 'file_reader', description: '文件读取', enabled: false },
    { name: 'calculator', description: '计算器', enabled: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">选择工具</label>
        <div className="space-y-3">
          {availableTools.map((tool) => (
            <div key={tool.name} className="flex items-center space-x-3">
              <input
                type="checkbox"
                id={tool.name}
                checked={config.tools.some(t => t.name === tool.name)}
                onChange={(e) => {
                  const newTools = e.target.checked
                    ? [...config.tools, { name: tool.name, description: tool.description, parameters: {} }]
                    : config.tools.filter(t => t.name !== tool.name);
                  handleToolsChange(newTools);
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={tool.name} className="text-sm font-medium">
                {tool.description}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          上一步
        </Button>
        <Button onClick={onNext}>
          下一步
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * 预览确认步骤组件
 */
function ReviewStep({ config, onSave, onPrevious, isValidating }: StepComponentProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">配置预览</h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">名称</label>
            <p className="text-sm">{config.name}</p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-600">描述</label>
            <p className="text-sm">{config.description || '无描述'}</p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-600">模型</label>
            <p className="text-sm">{config.model.id}</p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-600">工具</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {config.tools.map((tool) => (
                <Badge key={tool.name} variant="secondary">
                  {tool.description}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          上一步
        </Button>
        <Button onClick={onSave} disabled={isValidating}>
          {isValidating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              保存配置
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * 智能体配置构建器主组件
 */
export function AssistantConfigBuilder({
  initialConfig,
  template,
  onSave,
  onCancel,
  className
}: AssistantConfigBuilderProps) {
  const [config, setConfig] = useState<AssistantConfig>(() => {
    if (template) {
      return {
        id: '',
        name: template.name,
        description: template.description,
        icon: { name: template.preview.icon, color: template.preview.color },
        model: template.config.model || { id: 'gpt-4o-mini', config: { temperature: 0.5, maxTokens: 4096, streaming: true } },
        systemPrompt: template.config.systemPrompt,
        tools: template.config.tools || [],
        documents: [],
        metadata: {
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: '',
        },
      };
    }
    
    return initialConfig || {
      id: '',
      name: '',
      description: '',
      icon: { name: 'User', color: '#3B82F6' },
      model: { id: 'gpt-4o-mini', config: { temperature: 0.5, maxTokens: 4096, streaming: true } },
      systemPrompt: '',
      tools: [],
      documents: [],
      metadata: {
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: '',
      },
    };
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [isValidating, setIsValidating] = useState(false);
  const { handleError } = useErrorHandler();

  const steps: Step[] = [
    { id: 'basic', title: '基础信息', description: '设置智能体名称和图标', component: BasicInfoStep },
    { id: 'model', title: '模型配置', description: '选择模型和参数', component: ModelConfigStep },
    { id: 'prompt', title: '系统提示', description: '定义智能体行为', component: SystemPromptStep },
    { id: 'tools', title: '工具配置', description: '选择可用工具', component: ToolsConfigStep },
    { id: 'review', title: '预览确认', description: '确认配置信息', component: ReviewStep },
  ];

  const handleNext = useCallback(async () => {
    setIsValidating(true);
    try {
      // 这里可以添加步骤验证逻辑
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    } finally {
      setIsValidating(false);
    }
  }, [steps.length]);

  const handlePrevious = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const handleSave = useCallback(async () => {
    setIsValidating(true);
    try {
      // 生成唯一ID
      const finalConfig = {
        ...config,
        id: config.id || `assistant-${Date.now()}`,
        metadata: {
          ...config.metadata,
          updatedAt: new Date(),
        },
      };

      await onSave(finalConfig);
    } catch (error) {
      await handleError(error as Error, {
        operation: 'save_assistant_config',
        metadata: { config }
      });
    } finally {
      setIsValidating(false);
    }
  }, [config, onSave, handleError]);

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className={cn("max-w-2xl mx-auto", className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>创建智能体</span>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              取消
            </Button>
          </CardTitle>
          <CardDescription>
            {currentStepData.title} - {currentStepData.description}
          </CardDescription>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>步骤 {currentStep + 1} / {steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
        
        <CardContent>
          {React.createElement(currentStepData.component, {
            config,
            onChange: setConfig,
            onNext: handleNext,
            onPrevious: handlePrevious,
            onSave: handleSave,
            isValidating,
          })}
        </CardContent>
      </Card>
    </div>
  );
}
