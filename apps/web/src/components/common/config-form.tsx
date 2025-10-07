/**
 * 通用配置表单组件 - 消除重复代码
 * 主要功能：
 * 1. 提供通用的表单验证逻辑
 * 2. 支持多种输入类型
 * 3. 统一的错误处理
 * 4. 可复用的表单组件
 */

'use client';

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { cn } from '@/lib/utils';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'slider' | 'switch' | 'select';
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  description?: string;
}

interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

interface ConfigFormProps<T> {
  title: string;
  description?: string;
  initialData: T;
  fields: FormField[];
  validationRules?: Record<string, ValidationRule>;
  onSubmit: (data: T) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  className?: string;
}

interface FormErrors {
  [key: string]: string;
}

export function ConfigForm<T extends Record<string, any>>({
  title,
  description,
  initialData,
  fields,
  validationRules = {},
  onSubmit,
  onCancel,
  submitLabel = '保存',
  cancelLabel = '取消',
  className,
}: ConfigFormProps<T>) {
  const [data, setData] = useState<T>(initialData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { handleError } = useErrorHandler();

  /**
   * 验证单个字段
   */
  const validateField = useCallback((name: string, value: any): string | null => {
    const rules = validationRules[name];
    if (!rules) return null;

    if (rules.required && (!value || value === '')) {
      return `${fields.find(f => f.name === name)?.label || name} 是必填项`;
    }

    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        return `${fields.find(f => f.name === name)?.label || name} 不能小于 ${rules.min}`;
      }
      if (rules.max !== undefined && value > rules.max) {
        return `${fields.find(f => f.name === name)?.label || name} 不能大于 ${rules.max}`;
      }
    }

    if (typeof value === 'string' && rules.pattern && !rules.pattern.test(value)) {
      return `${fields.find(f => f.name === name)?.label || name} 格式不正确`;
    }

    if (rules.custom) {
      return rules.custom(value);
    }

    return null;
  }, [fields, validationRules]);

  /**
   * 验证整个表单
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    fields.forEach(field => {
      const value = data[field.name];
      const error = validateField(field.name, value);
      if (error) {
        newErrors[field.name] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [data, fields, validateField]);

  /**
   * 处理字段变化
   */
  const handleFieldChange = useCallback((name: string, value: any) => {
    setData(prev => ({ ...prev, [name]: value }));
    
    // 清除该字段的错误
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  }, [errors]);

  /**
   * 处理表单提交
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } catch (error) {
      await handleError(error as Error, {
        operation: 'submit_form',
        metadata: { formTitle: title }
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [data, validateForm, onSubmit, handleError, title]);

  /**
   * 渲染字段
   */
  const renderField = useCallback((field: FormField) => {
    const value = data[field.name];
    const error = errors[field.name];

    const commonProps = {
      id: field.name,
      value: value || '',
      onChange: (e: any) => handleFieldChange(field.name, e.target.value),
      className: cn(error && 'border-red-500'),
    };

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            placeholder={field.placeholder}
            rows={4}
          />
        );
      
      case 'number':
        return (
          <Input
            {...commonProps}
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            placeholder={field.placeholder}
          />
        );
      
      case 'slider':
        return (
          <div className="space-y-2">
            <Slider
              value={[value || field.min || 0]}
              onValueChange={(values) => handleFieldChange(field.name, values[0])}
              min={field.min || 0}
              max={field.max || 100}
              step={field.step || 1}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-500">
              <span>{field.min || 0}</span>
              <span className="font-medium">{value || field.min || 0}</span>
              <span>{field.max || 100}</span>
            </div>
          </div>
        );
      
      case 'switch':
        return (
          <Switch
            checked={value || false}
            onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
          />
        );
      
      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={(selectedValue) => handleFieldChange(field.name, selectedValue)}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      default:
        return (
          <Input
            {...commonProps}
            placeholder={field.placeholder}
          />
        );
    }
  }, [data, errors, handleFieldChange]);

  return (
    <Card className={cn("w-full max-w-2xl mx-auto", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {fields.map(field => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {renderField(field)}
              {field.description && (
                <p className="text-sm text-gray-500">{field.description}</p>
              )}
              {errors[field.name] && (
                <Alert variant="destructive">
                  <AlertDescription>{errors[field.name]}</AlertDescription>
                </Alert>
              )}
            </div>
          ))}
          
          <div className="flex justify-end space-x-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? '保存中...' : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
