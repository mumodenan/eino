# 项目全景

Eino 是一个面向 Go 的 LLM 应用框架内核。这个仓库最重要的职责不是接入某一家模型或向量数据库，而是定义稳定抽象，并把不同执行形态安全地编排起来。

## 一句话理解

如果把一个 AI 应用视为“消息经过模型、工具、检索器和自定义函数形成的数据流”，Eino 做了三件事：

1. 用 `components` 统一每类节点的输入、输出和 Option；
2. 用 `compose` 把节点编译成一个类型安全、支持流式与并发的 `Runnable`；
3. 用 `adk` 和 `flow` 在上述能力之上提供 Agent 与 RAG 等预构建模式。

<div class="arch-grid">
  <div class="arch-card"><strong>schema</strong><span>消息、文档、工具描述、泛型流</span></div>
  <div class="arch-card"><strong>components</strong><span>模型、工具、检索等接口契约</span></div>
  <div class="arch-card"><strong>compose</strong><span>Chain / Graph / Workflow 编译与执行</span></div>
  <div class="arch-card"><strong>adk · flow</strong><span>Agent 与可复用业务流程</span></div>
</div>

## 仓库模块

| 目录 | 职责 | 典型入口 |
| --- | --- | --- |
| `schema/` | 跨组件共享的数据协议和流原语 | `Message`、`Document`、`StreamReader`、`ToolInfo` |
| `components/` | 组件接口、Option 和回调数据转换 | `BaseChatModel`、`Retriever`、`BaseTool` |
| `compose/` | 图构建、类型校验、流适配、调度、检查点 | `NewGraph`、`NewChain`、`NewWorkflow`、`Runnable` |
| `callbacks/` | 横切面接口和注入工具 | `Handler`、`HandlerBuilder` |
| `adk/` | Agent 协议、Runner、ReAct、工作流 Agent | `Agent`、`Runner`、`NewChatModelAgent` |
| `flow/` | 由底层抽象组合出的高阶实现 | ReAct、MultiQuery、Parent、Router |
| `internal/` | 并发通道、拼接、序列化等内部支撑 | 非公共 API |

## 依赖边界

源码表现出清晰的单向依赖：`schema` 位于底部；组件接口依赖 schema；`compose` 同时理解组件和 schema；`adk`、`flow` 再依赖 compose。业务代码通常只需要依赖公开包，不应导入 `internal`。

```text
adk / flow
    ↓
compose  ← callbacks
    ↓
components
    ↓
schema
```

模型供应商、向量数据库和观测系统的具体实现主要位于独立的 `eino-ext` 仓库。这种拆分让核心仓库避免被 SDK 依赖拖重，也让编排层可用 mock 或自定义组件进行测试。

## 两套高阶 Agent 能力

仓库中同时存在两条演进路径：

- `flow/agent/react` 是较早的、直接面向 `compose.Graph` 的预构建 ReAct；
- `adk` 提供统一的 `AgentEvent` 事件协议、Runner、工作流 Agent、转交、中断恢复与中间件，是更完整的 Agent 开发层。

二者都证明了同一个设计目标：复杂能力应当通过底层编排组合出来，而不是成为运行时里的特殊分支。

## 版本阅读提示

当前模块声明最低 Go 版本为 1.18，核心大量使用泛型。源码分析以当前工作树为准；遇到 API 与线上手册不一致时，应优先检查本地 `go.mod`、公开类型注释和测试用例。

## 下一步

- 想立即写一段代码：进入[快速运行](./quick-start.md)。
- 想先理解设计：进入[架构分层](./architecture.md)。
- 想追调用链：进入[Graph：通用图](../orchestration/graph.md)。

