# ADK Demo 阶梯：从一个事件到可恢复的 Agent

如果只读源码，ADK 的对象会显得很多。本页提供一条增量 Demo 路线：每一步都在上一段代码上增加一个能力，并说明新增对象、执行阶段和状态位置。

> 建议先运行第 1 个 Demo，再逐步复制后面的代码。不要一开始就把所有 Middleware、Workflow 和 checkpoint 一起加入；否则很难知道每个组件到底改变了什么。

## Demo 0：先运行最小 Echo Agent

完整代码已经放在[第一个可运行 Agent](./first-agent.md)：它不用模型，只实现 `Agent` 接口，发送“处理中”和最终回答两个 `AgentEvent`。

```text
Agent.Run
  → NewAsyncIteratorPair
  → goroutine 中 Send(event)
  → Close(generator)
  → Runner / 应用通过 Next() 消费
```

这一 demo 只需要理解三件事：

- Agent 返回的是事件迭代器，不是一个字符串；
- `Run` 通常立即返回，真正工作在 goroutine 中进行；
- `Close` 是消费者看到 `ok=false` 的结束信号。

## Demo 1：把 Echo Agent 放进 Runner

```go
ctx := context.Background()

runner := adk.NewRunner(ctx, adk.RunnerConfig{
    Agent: EchoAgent{},
})

iter := runner.Query(ctx, "你好，Eino")
for {
    event, ok := iter.Next()
    if !ok {
        break
    }
    if event.Err != nil {
        log.Println("error:", event.Err)
        continue
    }
    if event.Output != nil && event.Output.MessageOutput != nil {
        msg, _, _ := adk.GetMessage(event)
        log.Println("answer:", msg.Content)
    }
}
```

新增的不是业务能力，而是运行语义：

```text
Runner
  → root runContext
  → root runSession
  → flowAgent 补 AgentName / RunPath
  → 统一处理事件归属
```

对比直接调用 `EchoAgent{}.Run(...)`，Runner 版本才有完整的根输入、session、RunPath 和统一 checkpoint 入口。

## Demo 2：让 Agent 读写 Session Value

先在调用方注入本次运行的值：

```go
iter := runner.Query(ctx, "查订单", adk.WithSessionValues(map[string]any{
    "tenant": "acme",
}))
```

在自定义 Agent 或 Tool 中读取：

```go
tenant, ok := adk.GetSessionValue(ctx, "tenant")
if !ok {
    return fmt.Errorf("tenant is missing")
}

adk.AddSessionValue(ctx, "route", "order-service")
```

这一 demo 的状态位置是：

```text
ctx
 └─ runContext
     └─ runSession.Values
```

它适合放本次 Agent 树共享的、可序列化的小数据，例如租户、计划、路由结果和中间 ID；不适合放数据库连接、HTTP client、锁或整个大文件内容。

## Demo 3：换成 ChatModelAgent

模型实例的创建依赖具体 provider，这里只展示 ADK 的装配边界：

```go
agent, err := adk.NewChatModelAgent(ctx, &adk.ChatModelAgentConfig{
    Name:        "assistant",
    Description: "回答用户问题",
    Instruction: "你是一个简洁、可靠的助手。",
    Model:       chatModel, // 具体 provider 创建的 model.BaseChatModel
})
if err != nil {
    panic(err)
}

runner := adk.NewRunner(ctx, adk.RunnerConfig{Agent: agent})
iter := runner.Query(ctx, "什么是 RunPath？")
```

现在一次请求多了一层：

```text
AgentInput.Messages
  → GenModelInput
      [System instruction] + [用户消息]
  → compose Graph
  → ChatModel
  → AgentEvent
```

注意：`ChatModelAgent` 不是模型本身。模型只负责一次 Generate/Stream，ChatModelAgent 负责输入构造、ReAct 循环、Tool、Middleware、事件和恢复。

## Demo 4：加入一个最简单的 Tool

真实 Tool 需要实现 `tool.BaseTool` 的方法。为了突出执行链，可以先使用仓库已有的 Tool 实现：

```go
agent, err := adk.NewChatModelAgent(ctx, &adk.ChatModelAgentConfig{
    Name:  "order_assistant",
    Model: chatModel,
    ToolsConfig: adk.ToolsConfig{
        Tools: []tool.BaseTool{orderLookupTool},
    },
})
```

一次 ReAct 轮次变成：

