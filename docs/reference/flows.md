# Flow 预构建能力

`flow` 目录提供“由核心抽象组合而成、但对外仍像标准组件”的实现。它们是学习扩展 Eino 的好样本。

## Retriever

### MultiQuery

先用 ChatModel 将原始 query 扩写成多个 query，并发调用 Retriever，最后融合结果。并发调用放在 `flow/retriever/utils`，每个任务都会建立对应 callback run info。

价值：提升单一表达方式召回不足的问题。成本：模型调用和多次检索增加延迟，融合策略必须处理重复文档。

### Router

根据路由逻辑选择一个或多个 Retriever，再对并行结果做 fusion。它适合不同知识域使用独立索引的场景。

### Parent Retriever

底层 Retriever 命中子文档后，根据 metadata 中的父文档 ID 回查父文档，返回更完整上下文。它与 Parent Indexer 成对使用。

## Indexer

Parent Indexer 先用 Transformer 把父文档切成子文档，写入父子关联 metadata，再交给底层 Indexer。实现会深拷贝 metadata，避免污染调用方原文档。

## Agent

### ReAct

`flow/agent/react` 用 compose Graph 实现模型—工具循环，并保持 ChatModel 风格的 Generate/Stream API。它支持消息重写、直接返回工具、最大步数和自定义流式 tool call 检查。

### Host MultiAgent

`flow/agent/multiagent/host` 由 Host 决定把任务交给 Specialist，组合成一个对外 Agent。它代表较早的多 Agent 抽象；新的事件化、多工作流能力集中在 ADK。

## 共通实现模式

这些 flow 通常遵循：

1. `Config` 接收抽象接口，不依赖具体供应商；
2. 构造函数验证配置并返回同类标准组件；
3. 内部用并发工具、callbacks 或 compose 组合；
4. 提供 `GetType` / callback run info 保留可观测性；
5. Option 继续传递到底层实现。

因此应用自定义高阶组件时，可复用相同结构。

