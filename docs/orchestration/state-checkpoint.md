# 状态、中断与恢复

Eino 区分三种容易混淆的状态：一次图运行内共享的 local state、用于恢复执行的 checkpoint，以及 ADK 会话中的 session values。

## Local state

`WithGenLocalState` 每次运行生成一份 state，通过 context 中的 `internalState` 保存。节点的 state pre/post handler 在调用前后读写它。嵌套图会保留 parent 指针，但各层 state 类型仍由对应 Graph 定义。

适合：本轮对话的临时聚合、节点间共享计数、无需持久化的业务上下文。

## 图检查点

Compile 时提供 `CheckPointStore` 后，runner 可以保存：

- channel 中尚未消费的值和依赖状态；
- 下一批任务及是否跳过 pre-handler；
- local state；
- 子图路径和需要重跑的节点；
- 流输入输出经 converter 转换后的可序列化值。

恢复时优先读取 context 内嵌 checkpoint（子图场景），否则按 checkpoint ID 从 store 加载，然后重建 channel 和 task。

## 中断点

编译选项可以指定 node 前后中断；Tool 也可通过 `Interrupt` / `StatefulInterrupt` 产生中断。并发节点可能同时受影响，框架会汇总子图中断、已取消任务和需要重跑的节点，再保存一致的恢复入口。

中断不是普通 error：它携带地址、展示给用户的信息和可选状态，并需要持久化执行现场。

## ADK Runner

`adk.Runner` 在 Agent 层做类似协调。它消费 `AgentEvent`；遇到内部 interrupt signal 时，在把公开 `Interrupted` 事件交给调用方之前先保存 checkpoint，保证用户一收到事件就可以安全 Resume。

`ResumeWithParams` 以 address → data map 精确指定恢复目标。叶子组件未被选中时需要再次中断；组合 Agent 负责把恢复信号向下传递。

## Session values

ADK `runSession` 维护并发安全的 values map 和已发生事件。顺序子 Agent 共享会话；并行 workflow 会 fork run context，结束后再 join 事件与值。它解决的是 Agent 运行上下文传播，不等同于 compose local state。

## 使用建议

- 只在一次 Invoke 内共享：local state；
- 需要人工确认后继续：interrupt + checkpoint；
- Agent 树共享请求级变量：session values；
- 需要真正长期业务状态：交给外部数据库，不要把 checkpoint 当数据库使用。

