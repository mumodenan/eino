# 初学者常见问题

## 创建 ChatModelAgent 后，为什么还需要 Runner？

ChatModelAgent 负责“模型如何调用工具并产生事件”；Runner 负责“应用如何开始一次执行，以及中断后怎样持久化/恢复”。

直接 `agent.Run` 在简单测试中可行，但不会自动建立完整 root session、flowAgent 历史与根 checkpoint 管理。正式入口建议使用 Runner。

## 一个 Runner 能执行多个 Agent 吗？

RunnerConfig 只保存一个根 Agent。但根 Agent 可以是 Sequential/Parallel/Loop，可以拥有 SubAgents，也可以用 AgentTool 调用其他 Agent，因此一棵 Agent 系统只需要一个顶层 Runner。

如果是彼此完全独立的业务入口，可以创建多个 Runner。

## Runner 可以并发复用吗？

从源码结构看，每次 Run 都新建 runContext 和 runSession，Runner 自身只持有 Agent、streaming 配置和 store，因此设计目标是可复用。实际并发安全还取决于根 Agent、ChatModel、Tool 和 CheckPointStore 实现。

尤其要避免不同请求使用相同 checkpoint ID，避免 store 相互覆盖。

## ChatModelAgent 可以并发复用吗？

请求级 ReAct state 在 Graph 运行 context 中创建，不存在 ChatModelAgent struct 上。`buildRunFunc` 用 sync.Once，关系冻结后可复用。

但 Model/Tool/Middleware 闭包若包含可变共享字段，仍需自行保证线程安全。

## 为什么 ChatModelAgent 第一次 Run 后不能再 SetSubAgents？

第一次 Run 会根据 subAgents 生成 transfer instruction、注入 transfer tool 并构建 runFunc。如果之后修改子 Agent，已构建的工具集合和实际路由关系会不一致，所以用 frozen 阻止。

正确顺序是：创建全部 Agent → 设置关系 → 创建 Runner → 开始 Run。

## ChatModelAgent 没有 Tool 时还会用 ReAct Graph 吗？

不会。最终工具集合为空时走简单 Chain：输入生成 Lambda → ChatModel。有普通 Tool、Transfer Tool 或 Exit Tool 时才走 ReAct。

## Agent 与 flowAgent 是一个对象吗？

不是。flowAgent 是内部 wrapper，嵌入用户 Agent，并增加子/父关系、历史、路径、Transfer 和恢复路由。Runner 会自动调用 `toFlowAgent`。

## AgentEvent 为什么同时有 Output、Action 和 Err？

因为一次工作动态可能同时表达“工具返回了什么”和“这个结果要求转交/退出”。Err 则表示失败。三者不是互斥的 union，消费端要分别检查。

## EnableStreaming=false 时为什么还是 Iterator？

非流式只表示每条模型/工具消息是完整值。一次 Agent 仍可能经历多轮 Model → Tool → Model，因此仍需要多个 AgentEvent。

## 为什么最终答案有时不是最后一个事件？

最后可能是 Exit Action、Transfer Tool event、Interrupt 或 CustomizedOutput。正确消费方式是按事件类型处理，不用“取最后一个事件”的假设。

## 为什么读取 MessageStream 后其他地方没有内容了？

StreamReader 是一次消费对象。需要两处消费时必须 Copy。使用 `adk.GetMessage` 时，它会为你复制一份并保留原事件可继续消费。

## Agent 会自动记住上一次 Query 吗？

不会。Runner.Run 每次创建新 session。把历史保存在外部存储，并在下一次 Run 时作为 messages 传入。

## Session Values 能当数据库吗？

不能。它是单次运行的共享 KV，只有发生 checkpoint 时随现场序列化。它没有查询、事务、过期、租户隔离等数据库能力。

## OutputKey 有什么用？

把 ChatModelAgent 最终 Message.Content 写进 session values，供后续 workflow Agent 读取。它不是对用户发送答案的开关；答案仍由 event sender 写成 `AgentEvent` 输出。

## Name 重复会怎样？

编译器不一定在所有组合中主动报错，但 Transfer 目标、DesignateAgent、AgentTool tool name 和 RunPath 都依赖 Name。可达 Agent 树内应该唯一。

## Description 只是文档吗？

不是。它会进入 AgentTool/子 Agent 能力描述，影响模型选择哪个 Agent。应该明确写能力、输入范围和不擅长的事情。

## 子 Agent 是由父 Agent 直接调用吗？

有两种方式：Transfer 是 flowAgent 把控制权交给目标；AgentTool 是父 ReAct ToolsNode 把子 Agent 当工具调用。前者共享同一 Agent 流程，后者有工具边界和 Action 隔离。

## Exit、BreakLoop、Transfer 有什么差别？

- Exit：结束当前 Agent 控制范围；
- BreakLoop：只要求当前 Loop 停止，并标记已处理；
- Transfer：当前 Agent 结束后在同一 session 中运行另一个 Agent；
- AgentTool 内的这些 Action 不会穿透父工具边界。

