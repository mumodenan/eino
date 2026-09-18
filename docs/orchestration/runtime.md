# 运行时

编译产物的中心是 `runner`。每次 Invoke/Transform 都创建独立的 channel manager 和 task manager，然后循环执行“提交就绪任务 → 等待完成 → 写回结果 → 计算下一批任务”。

## 一轮执行

```text
START 输入
   ↓ calculateNextTasks
就绪 channel → task 列表
   ↓ submit
节点并发执行
   ↓ wait
完成结果 + branch 选择
   ↓ update channel / dependency / skip
下一批 task，或 END 输出
```

## Channel 的职责

每个目标节点对应一个 channel。channel 不只是 Go channel，而是一个同步聚合器接口：

- `reportValues` 接收按来源命名的输入；
- `reportDependencies` 记录已完成的控制前驱；
- `reportSkip` 记录不会到达的分支；
- `get` 判断是否 ready，并完成 fan-in；
- `load` 支持检查点恢复。

Pregel channel 与 DAG channel 的 ready 条件不同，因此触发语义被封装在 channel builder 中，而不是散落在 runner 主循环。

## Task 调度

`taskManager` 为每个就绪节点启动任务，捕获 panic，并协调取消。runner 可以在一个超步内并行执行多个节点。完成后，节点输出被复制/分发到所有数据后继，控制完成被报告给控制后继。

发生 context cancel 时，runner 等待在途任务退出并返回包装后的 graph run error。

## Eager 执行

非 eager 模式以超步为边界：一批任务全部完成后才计算下一批。eager 模式会让已满足依赖的节点尽早进入执行，降低长短分支汇合前的空等。Workflow 与 AllPredecessor DAG 默认采用 eager。

## Branch 与 skip 传播

Branch 只选择部分后继。未选择节点收到 skip；如果一个节点的所有可能来源都被跳过，它本身也会被跳过，并继续向后传播。没有这套机制，DAG 汇合点会永久等待不存在的输入。

## Option 分发

运行开始先调用 `extractOption`，按 `chanSubscribeTo` 中的元数据为每个节点生成 option slice。Option 可以：

- 作用于整张图；
- 只作用于某类组件；
- 通过 node path 指向嵌套图中的具体节点。

节点实际执行时只看到自己接口定义的 Option 类型。

## 错误边界

图级 callback 的 start 被延迟到 local state 初始化之后，因此 handler 能访问 state。无论错误发生在初始化、节点、branch 或收尾阶段，defer 都确保触发 graph error/end callback。

runner 为内部错误添加阶段上下文，例如 extract option、restore task、calculate next tasks，便于从调用栈之外定位失败位置。

<div class="source-path">主循环与调度：compose/graph_run.go、graph_manager.go<br>触发通道：compose/pregel.go、dag.go</div>
