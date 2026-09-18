# ADK 模块覆盖审计

这一页回答一个可验证的问题：当前 `adk/` 下每组生产代码，在本站是否都有阅读入口？

校验基线为 `main@c5c2dc3`（2026-09-17）。范围是 `adk/` 下除 `*_test.go` 外的 Go 源码。“覆盖”表示对应机制、执行阶段和源码入口已说明，不代表逐行复述实现。

## 1. 审计结论

| 类别 | 当前状态 | 主要入口 |
| --- | --- | --- |
| Agent/Runner/Event 泛型协议 | 已覆盖 | [Typed Agent](./typed-agent-agentic.md)、[Runner](./runner-context.md)、[Event](./events.md) |
| ChatModelAgent/ReAct | 已按新 API 覆盖 | [ChatModelAgent](./chat-model-agent.md)、[ReAct](./react.md) |
| Handler Middleware | 已覆盖 | [新旧 Middleware](./middleware-current.md)、[内置 Middleware](./builtin-middlewares.md) |
| Agent Callback | 已覆盖 | [Callback 与 AgentEvent](./callbacks.md) |
| Retry/Failover | 已覆盖 | [ChatModelAgent](./chat-model-agent.md) |
| Cancel/TurnLoop | 已覆盖 | [Cancel 与 TurnLoop](./cancel-turn-loop.md) |
| Workflow/Transfer/AgentTool | 已覆盖，并标注当前官方定位 | [Workflow](./workflows.md)、[AgentTool](./tools-transfer.md) |
| Interrupt/Checkpoint/Resume | 已覆盖 | [中断恢复](./interrupt-resume.md) |
| 八类内置 Middleware | 已覆盖 | [内置 Middleware](./builtin-middlewares.md) |
| Prebuilt | 已覆盖 | [Prebuilt](./prebuilt.md) |

## 2. 核心协议与运行时文件

| 源码 | 核心责任 | 文档入口 |
| --- | --- | --- |
| `interface.go` | `MessageType`、TypedAgent/ResumableAgent、Input/Event/Action、MessageVariant | [Typed Agent](./typed-agent-agentic.md)、[事件](./events.md)、[术语](./glossary.md) |
| `runner.go` | TypedRunner、Run/Query/Resume、事件中继、checkpoint 保存 | [Runner](./runner-context.md)、[生命周期](./lifecycle.md)、[恢复](./interrupt-resume.md) |
| `runctx.go` | runContext/runSession、事件账本、KV、并行 lane fork/join | [Context](./context-flow.md)、[状态与记忆](./state-and-memory.md) |
| `flow.go` | flowAgent、历史重写、事件归属、Transfer | [生命周期](./lifecycle.md)、[AgentTool 与转交](./tools-transfer.md) |
| `utils.go` | AsyncIterator/Generator、Event/Message 转换 | [事件](./events.md)、[第一个 Agent](./first-agent.md) |
| `instruction.go` | Instruction 拼接与输入准备辅助 | [Config 转换](./config-option-flow.md) |
| `internal/config.go` | 全局内部配置 | [内置 Middleware](./builtin-middlewares.md) |
| `internal/message_id.go` | Message ID 生成与补齐 | [事件](./events.md)、[ChatModelAgent](./chat-model-agent.md) |

## 3. ChatModelAgent 主链

| 源码 | 核心责任 | 文档入口 |
| --- | --- | --- |
| `chatmodel.go` | TypedChatModelAgent 构造、Run/Resume、经典/Agentic 分流、Handler 装配 | [ChatModelAgent](./chat-model-agent.md)、[Typed Agent](./typed-agent-agentic.md) |
| `react.go` | 两类消息的 ReAct 图、状态分支、安全点 cancel | [ReAct](./react.md)、[Cancel](./cancel-turn-loop.md) |
| `handler.go` | 新 Middleware interface、Base 实现、run-local state、SendEvent | [Middleware 新旧 API](./middleware-current.md) |
| `wrappers.go` | Model/Tool wrapper 链、event sender、重试结果拦截、取消监控 | [Middleware](./middleware-current.md)、[Callback](./callbacks.md) |
| `retry_chatmodel.go` | 输入/输出感知的模型重试、退避、输入修改 | [ChatModelAgent](./chat-model-agent.md) |
| `failover_chatmodel.go` | 多模型 failover、选择与 last-success | [ChatModelAgent](./chat-model-agent.md) |