```text
ChatModel
  → assistant(tool_call)
  → ToolsNode
  → Tool result
  → state.Messages 追加两条消息
  → 下一次 ChatModel
```

这时要区分两件事：

- Tool 的真实执行逻辑属于 Tool；
- Tool 调用结果进入下一轮模型上下文，属于 ChatModelAgent 的 state。

Tool 不应该偷偷维护全局对话历史；如果需要共享的小结果，可以通过 `AddSessionValue` 或明确的外部 Store 传递。

## Demo 5：观察事件，而不是猜模型做了什么

```go
for {
    event, ok := iter.Next()
    if !ok {
        break
    }

    fmt.Printf("agent=%s path=%v action=%v\n",
        event.AgentName, event.RunPath, event.Action)

    if event.Output != nil && event.Output.MessageOutput != nil {
        msg, _, err := adk.GetMessage(event)
        if err == nil && msg != nil {
            fmt.Printf("role=%s content=%q\n", msg.Role, msg.Content)
        }
    }
}
```

建议记录这些字段：

| 字段 | 能回答什么问题 |
| --- | --- |
| `AgentName` | 哪个 Agent 产生了消息 |
| `RunPath` | 它在 Agent 树的哪一层 |
| `Output.MessageOutput` | 这是 assistant 还是 tool 消息 |
| `Action` | 是否 Transfer、Exit、Interrupt |
| `Err` | 错误发生在哪个事件边界 |

先通过事件观察，再决定要不要引入 Callback。Callback 更适合统一 trace、指标和观察，不负责替换下一轮 state。

## Demo 6：加入新版 Middleware，裁剪当前模型窗口

新版 Middleware 放在 `Handlers`，不再使用已 Deprecated 的 `Middlewares` 字段：

```go
type TrimHistory struct {
    *adk.BaseChatModelAgentMiddleware
}

func (m *TrimHistory) BeforeModelRewriteState(
    ctx context.Context,
    state *adk.ChatModelAgentState,
    mc *adk.ModelContext,
) (context.Context, *adk.ChatModelAgentState, error) {
    next := *state
    if len(next.Messages) > 12 {
        next.Messages = append(
            []*schema.Message{next.Messages[0]},
            next.Messages[len(next.Messages)-11:]...,
        )
    }
    return ctx, &next, nil
}

mw := &TrimHistory{
    BaseChatModelAgentMiddleware: &adk.BaseChatModelAgentMiddleware{},
}

agent, err := adk.NewChatModelAgent(ctx, &adk.ChatModelAgentConfig{
    Model:    chatModel,
    Handlers: []adk.ChatModelAgentMiddleware{mw},
})
```

这个例子是机械裁剪，只保留 system 和最近消息。它说明：

```text
每次模型调用前
  → middleware 读取 state.Messages
  → 返回新 state
  → 新 state 成为后续模型轮次的事实来源
```

生产代码不能只按条数切，因为可能切断 assistant tool-call 与 tool-result 的配对。更完整的实现应使用仓库的 `reduction` 或 `summarization` middleware。

## Demo 7：区分 Reduction 与 Summary

### 7.1 大 Tool 结果：Reduction

```go
mw, err := reduction.New(ctx, &reduction.Config{
    Backend:           backend,
    MaxLengthForTrunc: 50_000,
    MaxTokensForClear: 160_000,
})
```

它分两步：

```text
Tool 刚返回且结果过大
  → 完整结果写 Backend
  → state 中替换为读取提示

下一次模型调用前历史仍过长
  → 清理较老 Tool-call/result round
```

### 7.2 语义压缩：Summarization

```go
summaryMW, err := summarization.New(ctx, &summarization.Config{
    Model: summaryModel,
})

agent, err := adk.NewChatModelAgent(ctx, &adk.ChatModelAgentConfig{
    Model:    chatModel,
    Handlers: []adk.ChatModelAgentMiddleware{summaryMW},
})
```

Summary 会在 token 超过阈值时调用摘要模型，再用 summary + recent messages 替换当前历史。它不是简单删除，也不是跨请求长期记忆；长期记忆仍应由应用 Store 维护。

## Demo 8：加入 Sequential Workflow

```go
pipeline, err := adk.NewSequentialAgent(ctx, &adk.SequentialAgentConfig{
    Name:        "pipeline",
    Description: "先提取，再生成回答",
    SubAgents: []adk.Agent{
        extractorAgent,
        writerAgent,
    },
})

runner := adk.NewRunner(ctx, adk.RunnerConfig{Agent: pipeline})
iter := runner.Query(ctx, "分析这份订单")
```

