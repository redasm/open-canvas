# LangChain 与 LangGraph 关系分析

## 概述

本文档基于对 Open Canvas 项目的深入分析，详细阐述了 LangChain 与 LangGraph 的关系、协作模式以及在复杂 AI 应用中的架构设计。

## 1. 基本关系

### 1.1 核心定位

**LangChain** 和 **LangGraph** 是 LangChain 生态系统中的两个核心组件，它们有着明确的分工：

- **LangChain**: 提供基础的 LLM 交互能力
  - 模型调用和配置
  - 工具绑定和调用
  - 消息处理和格式化
  - 多提供商支持

- **LangGraph**: 提供复杂工作流编排能力
  - 状态管理和持久化
  - 节点路由和条件分支
  - 并行执行和循环控制
  - 可视化调试和监控

### 1.2 协作模式

LangChain 和 LangGraph 采用**分层协作**模式：
- LangGraph 在上层管理复杂的 AI 工作流程
- LangChain 在下层处理具体的模型调用和工具交互
- 每个 LangGraph 节点内部都使用 LangChain 进行 LLM 交互

## 2. 在 Open Canvas 项目中的体现

### 2.1 项目架构

```
┌─────────────────────────────────────┐
│           Open Canvas App           │
├─────────────────────────────────────┤
│           LangGraph                 │ ← 工作流编排层
│  ┌─────────────────────────────────┐ │
│  │        LangGraph Nodes          │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │        LangChain            │ │ │ ← LLM 交互层
│  │  │  - Model Configuration     │ │ │
│  │  │  - Tool Binding            │ │ │
│  │  │  - Message Handling        │ │ │
│  │  │  - API Calls               │ │ │
│  │  └─────────────────────────────┘ │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 2.2 依赖关系

从 `apps/agents/package.json` 可以看到依赖结构：

```json
{
  "dependencies": {
    "@langchain/anthropic": "^0.3.21",
    "@langchain/community": "^0.3.45", 
    "@langchain/core": "^0.3.71",
    "@langchain/langgraph": "^0.4.4",        // LangGraph 核心
    "@langchain/langgraph-sdk": "^0.0.107",  // LangGraph SDK
    "langchain": "^0.3.27",                   // LangChain 核心
    // ... 其他 LangChain 提供商包
  }
}
```

## 3. LangChain 的职责

### 3.1 模型配置和调用

```typescript
// apps/agents/src/utils.ts
export async function getModelFromConfig(
  config: LangGraphRunnableConfig,
  extra?: {
    temperature?: number;
    maxTokens?: number;
    isToolCalling?: boolean;
  }
): Promise<ReturnType<typeof initChatModel>> {
  const {
    modelName,
    modelProvider,
    azureConfig,
    apiKey,
    baseUrl,
    modelConfig,
  } = getModelConfig(config, {
    isToolCalling: extra?.isToolCalling,
  });

  // 使用 LangChain 的 initChatModel 创建模型实例
  return await initChatModel(modelName, {
    modelProvider,
    ...(baseUrl ? { baseUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
    ...(azureConfig != null ? {
        azureOpenAIApiKey: azureConfig.azureOpenAIApiKey,
        azureOpenAIApiInstanceName: azureConfig.azureOpenAIApiInstanceName,
        azureOpenAIApiDeploymentName: azureConfig.azureOpenAIApiDeploymentName,
        azureOpenAIApiVersion: azureConfig.azureOpenAIApiVersion,
        azureOpenAIBasePath: azureConfig.azureOpenAIBasePath,
      } : {}),
  });
}
```

### 3.2 多提供商支持

LangChain 统一了不同模型提供商的接口：

- **OpenAI** (`modelProvider: "openai"`): `https://api.openai.com/v1`
- **Anthropic** (`modelProvider: "anthropic"`): `https://api.anthropic.com`
- **Google** (`modelProvider: "google-genai"`): `https://generativelanguage.googleapis.com/v1beta`
- **Fireworks** (`modelProvider: "fireworks"`): `https://api.fireworks.ai/inference/v1`
- **Groq** (`modelProvider: "groq"`): `https://api.groq.com/openai/v1`
- **Azure OpenAI** (`modelProvider: "azure_openai"`): 使用 Azure 配置的端点
- **Ollama** (`modelProvider: "ollama"`): 本地部署，需要自定义 baseUrl

### 3.3 工具绑定和调用

```typescript
// apps/agents/src/open-canvas/nodes/generate-artifact/index.ts
const modelWithArtifactTool = smallModel.bindTools(
  [
    {
      name: "generate_artifact",
      description: ARTIFACT_TOOL_SCHEMA.description,
      schema: ARTIFACT_TOOL_SCHEMA,
    },
  ],
  {
    tool_choice: "generate_artifact",
  }
);
```

## 4. LangGraph 的职责

### 4.1 工作流编排

```typescript
// apps/agents/src/open-canvas/index.ts
const builder = new StateGraph(OpenCanvasGraphAnnotation)
  .addNode("generatePath", generatePath)
  .addNode("generateArtifact", generateArtifact)
  .addNode("rewriteArtifact", rewriteArtifact)
  .addNode("updateArtifact", updateArtifact)
  .addNode("generateFollowup", generateFollowup)
  .addNode("reflect", reflectNode)
  .addNode("generateTitle", generateTitleNode)
  .addNode("summarizer", summarizer)
  .addNode("webSearch", webSearchGraph)
  // 条件路由
  .addConditionalEdges("generatePath", routeNode, [
    "updateArtifact",
    "rewriteArtifactTheme", 
    "replyToGeneralInput",
    "generateArtifact",
    "rewriteArtifact",
    "customAction",
    "updateHighlightedText",
    "webSearch",
  ])
  // 顺序执行
  .addEdge("generateArtifact", "generateFollowup")
  .addEdge("generateFollowup", "reflect")
  .addEdge("reflect", "cleanState");
```

### 4.2 状态管理

```typescript
// apps/agents/src/open-canvas/state.ts
export const OpenCanvasGraphAnnotation = Annotation.Root({
  // 消息状态
  ...MessagesAnnotation.spec,
  _messages: Annotation<BaseMessage[], Messages>({
    reducer: (state, update) => {
      const latestMsg = Array.isArray(update)
        ? update[update.length - 1]
        : update;

      if (isSummaryMessage(latestMsg)) {
        return messagesStateReducer([], update);
      }
      return messagesStateReducer(state, update);
    },
    default: () => [],
  }),
  // 工件状态
  artifact: Annotation<ArtifactV3>,
  // 高亮状态
  highlightedCode: Annotation<CodeHighlight | undefined>,
  highlightedText: Annotation<TextHighlight | undefined>,
  // 路由状态
  next: Annotation<string | undefined>,
  // 配置状态
  language: Annotation<LanguageOptions | undefined>,
  artifactLength: Annotation<ArtifactLengthOptions | undefined>,
  regenerateWithEmojis: Annotation<boolean | undefined>,
  readingLevel: Annotation<ReadingLevelOptions | undefined>,
  addComments: Annotation<boolean | undefined>,
});
```

### 4.3 多图协作

Open Canvas 使用多个 LangGraph 图协作：

```json
// langgraph.json
{
  "graphs": {
    "agent": "./apps/agents/src/open-canvas/index.ts:graph",
    "reflection": "./apps/agents/src/reflection/index.ts:graph",
    "thread_title": "./apps/agents/src/thread-title/index.ts:graph",
    "summarizer": "./apps/agents/src/summarizer/index.ts:graph",
    "web_search": "./apps/agents/src/web-search/index.ts:graph"
  }
}
```

## 5. 协作实例分析

### 5.1 节点内部使用 LangChain

每个 LangGraph 节点内部都使用 LangChain 进行 LLM 交互：

```typescript
// apps/agents/src/open-canvas/nodes/generate-artifact/index.ts
export const generateArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  // 1. 使用 LangChain 获取模型实例
  const { modelName } = getModelConfig(config, {
    isToolCalling: true,
  });
  const smallModel = await getModelFromConfig(config, {
    temperature: 0.5,
    isToolCalling: true,
  });

  // 2. 使用 LangChain 绑定工具
  const modelWithArtifactTool = smallModel.bindTools(
    [
      {
        name: "generate_artifact",
        description: ARTIFACT_TOOL_SCHEMA.description,
        schema: ARTIFACT_TOOL_SCHEMA,
      },
    ],
    {
      tool_choice: "generate_artifact",
    }
  );

  // 3. 准备提示和上下文
  const memoriesAsString = await getFormattedReflections(config);
  const formattedNewArtifactPrompt = formatNewArtifactPrompt(
    memoriesAsString,
    modelName
  );
  const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
  const fullSystemPrompt = userSystemPrompt
    ? `${userSystemPrompt}\n${formattedNewArtifactPrompt}`
    : formattedNewArtifactPrompt;
  const contextDocumentMessages = await createContextDocumentMessages(config);

  // 4. 使用 LangChain 调用模型
  const isO1MiniModel = isUsingO1MiniModel(config);
  const response = await modelWithArtifactTool.invoke(
    [
      { role: isO1MiniModel ? "user" : "system", content: fullSystemPrompt },
      ...contextDocumentMessages,
      ...state._messages,
    ],
    { runName: "generate_artifact" }
  );

  // 5. 处理 LangChain 的响应
  const args = response.tool_calls?.[0].args as
    | z.infer<typeof ARTIFACT_TOOL_SCHEMA>
    | undefined;
  if (!args) {
    throw new Error("No args found in response");
  }

  // 6. 创建工件并返回状态更新
  const newArtifactContent = createArtifactContent(args);
  const newArtifact: ArtifactV3 = {
    currentIndex: 1,
    contents: [newArtifactContent],
  };

  return {
    artifact: newArtifact,
  };
};
```

### 5.2 图间协作

LangGraph 支持图间协作，一个图可以调用另一个图：

```typescript
// apps/agents/src/open-canvas/nodes/reflect.ts
export const reflectNode = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
) => {
  try {
    const langGraphClient = new Client({
      apiUrl: `http://localhost:${process.env.PORT}`,
    });

    const reflectionInput = {
      messages: state._messages,
      artifact: state.artifact,
    };
    const reflectionConfig = {
      configurable: {
        open_canvas_assistant_id: config.configurable?.assistant_id,
      },
    };

    const newThread = await langGraphClient.threads.create();
    // 调用另一个 LangGraph 图
    await langGraphClient.runs.create(newThread.thread_id, "reflection", {
      input: reflectionInput,
      config: reflectionConfig,
      multitaskStrategy: "enqueue",
      afterSeconds: 0,
    });
  } catch (e) {
    console.error("Failed to call reflection graph\n\n", e);
  }

  return {};
};
```

## 6. 实际工作流程

### 6.1 完整流程

1. **用户输入** → LangGraph 接收并路由到相应节点
2. **节点处理** → 使用 LangChain 调用 LLM 模型
3. **模型响应** → LangChain 处理响应并返回结果
4. **状态更新** → LangGraph 更新全局状态
5. **流程控制** → LangGraph 决定下一个节点或结束

### 6.2 状态流转

```
用户消息 → generatePath → 路由决策 → 具体节点 → LangChain调用 → 状态更新 → 下一个节点
    ↓
