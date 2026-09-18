# Chain 与 Workflow

Chain 和 Workflow 没有独立运行时；它们最终都编译为同一种 runner。差异主要发生在“如何构建图”和“采用什么触发语义”。

## Chain

`Chain[I, O]` 内部持有一个 `Graph[I, O]`，并维护当前尾节点 `preNodeKeys` 与递增的 `nodeIdx`。每次 Append：

1. 创建新节点；
2. 从所有当前尾节点连接到新节点；
3. 把新节点更新为尾节点；
4. Compile 时自动把尾节点连到 END。

Parallel 和 Branch 会让当前尾节点变成多个 key，后续 Append 再负责汇合。因此 Chain 仍能表达有限的非线性结构，但整体只能向前推进。

## Workflow

Workflow 面向无环的数据加工流程。每个 `WorkflowNode` 通过 `AddInput` 声明来源，并可附带字段映射：

```go
wf.AddLambdaNode("render", render).
    AddInput("query", compose.MapFields("Text", "Question")).
    AddInput("search", compose.MapFields("Docs", "Context"))
```

它在 compile 时：

- 展开节点依赖和映射；
- 验证映射路径与目标字段类型；
- 为目标节点插入 input field mapping converter；
- 使用 DAG channel builder；
- 默认启用 eager execution。

## 字段映射实现

`FieldMapping` 保存来源路径、目标路径、可选的来源节点和 custom extractor。实现依赖反射，支持 struct 字段与 map key，也能在目标路径中按需实例化嵌套指针。

编译期能确定类型时会调用 `validateFieldMapping`；interface 或动态 map 让静态判断不足时，会把检查记录到 runtime check 集合。

限制值得注意：同一目标节点不能有两个映射写入同一个目标路径，否则编译失败。这个约束避免依赖完成顺序决定最终值。

## 控制依赖与数据依赖

`AddDependency` 只要求某节点完成，不传值。`AddInput` 通常同时建立数据和控制依赖。`WithNoDirectDependency` 可只传数据，不把来源作为直接触发条件。

这让 Workflow 可以表达“值来自 A，但是否运行由 B/C 控制”之类的高级 DAG，但也更需要明确数据生命周期。

## 对比

| 能力 | Chain | Graph | Workflow |
| --- | --- | --- | --- |
| API 风格 | Append builder | 显式节点与边 | 节点声明输入 |
| 环 | 不支持 | 支持 | 不支持 |
| 字段映射 | 不强调 | 可通过 handler | 原生能力 |
| 默认触发 | AnyPredecessor | AnyPredecessor | AllPredecessor |
| 典型执行 | Pregel | Pregel / DAG | DAG eager |