## 4. Option、Callback、取消与持续运行

| 源码 | 核心责任 | 文档入口 |
| --- | --- | --- |
| `call_option.go` | AgentRunOption、DesignateAgent、WithCallbacks 等 option 分发 | [Config/Option](./config-option-flow.md)、[Callback](./callbacks.md) |
| `callback.go` | Agent callback Input/Output、经典/Agentic 转换、事件 iterator copy | [Callback 与 AgentEvent](./callbacks.md) |
| `cancel.go` | WithCancel、三类模式、取消状态机、CancelError | [Cancel 与 TurnLoop](./cancel-turn-loop.md) |
| `turn_buffer.go` | TurnLoop 并发 buffer、关闭/唤醒/回推 | [Cancel 与 TurnLoop](./cancel-turn-loop.md) |
| `turn_loop.go` | Push/Preempt/Stop/Wait、item bookkeeping、自动恢复 | [Cancel 与 TurnLoop](./cancel-turn-loop.md) |
| `config.go` | 全局 Language 配置 | [内置 Middleware](./builtin-middlewares.md) |

## 5. 组合、Tool 与恢复

| 源码 | 核心责任 | 文档入口 |
| --- | --- | --- |
| `agent_tool.go` | Agent 包装成 Tool、option 桥、事件和中断边界 | [AgentTool](./tools-transfer.md)、[Config 转换](./config-option-flow.md) |
| `deterministic_transfer.go` | 不依赖模型选择的确定性转交 | [AgentTool 与转交](./tools-transfer.md) |
| `workflow.go` | Sequential/Parallel/Loop Agent | [Workflow](./workflows.md)、[完整案例](./workflow-case-study.md) |
| `interrupt.go` | ADK/Compose interrupt 互转、resume target、checkpoint schema | [中断恢复](./interrupt-resume.md) |

::: warning 当前官方定位
Transfer 与 Workflow API 仍存在，但当前源码多处标注 `NOT RECOMMENDED`：多数新场景优先使用 ChatModelAgent + AgentTool，复杂通用 Agent 优先参考 DeepAgent。文档保留 Workflow 深入分析，是为了理解已有系统与适用的确定性控制流，不代表默认推荐。
:::

## 6. Filesystem 基础层

| 源码 | 核心责任 | 文档入口 |
| --- | --- | --- |
| `filesystem/backend.go` | 文件、Shell、多模态读取等 Backend 协议 | [内置 Middleware](./builtin-middlewares.md) |
| `filesystem/backend_inmemory.go` | 内存实现、路径与查询顺序 | [内置 Middleware](./builtin-middlewares.md) |

注意它们位于 `adk/filesystem`，而不是旧文档写的 `adk/middlewares/filesystem/backend_inmemory.go`。后者已从当前源码删除。

## 7. 八类内置 Middleware

### 7.1 历史与上下文治理

| 源码组 | 核心责任 | 执行阶段 |
| --- | --- | --- |
| `middlewares/patchtoolcalls/patchtoolcalls.go` | 补齐悬空 tool call/result | 模型前 |
| `middlewares/agentsmd/{agentsmd,loader}.go` | 加载、import、缓存并注入 Agents.md；当前实现会写回 Agent state | 模型前 |
| `middlewares/summarization/*` | token 触发、摘要模型、failover、finalizer、内部事件 | 模型前 |
| `middlewares/reduction/reduction.go` | 新版截断、卸载、清理主实现 | Tool 后 + 模型前 |
| `middlewares/reduction/internal/*` | 旧算法和新版内部处理器 | 兼容/内部 |
| `middlewares/reduction/legacy.go` | 旧构造方式的兼容入口 | 兼容 |

### 7.2 能力装配与渐进披露