新增的是控制流，不是另一种消息协议：

```text
父 runContext/session
  → extractor flowAgent
  → session.Events 记录已完成事件
  → writer flowAgent 从 RootInput + Events 重建输入
```

Sequential 的 child 仍然是 Agent；Workflow 负责“何时运行谁”，ChatModelAgent 负责“模型如何循环”。

## Demo 9：给中断加上内存 Checkpoint

真实服务应该使用 Redis、数据库或其他持久化实现；学习时可以先写一个进程内 store：

```go
type MemoryStore struct {
    mu   sync.Mutex
    data map[string][]byte
}

func (s *MemoryStore) Get(ctx context.Context, key string) ([]byte, bool, error) {
    s.mu.Lock()
    defer s.mu.Unlock()
    b, ok := s.data[key]
    return append([]byte(nil), b...), ok, nil
}

func (s *MemoryStore) Set(ctx context.Context, key string, b []byte) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.data[key] = append([]byte(nil), b...)
    return nil
}
```

Runner 配置和 checkpoint ID：

```go
store := &MemoryStore{data: map[string][]byte{}}
runner := adk.NewRunner(ctx, adk.RunnerConfig{
    Agent:           approvalAgent,
    CheckPointStore: store,
})

iter := runner.Query(ctx, "退款 100 元",
    adk.WithCheckPointID("approval-001"),
)
```

中断时写入的不是“一个字符串”，而是分层快照：

```text
Runner 层：runContext / runSession / interrupt tree
Graph 层：ChatModelAgent 的 state.Messages / workflow state
```

下一步使用同一个 checkpoint ID 恢复。内存 store 只能跨 iterator、不能跨进程重启；生产环境再替换 Store 实现即可。

## Demo 10：同一个需求，分别用 AgentTool 和 Workflow

假设需求是“先查订单，再把结果改写成客服回复”。先问一个问题：第二步是不是**必须**执行？它是否需要自由决定下一步？这个答案决定组件形态。

### 版本 A：AgentTool——把专家当成一次可返回的函数调用

```go
researcherTool := adk.NewAgentTool(ctx, orderResearcher)

coordinator, err := adk.NewChatModelAgent(ctx, &adk.ChatModelAgentConfig{
    Name:  "coordinator",
    Model: model,
    ToolsConfig: adk.ToolsConfig{
        ToolsNodeConfig: compose.ToolsNodeConfig{
            Tools: []tool.BaseTool{researcherTool},
        },
    },
})
```

模型可以决定“这次要不要查订单”。子 Agent 完成后，最后一条消息变成父 Agent 的 Tool result，父 Agent 仍然继续下一轮。因此它适合“可选专家、需要回到当前推理”的场景。

### 版本 B：Sequential Workflow——固定的业务流水线

```go
pipeline, err := adk.NewSequentialAgent(ctx, &adk.SequentialAgentConfig{
    Name: "order-reply-pipeline",
    SubAgents: []adk.Agent{orderResearcher, replyWriter},
})
```

这里不让模型决定是否跳过步骤：Workflow 负责按顺序运行两个 child，child 之间通过 session/history 交接。它适合合规流程、固定审批、ETL 和“每一步都必须发生”的任务。

```text
AgentTool：父模型 → 选择调用 → 子 Runner → ToolMessage → 父模型继续推理
Workflow ：入口    → 固定步骤 1 → 固定步骤 2 → 固定结束
```

不要只看“都能调用另一个 Agent”就混用：前者是模型控制的工具边界，后者是代码控制的编排边界。更完整的输入转换、checkpoint bridge 和 Transfer 差异见 [AgentTool 与转交](./tools-transfer.md)。

## Demo 11：把 Callback 和 Middleware 放在同一次运行里

这个实验故意安排两个动作：记录本次模型耗时，并在模型调用前裁剪消息。前者是观察，后者是修改；如果把它们交换位置，代码仍可能编译，但语义会变得脆弱。

```go
// Callback：看见调用边界，记录开始和结束，不改 model input。
timing := callbacks.NewHandlerBuilder().
    OnStartFn(func(ctx context.Context, info *callbacks.RunInfo,
        input callbacks.CallbackInput) context.Context {
        return context.WithValue(ctx, startedAtKey{}, time.Now())
    }).
    OnEndFn(func(ctx context.Context, info *callbacks.RunInfo,
        output callbacks.CallbackOutput) context.Context {
        if started, ok := ctx.Value(startedAtKey{}).(time.Time); ok {
            log.Printf("%s cost=%s", info.Name, time.Since(started))
        }
        return ctx
    }).Build()

iter := runner.Query(ctx, "查订单", adk.WithCallbacks(timing))
```

