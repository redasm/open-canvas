// 使用新的类型定义，不再依赖旧的models.ts
type ALL_MODEL_NAMES = string;
import { CustomModelConfig, GraphInput } from "@opencanvas/shared/types";

export interface StreamWorkerMessage {
  type: "chunk" | "done" | "error";
  data?: string;
  error?: string;
}

export interface StreamConfig {
  threadId: string;
  assistantId: string;
  input: GraphInput;
  modelName: ALL_MODEL_NAMES;
  modelConfigs: Record<string, CustomModelConfig>;
}
