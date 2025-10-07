# Open Canvas 技术文档索引

## 文档概述

本目录包含了 Open Canvas 项目的技术分析文档，涵盖了架构设计、技术选型、实现细节等各个方面。

## 文档列表

### 1. [LangChain 与 LangGraph 关系分析](./LangChain与LangGraph关系分析.md)

**内容概要**:
- LangChain 与 LangGraph 的基本关系和定位
- 在 Open Canvas 项目中的具体体现
- 协作模式和架构设计
- 实际工作流程分析
- 优势互补和最佳实践

**适用人群**: 架构师、后端开发者、AI 应用开发者

**关键要点**:
- LangChain 负责 LLM 交互，LangGraph 负责工作流编排
- 分层协作模式：LangGraph 节点内部使用 LangChain
- 多图协作和状态管理机制

### 2. [模型配置与 API 端点分析](./模型配置与API端点分析.md)

**内容概要**:
- `getModelConfig` 函数的详细分析
- 各模型提供商的配置方式
- 默认 API 端点机制
- 环境变量配置
- 特殊情况处理（如 Ollama 的 baseUrl 设置）

**适用人群**: 后端开发者、DevOps 工程师、系统管理员

**关键要点**:
- 只有 Ollama 模型设置了 baseUrl，其他使用默认端点
- LangChain Universal Chat Models 自动处理端点选择
- 环境变量控制模型启用和配置

### 3. [技术架构总览](./技术架构总览.md)

**内容概要**:
- 整体系统架构和组件关系
- 前端和后端技术栈分析
- 数据流和状态管理
- 安全架构和性能优化
- 部署架构和扩展性设计

**适用人群**: 技术负责人、架构师、全栈开发者

**关键要点**:
- 基于 Next.js + LangGraph + LangChain 的现代化架构
- 多图协作和复杂状态管理
- 完善的监控、调试和部署方案

### 4. [LLM 产品监控系统选择指南](./LLM产品监控系统选择指南.md)

**内容概要**:
- LLM 产品监控需求分析
- 开源监控解决方案对比
- 自建监控系统架构设计
- 具体实施方案和选择建议
- 分阶段实施步骤指导

**适用人群**: 技术负责人、架构师、DevOps 工程师、LLM 应用开发者

**关键要点**:
- Langfuse 作为首选开源监控解决方案
- 基于开源工具的定制化开发策略
- 分阶段实施监控体系的完整方案

## 技术栈概览

### 前端技术
- **框架**: Next.js 14 + React + TypeScript
- **样式**: Tailwind CSS + Framer Motion
- **状态管理**: React Context + Zustand
- **UI 组件**: 自定义组件库

### 后端技术
- **工作流引擎**: LangGraph
- **LLM 集成**: LangChain
- **运行时**: Node.js + TypeScript
- **数据库**: Supabase PostgreSQL
- **认证**: Supabase Auth

### 外部服务
- **模型提供商**: OpenAI, Anthropic, Google, Fireworks, Groq, Ollama
- **追踪服务**: LangSmith
- **文件存储**: Supabase Storage

## 核心概念

### LangGraph 工作流
- **节点 (Nodes)**: 执行具体任务的函数
- **边 (Edges)**: 定义节点间的执行顺序
- **条件边 (Conditional Edges)**: 基于状态的条件路由
- **状态 (State)**: 图执行过程中的数据状态

### LangChain 集成
- **模型配置**: 统一的模型提供商接口
- **工具绑定**: 函数调用和工具使用
- **消息处理**: 标准化的消息格式
- **流式处理**: 实时数据流处理

### 状态管理
- **图状态**: LangGraph 运行时状态
- **持久化状态**: Supabase 数据库存储
- **会话状态**: 浏览器本地存储
- **用户状态**: 用户配置和偏好

## 开发指南

### 环境设置
1. 安装依赖: `yarn install`
2. 配置环境变量: 复制 `.env.example` 到 `.env`
3. 启动 LangGraph 服务: `yarn dev:server`
4. 启动前端应用: `yarn dev`

### 模型配置
1. 在 `packages/shared/src/models.ts` 中添加新模型
2. 在 `apps/agents/src/utils.ts` 中配置模型提供商
3. 设置相应的环境变量
4. 测试模型调用功能

### 添加新节点
1. 在 `apps/agents/src/open-canvas/nodes/` 中创建节点文件
2. 实现节点函数，使用 LangChain 进行模型调用
3. 在 `apps/agents/src/open-canvas/index.ts` 中注册节点
4. 配置节点间的边和条件路由

## 常见问题

### Q: 如何添加新的模型提供商？
A: 参考文档 2 中的模型配置分析，在 `getModelConfig` 函数中添加新的条件分支，配置相应的 API 端点和认证信息。

### Q: 如何调试 LangGraph 工作流？
A: 使用 LangGraph Studio 进行可视化调试，或者通过 LangSmith 进行执行追踪。

### Q: 如何处理模型调用失败？
A: 在节点内部实现错误处理逻辑，使用 try-catch 包装模型调用，提供适当的回退机制。

### Q: 如何优化性能？
A: 参考文档 3 中的性能优化章节，包括并行执行、状态缓存、连接池等策略。

## 贡献指南

### 代码规范
- 使用 TypeScript 进行类型安全开发
- 遵循 ESLint 和 Prettier 配置
- 编写清晰的注释和文档
- 保持代码的模块化和可测试性

### 测试要求
- 为新功能编写单元测试
- 确保集成测试的覆盖率
- 进行端到端测试验证

### 文档更新
- 及时更新相关技术文档
- 保持文档的准确性和完整性
- 提供清晰的示例和说明

## 联系方式

如有技术问题或建议，请通过以下方式联系：

- **GitHub Issues**: 项目仓库的 Issues 页面
- **技术讨论**: 项目仓库的 Discussions 页面
- **邮件联系**: 项目维护者邮箱

---

*最后更新时间: 2024年12月*