```go
// Middleware：在模型阶段拿到 state.Messages，返回修改后的 state。
type TrimHistory struct {
    *adk.TypedBaseChatModelAgentMiddleware[*schema.Message]
}

func (m *TrimHistory) BeforeModelRewriteState(
    ctx context.Context,
    state *adk.TypedChatModelAgentState[*schema.Message],
    _ *adk.TypedModelContext[*schema.Message],
) (context.Context, *adk.TypedChatModelAgentState[*schema.Message], error) {
    if len(state.Messages) > 8 {
        state.Messages = append([]*schema.Message(nil), state.Messages[len(state.Messages)-8:]...)
    }
    return ctx, state, nil
}
```

运行时观察：Callback 会在组件边界收到 `OnStart/OnEnd`；Middleware 则在本轮发给模型前改变 `state.Messages`。Callback 不应拿共享 input 做原地修改，Middleware 也不应承担全局耗时统计。详细的阶段和可见信息对照见 [执行阶段与组件选型](./component-positioning.md)。

## Demo 12：Typed AgenticMessage 的最短闭环

经典 `*schema.Message` 使用 `Role/ToolCalls`；`*schema.AgenticMessage` 使用 `ContentBlocks`。下面的重点不是写一个真实厂商模型，而是观察泛型 Runner、typed event 和内容块如何流动。

```go
agent, err := adk.NewTypedChatModelAgent(ctx,
    &adk.TypedChatModelAgentConfig[*schema.AgenticMessage]{
        Name:        "agentic-demo",
        Description: "typed demo",
        Model:       agenticModel, // 实现 model.AgenticModel
        Instruction: "回答问题，并把工具结果放入 ContentBlocks",
    })
if err != nil { log.Fatal(err) }

runner := adk.NewTypedRunner(adk.TypedRunnerConfig[*schema.AgenticMessage]{
    Agent: agent,
})
iter := runner.Query(ctx, "6 * 7 是多少？")
for {
    event, ok := iter.Next()
    if !ok { break }
    if event.Err != nil { log.Println(event.Err); continue }
    if event.Output != nil && event.Output.MessageOutput != nil {
        msg := event.Output.MessageOutput.Message
        log.Printf("agentic role=%v blocks=%d", msg.Role, len(msg.ContentBlocks))
    }
}
```

这个版本与经典路径共用 Runner/事件生命周期，但模型调用和 Tool 结果编码不同。真实项目若要跨两种消息协议复用 Middleware，应实现泛型接口；只读 `Role` 或 `ToolCalls` 的代码不能直接套到 `AgenticMessage`。

## Demo 13：TurnLoop 的 Push、抢占和恢复

普通 Runner 适合“一次输入，一次运行”。TurnLoop 适合常驻进程：外部事件随时 `Push`，当前 Agent 可能在安全点被新事件抢占。

```go
accepted, ack := loop.Push(
    Item{Text: "紧急告警"},
    adk.WithPreempt[Item, *schema.Message](adk.AnySafePoint),
)
if accepted && ack != nil {
    <-ack // 只表示已向 Push 当时观察到的那一轮提交抢占请求
}
```

在 `OnAgentEvents` 中不要把 `CancelError` 当成普通失败直接终止循环：TurnLoop 会根据 `Preempted`、`Stopped` 和未消费 item 选择继续规划或退出。生产版本还要观察：

```text
GenInput   → 本轮消费哪些 item、哪些留给下一轮
PrepareAgent → 本轮使用哪个 Agent
OnAgentEvents → 读取事件、决定是否 Stop
GenResume  → 中断后如何把 interrupted/unhandled/new items 重新组织
```

如果 `Store` 开启，TurnLoop checkpoint 同时保存 Agent checkpoint 和 item bookkeeping；因此恢复不是“只重新调用 Agent”，而是先恢复“哪些业务事件已经消费”。完整的字段和安全点语义见 [Cancel 与 TurnLoop](./cancel-turn-loop.md)。

## Demo 14：先学会选择 Prebuilt，再阅读实现

把 Prebuilt 当成“开箱即用的拓扑模板”，不要把它当成另一套隐藏运行时。选择时只看控制权和状态边界：

