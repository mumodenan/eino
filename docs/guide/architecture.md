# 架构分层

Eino 的架构重点不是“类很多”，而是把建立 AI 数据流时容易混在一起的四类问题分开：协议、能力、拓扑和运行。

## 从调用到执行

```text
用户创建组件实例
  → Chain / Graph / Workflow 记录节点和边
  → Compile 校验类型、拓扑并生成 runner
  → runner 根据 channel 就绪状态生成 task
  → task 调用统一的 composableRunnable
  → schema.StreamReader 承载流式结果
  → callbacks 在组件与图边界观察执行
```

## 1. 数据协议层：schema

`schema` 不知道 Graph，也不关心某个模型供应商。它只定义交换的数据形态：

- `Message` 与多模态内容、ToolCall、TokenUsage；
- `Document` 与元数据；
- `ToolInfo` 与参数 JSON Schema；
- `StreamReader[T]` / `StreamWriter[T]`；
- 检查点需要的类型注册和序列化辅助。

它位于依赖图底部，因此也是自定义组件最常接触的包。

## 2. 能力契约层：components

组件接口把领域操作限制为稳定签名。例如 ChatModel 以消息列表为输入，以消息或消息流为输出；Retriever 以 query 为输入，返回文档列表。每类组件有自己的 `Option`，避免一个巨型配置对象覆盖所有节点。

接口通常同时定义非流式和流式方法，但编排层仍可以为只提供部分执行范式的 Lambda 建立适配。

## 3. 编排层：compose

构建阶段保存声明式拓扑；编译阶段把组件统一包装为 `composableRunnable`，建立前驱、后继、channel、handler 和检查点元数据；运行阶段只面对统一的 `invoke` / `transform` 内部签名。

这层承担了框架大部分复杂度：

- 泛型 API 与运行时 `reflect.Type` 校验；
- 四态流模式补全；
- fan-out 的流复制与 fan-in 的合并；
- Pregel 超步或 DAG eager 调度；
- Option 按组件类型、节点路径分发；
- state handler、callback、interrupt、checkpoint。

## 4. 模式层：adk 与 flow

`flow` 把常用 RAG / Agent 模式包装回标准组件接口，因此可以继续被组合。`adk` 则提升抽象层级：执行的产物不只是消息，而是携带来源路径、输出、动作或错误的 `AgentEvent`。

## 两种类型系统并存

公开 API 利用 Go 泛型在调用处表达 `Graph[I, O]` 与 `Runnable[I, O]`。但图节点集合本质上是异构的，无法只靠一个泛型参数静态描述，所以内部使用 `any + reflect.Type`：

1. `generic.TypeOf[T]()`保留泛型实参的反射类型；
2. 节点加入图时记录 input/output type；
3. 加边或编译时验证相邻类型；
4. 运行时包装器做类型断言，不符合预期时快速失败。

这是 Go 中构建异构类型图的务实折中：用户边界仍有泛型体验，内部获得动态拓扑能力。

## 控制流与数据流分离

图同时维护 `controlEdges` 和 `dataEdges`。通常一条边兼具两者；Workflow 的 `WithNoDirectDependency` 或显式 dependency 能只建立其中一类关系。

- 控制边决定节点何时满足触发条件；
- 数据边决定哪些值进入目标 channel；
- Branch 决定未命中的路径，并把 skip 沿后继传播。

这一区分是理解 Workflow 字段映射和 DAG 调度的关键。

