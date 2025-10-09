# DashScope 模型配置完成

## 修改总结

已成功将 Fireworks 模型替换为 DashScope 模型，并修复了模型选择器中不显示的问题。

### 1. 模型定义修改 (`packages/shared/src/models.ts`)

- ✅ 将 `FIREWORKS_MODELS` 重命名为 `DASHSCOPE_MODELS`
- ✅ 更新模型名称，添加 `dashscope/` 前缀：
  - `dashscope/qwen-plus` - Qwen-Plus
  - `dashscope/deepseek-v3` - DeepSeek V3  
  - `dashscope/deepseek-r1` - DeepSeek R1
- ✅ 更新类型定义和导出

### 2. 模型选择器修改 (`apps/web/src/components/chat-interface/model-selector/index.tsx`)

- ✅ 将 `fireworksModelGroup` 重命名为 `dashscopeModelGroup`
- ✅ 更新分组标题从 "Fireworks" 改为 "DashScope"
- ✅ 保持过滤条件 `model.name.includes("dashscope/")`

### 3. 后端配置修改 (`apps/agents/src/utils.ts`)

- ✅ 更新条件判断从 `fireworks/` 改为 `dashscope/`
- ✅ 正确解析模型名称，移除 `dashscope/` 前缀
- ✅ 使用 DashScope API 密钥和端点

## 环境变量配置

在 `.env` 文件中添加以下配置：

```bash
# 阿里云 DashScope API 密钥
DASHSCOPE_API_KEY=your_dashscope_api_key

# DashScope 推理端点 URL（可选，会使用默认值）
DASHSCOPE_INFER_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions

# 控制 DashScope 模型是否可用
NEXT_PUBLIC_DASHSCOPE_ENABLED=true
```

## 重启服务

修改完成后需要重启服务：

```bash
# 停止当前服务 (Ctrl+C)
# 重新启动
yarn dev:server
```

## 验证步骤

1. **检查模型选择器**：在界面左上角点击模型选择器，应该能看到 "DashScope" 分组
2. **查看模型列表**：DashScope 分组下应该显示：
   - Qwen-Plus
   - DeepSeek V3
   - DeepSeek R1
3. **测试模型调用**：选择任意 DashScope 模型，发送测试消息验证是否正常工作

## 故障排除

如果模型仍然不显示，请检查：

1. **环境变量**：确认 `NEXT_PUBLIC_DASHSCOPE_ENABLED=true` 已设置
2. **服务重启**：确认已重启 LangGraph 服务
3. **API 密钥**：确认 `DASHSCOPE_API_KEY` 有效
4. **网络连接**：确认可以访问 DashScope 服务

## 模型映射

| 前端显示名称 | 模型标识符 | 实际调用模型 |
|-------------|-----------|-------------|
| Qwen-Plus | `dashscope/qwen-plus` | `qwen-plus` |
| DeepSeek V3 | `dashscope/deepseek-v3` | `deepseek-v3` |
| DeepSeek R1 | `dashscope/deepseek-r1` | `deepseek-r1` |

现在 DashScope 模型应该能正常显示在模型选择器中，并且可以正常使用了！