| 需求 | 优先考虑 | 原因 |
| --- | --- | --- |
| 多个专家由一个中心模型动态路由 | Supervisor（但先评估 AgentTool） | 路由由模型决定，成员完成后确定性回中心 |
| 先规划、执行、再根据结果改计划 | Plan-Execute-Replan | Planner/Executor/Replanner 通过 session keys 交接 |
| 长任务、文件修改、子任务和待办 | Deep Agent | 内置文件/任务能力与新版 Handlers 组合 |
| 步骤固定、顺序不能被模型改变 | Sequential Workflow | 直接写 Workflow，不必引入 Supervisor |

建议先用同一个 mock model 跑通最小拓扑，再替换真实模型。这样可以把“Prebuilt 的业务策略”与“模型偶发输出”分开调试。实现细节和当前源码的推荐/不推荐边界见 [Prebuilt 深入分析](./prebuilt.md)。

## Demo 15：把每一步串成调试输出

建议给 Demo 加一个统一的调试函数：

```go
func printEvent(event *adk.AgentEvent) {
    fmt.Printf("[event] agent=%s path=%v\n", event.AgentName, event.RunPath)
    if event.Action != nil {
        fmt.Printf("  action=%+v\n", event.Action)
    }
    if event.Output != nil && event.Output.MessageOutput != nil {
        msg, _, _ := adk.GetMessage(event)
        if msg != nil {
            fmt.Printf("  role=%s content=%s\n", msg.Role, msg.Content)
        }
    }
}
```

调试时按四层打印，不要只打印最终 LLM 请求：

```text
RootInput.Messages
  → runSession.Events
  → HistoryRewriter 输出的 AgentInput.Messages
  → BeforeModelRewriteState 后的 state.Messages
```

## 每一步新增了什么

| Demo | 新增能力 | 主要状态位置 | 下一步阅读 |
| --- | --- | --- | --- |
| 0 | Agent / Iterator / Event | iterator 内存 | [第一个可运行 Agent](./first-agent.md) |
| 1 | Runner / flowAgent / RunPath | runContext/session | [Runner 与运行上下文](./runner-context.md) |
| 2 | Session KV | `runSession.Values` | [状态、历史与记忆](./state-and-memory.md) |
| 3 | ChatModelAgent / ReAct | Graph state | [ChatModelAgent](./chat-model-agent.md) |
| 4 | Tool call loop | `state.Messages` | [ReAct 图实现](./react.md) |
| 5 | Event / Callback 观察 | AgentEvent stream | [Callback 与 AgentEvent](./callbacks.md) |
| 6 | Model-before state rewrite | `BeforeModelRewriteState` | [新版 Middleware](./middleware-current.md) |
| 7 | Reduction / Summary | state + Backend | [内置 Middleware](./builtin-middlewares.md) |
| 8 | Workflow | fork/join session | [Workflow Agent](./workflows.md) |
| 9 | Interrupt / Resume | CheckPointStore | [Runner 持久化读写链](./runner-persistence.md) |
| 10 | AgentTool vs Workflow | Tool result / session history | [AgentTool 与转交](./tools-transfer.md) |
| 11 | Callback vs Middleware | Callback boundary / `state.Messages` | [执行阶段与组件选型](./component-positioning.md) |
| 12 | Typed AgenticMessage | `TypedAgentEvent[*schema.AgenticMessage]` | [Typed Agent](./typed-agent-agentic.md) |
| 13 | TurnLoop | Push / preempt / item bookkeeping | [Cancel 与 TurnLoop](./cancel-turn-loop.md) |
| 14 | Prebuilt selection | Supervisor / Plan / Deep topology | [Prebuilt 深入分析](./prebuilt.md) |
| 15 | Unified debugging | RunPath / session / state / events | [调试与测试](./debugging-testing.md) |

## 遇到错误时的最短排查路径

```text
没有任何事件
  → 检查 Run 是否返回 iterator、generator 是否 Close

Agent 看不到 Session Value
  → 检查是否通过 Runner 运行、ctx 是否被替换成 Background

Tool 结果没有进入下一轮
  → 检查 Tool message 是否进入 state.Messages

Middleware 修改不生效
  → 检查是否使用 Handlers，而不是 Deprecated Middlewares
  → 检查是否返回了新的 state

恢复后从头开始
  → 检查 CheckPointStore、WithCheckPointID 和 ResumableAgent
```