## Interrupt 和 error 有什么差别？

error 表示执行失败；interrupt 表示执行暂停，现场可保存，等待外部数据后继续。把人工审批建模成 error 会丢失可恢复语义。

## 为什么需要 StatefulInterrupt？

如果恢复时只知道“用户批准了”，但不知道中断前正在处理哪个对象，就无法继续。StatefulInterrupt 同时保存用户可见 info 和组件内部 state。

## Resume 和 ResumeWithParams 怎么选？

- `Resume`：一个“继续”按钮，隐式允许所有中断点继续；
- `ResumeWithParams`：多个中断点或需要审批数据时，按 interrupt ID 精确传值。

复杂系统优先显式目标恢复。

## 为什么 Resume 要使用同一个 Runner/Agent 配置？

Checkpoint 保存运行状态，不保存可执行代码、模型客户端或工具实例。恢复时仍需要同样结构的 Agent 树来解释地址和 state。部署升级要注意 checkpoint schema 与 Agent 拓扑兼容。

## Checkpoint ID 谁生成？

应用通过 `WithCheckPointID` 提供。应在业务范围内唯一，例如 request/task ID。Runner 不负责自动清理旧 checkpoint。

## ParallelAgent 是否会自动合并回答？

不会。它并发透传子 Agent 事件，并在 session 中合并历史。如果要一个统一答案，应在 Parallel 后放一个汇总 Agent，例如 Sequential(Parallel(...), Synthesizer)。

## ParallelAgent 的 Session Values 是否隔离？

不隔离。各 lane 共享 Values map 和 mutex，但事件先写各自 LaneEvents。并行写同 key 会有不确定的最终值。

## Middleware 一次 Run 只执行一次吗？

新版 `BeforeAgent` / `AfterAgent` 是 Run 级：前者每次 Run/Resume 开始执行，后者只在成功终态执行。`BeforeModelRewriteState` / `AfterModelRewriteState` 是模型轮次级，一次 ReAct 可能执行很多次。四类 Tool wrapper 则按每个 ToolCall 执行。

兼容的旧 `AdditionalInstruction/Tools` 在运行准备时折叠，旧 `Before/AfterChatModel` 仍按模型轮次执行。两代模型 state hook 都包在内部 retry 外，不会因同一轮 provider retry 而重复。精确顺序见 [Middleware 新旧 API](./middleware-current.md)。

## Middleware 和 Callback 有什么区别？

Middleware 可修改运行配置、模型历史、Model、Tool 参数/结果/错误，甚至不调用 `next`。Callback 主要用于观测，Handler 只返回 Context，不返回新 output/error。当前 ADK 由 event sender wrappers 产生模型/工具 `AgentEvent`，Agent Callback 则能独立观察整条事件流。

## 在 ChatModelAgent.Run 时怎么传入用户 Callback？

使用 `adk.WithCallbacks(handler...)`：

```go
events := runner.Run(ctx, messages, adk.WithCallbacks(handler))
```

这是 Agent 级 callback，OnStart 可得到 Input 或 ResumeInfo，OnEnd 可得到一份独立的 `AgentEvent` iterator，必须异步消费。进程级 tracing/metrics 仍可用 `callbacks.AppendGlobalHandlers`；直接使用 compose runnable 时则可用 `compose.WithCallbacks` 指定 Graph/Node。完整边界见 [Callback 与 AgentEvent](./callbacks.md)。

## ModelRetry 会不会重跑 Tool？

不会。它包装的是 ChatModel 调用。Tool 已成功后下一轮模型失败，重试该模型边界，而不是重做上一工具操作。

## flow/agent/react 和 adk.ChatModelAgent 怎么选？

新的事件化、多 Agent、Action 和恢复场景优先 ADK ChatModelAgent。`flow/agent/react` 对外更像传统 Generate/Stream Agent，适合已有 flow API 集成或兼容代码。

## 自定义 Agent 一定要实现 Resume 吗？

不一定。只有它可能成为中断链上的实际恢复点时才需要 `ResumableAgent`。如果非可恢复 Agent 自己发生中断，flowAgent.Resume 会明确报错。

## 如何调试“某个 Option 没生效”？

依次检查：

1. Option 类型是否对应目标 Agent；
2. DesignateAgent 名字是否完全匹配；
3. 是否经过 AgentTool，需要放入 WithAgentToolRunOptions；
4. model/tool Option 是否被 `getComposeOptions` 转换；
5. 是否在构造期应该使用 Middleware，而误用了调用期 Option。

## 如何决定使用 Workflow、Transfer 还是 AgentTool？

- 固定先后/并行/循环：Workflow；
- 让模型在一组同级 Agent 中决定下一位：Transfer；
- 父 Agent 只需要子 Agent 的最终结果，且要隔离控制动作：AgentTool；
- 中心协调成员：Supervisor prebuilt；
- 明确计划—执行—复盘：Plan-Execute prebuilt。
