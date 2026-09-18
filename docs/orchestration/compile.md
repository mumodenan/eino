# 编译期

`Compile` 把容易修改、包含异构节点的声明式图冻结成可运行对象。理解这一阶段能解释大量“为什么在启动前报错”的行为。

## 编译主流程

`graph.compile` 大致执行以下步骤：

1. 返回构建阶段累计的 `buildError`；
2. 根据组件类型和 `NodeTriggerMode` 选择 Pregel 或 DAG channel；
3. 决定 eager 模式；
4. 验证 START、END 和尚未推断的类型；
5. 检查重复字段映射目标，并注入 mapping converter；
6. 递归编译子图和节点；
7. 反向建立 data/control predecessors；
8. 组装 `chanCall`、handler manager 与 runner；
9. 建立 state context 和 checkpointer；
10. DAG 检环，设置最大步数，标记原图 `compiled`。

## composableRunnable

不论原始节点是模型、Lambda 还是子图，编译后都变成 `composableRunnable`：

```go
type composableRunnable struct {
    i invoke
    t transform
    inputType, outputType, optionType reflect.Type
    meta *executorMeta
    nodeInfo *nodeInfo
}
```

内部只保留单值 `i` 和流式 `t` 两条执行路径，因为 `Runnable` 的四个公开方法已在 packer 层完成互相推导。runner 因而只需根据整次调用是否为 stream 选择 invoke 或 transform。

## 类型校验

Graph 的每个节点在运行时被放进 map，Go 编译器无法直接检查异构连接。Eino 用反射补回这一步：记录每个节点的 `reflect.Type`，加边/编译时比较，字段映射则逐段解析路径。

无法静态确认的 interface/map 场景不会完全放弃检查，而是生成 `runtimeCheckEdges` 或 `runtimeCheckBranches`，在真实值到达时验证。

## Pregel 与 DAG

- 默认 Graph 使用 Pregel channel 和 `AnyPredecessor`，允许环；为避免死循环会设置最大步数，默认约为节点数加 10。
- `AllPredecessor` 或 Workflow 使用 DAG channel，编译时检查无环；DAG 不允许设置最大运行步数。
- DAG/Workflow 默认 eager：某节点一旦满足依赖立即提交，不必等待整个超步结束。

## 图不可变性

编译成功后设置 `g.compiled = true`。不可变拓扑使同一个 Runnable 能安全地被多次执行，而每次调用的 channel、task manager 与 local state 都重新初始化。

## 编译回调与图信息

`GraphCompileCallback` 可以获得 `GraphInfo`，包括节点、控制边、数据边、分支、类型、子图和 compile options。可视化与开发工具可以借此读取拓扑，而不侵入运行路径。

