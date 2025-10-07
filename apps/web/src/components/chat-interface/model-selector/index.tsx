"use client";

// 导入新的模型选择器
import NewModelSelector from "./new-model-selector";
// 使用新的类型定义，不再依赖旧的models.ts
type ALL_MODEL_NAMES = string;
import {
  CustomModelConfig,
} from "@opencanvas/shared/types";

interface ModelSelectorProps {
  modelName: ALL_MODEL_NAMES;
  setModelName: (name: ALL_MODEL_NAMES) => void;
  modelConfig: CustomModelConfig;
  setModelConfig: (
    modelName: ALL_MODEL_NAMES,
    config: CustomModelConfig
  ) => void;
  modelConfigs: Record<string, CustomModelConfig>;
}

export default function ModelSelector({
  modelName,
  setModelConfig,
  setModelName,
  modelConfigs,
}: ModelSelectorProps) {
  // 使用新的模型选择器组件
  return (
    <NewModelSelector
      modelName={modelName}
      setModelName={setModelName}
      modelConfig={modelConfigs[modelName]}
      setModelConfig={setModelConfig}
      modelConfigs={modelConfigs}
    />
  );
}