| 源码组 | 核心责任 | 执行阶段 |
| --- | --- | --- |
| `middlewares/filesystem/filesystem.go` | 注入文件/可选 shell 工具 | Agent 前 |
| `middlewares/filesystem/backend.go` | 旧 Backend 名称兼容层 | 兼容 |
| `middlewares/filesystem/large_tool_result.go` | 旧式大结果卸载 | 兼容 Tool wrapper |
| `middlewares/filesystem/prompt.go` | 文件工具提示词 | 构造/Agent 前 |
| `middlewares/dynamictool/toolsearch/*` | 动态工具检索、可见集和提示 | Agent 前 + 模型前 |
| `middlewares/skill/skill.go` | inline/fork/fork_with_context、AgentHub/ModelHub | Agent 前 + Model/Tool |
| `middlewares/skill/filesystem_backend.go` | 从 filesystem Backend 读取 Skill | Backend 适配 |
| `middlewares/skill/{doc,prompt}.go` | Frontmatter 文档和多语言提示 | 构造期 |
| `middlewares/plantask/*` | 四个 Task Tool 与 Backend 状态 | Agent 前 + Tool 调用 |

所有组统一详解在 [内置 Middleware](./builtin-middlewares.md)。

## 8. Prebuilt 文件

| 源码 | 核心责任 | 文档入口 |
| --- | --- | --- |
| `prebuilt/supervisor/supervisor.go` | ChatModelAgent + subagents 调度组装 | [Prebuilt](./prebuilt.md) |
| `prebuilt/planexecute/plan_execute.go` | Planner/Executor/Replanner 状态机 | [Prebuilt](./prebuilt.md) |
| `prebuilt/deep/deep.go` | DeepAgent 主装配 | [Prebuilt](./prebuilt.md) |
| `prebuilt/deep/task_tool.go` | task Tool、general subagent、AgentTool | [Prebuilt](./prebuilt.md)、[AgentTool](./tools-transfer.md) |
| `prebuilt/deep/types.go` | DeepAgent 对外类型 | [Prebuilt](./prebuilt.md) |
| `prebuilt/deep/prompt.go` | DeepAgent 策略提示 | [Prebuilt](./prebuilt.md) |

## 9. ADK 依赖的跨包机制

ADK 的执行路径不止在 `adk/`：

| 跨包模块 | ADK 使用的能力 | 文档入口 |
| --- | --- | --- |
| `components/model` | BaseModel、BaseChatModel、AgenticModel、model options | [Typed Agent](./typed-agent-agentic.md)、[ChatModelAgent](./chat-model-agent.md) |
| `components/tool` | BaseTool、四类执行端点、ToolInfo | [AgentTool](./tools-transfer.md)、[Middleware](./middleware-current.md) |
| `compose/graph_run.go` | task、state、checkpoint、resume | [Context](./context-flow.md)、[ReAct](./react.md) |
| `compose/tool_node.go` | Tool wrappers、并行调用、interrupt rerun | [ReAct](./react.md)、[Middleware](./middleware-current.md) |
| `callbacks/` + `internal/callbacks/` | 组件 callback manager 与 stream copy | [Callback](./callbacks.md)、[核心 Callback](../core/callbacks.md) |
| `schema/message.go` / `agentic_message.go` | 两类消息协议 | [Typed Agent](./typed-agent-agentic.md) |
| `schema/stream.go` | StreamReader 复制、转换、合并 | [流处理](../core/streaming.md)、[事件](./events.md) |

## 10. 为什么不按文件一对一建章

例如一次 Tool event 同时经过：

```text
adk/chatmodel.go       组织静态与运行期配置
adk/handler.go         声明 Middleware 契约
adk/wrappers.go        生成 handler wrapper 与 event sender
compose/tool_node.go   绑定、并发执行 Tool endpoint
adk/react.go           收集结果、更新 state、判断安全点
adk/callback.go        把 Agent 事件暴露给 callback
schema/stream.go       复制一次性流
```

若强制“一文件一章”，初学者会得到很多局部事实，却看不到一次请求怎样穿过它们。因此正文按生命周期组织，本页负责从文件名反向导航。

## 11. 持续维护检查表

源码升级时应同时完成：

1. 用 `find adk -name '*.go' ! -name '*_test.go'` 对比本页文件组；
2. 检查公开 Config 新字段、Deprecated 注释和默认值；
3. 检查 Context key、wrapper 顺序和 event 语义是否改变；
4. 对新增类型补“与现有组件的区别”，不能只列 API；
5. 从测试中验证正常、错误、流式、并行、中断和恢复边界；
6. 运行 VitePress build，并扫描文档中的源码路径是否真实存在；
7. 更新 [最新源码校验报告](./latest-source-audit.md) 的基线和变更结论。