generateFollowup → reflect → cleanState → generateTitle/summarizer → END
```

## 7. 优势互补

### 7.1 LangChain 的优势

- **统一的模型接口**: 一套 API 支持多个提供商
- **丰富的工具生态**: 内置大量预构建工具
- **标准化的消息格式**: 统一的消息处理机制
- **多提供商支持**: 轻松切换不同的模型提供商
- **工具调用支持**: 原生支持函数调用和工具使用

### 7.2 LangGraph 的优势

- **复杂工作流编排**: 支持条件分支、循环、并行执行
- **状态管理**: 持久化状态和状态更新机制
- **可视化调试**: 提供图形化的工作流调试界面
- **错误处理**: 内置错误处理和重试机制
- **监控和追踪**: 完整的执行追踪和性能监控

## 8. 最佳实践

### 8.1 设计原则

1. **职责分离**: LangGraph 负责流程控制，LangChain 负责模型交互
2. **状态管理**: 使用 LangGraph 的 Annotation 系统管理复杂状态
3. **错误处理**: 在节点级别处理 LangChain 调用错误
4. **性能优化**: 利用 LangGraph 的并行执行能力

### 8.2 开发建议

1. **节点设计**: 每个节点应该专注于单一职责
2. **状态设计**: 状态应该包含所有必要的上下文信息
3. **工具绑定**: 在节点内部进行工具绑定，避免全局绑定
4. **配置管理**: 使用统一的配置系统管理模型参数

## 9. 总结

LangChain 与 LangGraph 的关系是**互补协作**关系：

- **LangChain** 是"工具层"，负责与各种 LLM 提供商交互
- **LangGraph** 是"编排层"，负责管理复杂的 AI 工作流程
- **协作模式**: LangGraph 节点内部使用 LangChain 进行 LLM 交互
- **分层架构**: 上层管理流程，下层处理具体的模型调用

这种设计使得开发者可以：
- 使用 LangChain 的丰富生态快速集成各种模型和工具
- 使用 LangGraph 的流程控制能力构建复杂的 AI 应用
- 在保持代码简洁的同时实现强大的功能
- 通过可视化界面轻松调试和监控工作流执行

通过这种分层协作模式，Open Canvas 项目成功构建了一个功能强大、易于维护的 AI 应用架构。
