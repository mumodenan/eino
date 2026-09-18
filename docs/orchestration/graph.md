# Graph：通用图

Graph 是 Eino 最通用的编排 API：节点代表可执行对象，边同时表达数据传递和触发依赖，Branch 在运行时选择后继。

## 构建期数据结构

内部 `graph` 主要保存：

```go
nodes        map[string]*graphNode
controlEdges map[string][]string
dataEdges    map[string][]string
branches     map[string][]*GraphBranch
startNodes   []string
endNodes     []string
```

除此之外还有字段映射记录、state generator、边/节点 handler、期望输入输出类型以及延迟到 Compile 的 `buildError`。

公开的 `Graph[I, O]` 只是在这个非泛型内部结构外包装了输入输出类型，让最终 `Compile` 能返回 `Runnable[I, O]`。

## 节点

`AddChatModelNode`、`AddRetrieverNode` 等便捷方法最终都会把组件转换为 `graphNode`。Lambda、子图、ToolsNode 和 passthrough 也走同一抽象。

加入节点时立即检查：

- key 不能是保留的 `START` / `END`；
- key 不可重复；
- 需要 state 的 handler 必须处于启用 state 的 Graph；
- pre/post handler 的 state 与输入输出类型必须匹配；
- 编译后不可再修改，返回 `ErrGraphCompiled`。

部分错误记录进 `buildError`，这使 Chain / Workflow 的链式 API 可以继续返回 builder，最后在 Compile 统一报告错误。

## 边

普通 `AddEdge(a, b)` 同时添加 control edge 与 data edge。加边时会验证两端已经存在、方向不指向 START 或从 END 发出、边不重复，并根据类型信息检查可连接性。

`START` 和 `END` 是虚拟节点，它们的输出/输入类型分别对应 `Graph[I, O]` 的 I/O。

## Branch

Branch 的条件函数接收前驱输出并返回一个或多个目标 key。编译时目标会进入前驱和后继关系；运行时未命中的节点会被标记 skip，并沿控制图继续传播，防止某个 DAG 节点永远等待一条不可能到来的路径。

流式 branch 会消费输入判断路径，因此框架必须复制流：一份供条件函数读取，另一份按选中分支继续传递。

## 局部状态

`WithGenLocalState` 为每次运行创建独立 state：

```go
type State struct { Turns int }

g := compose.NewGraph[string, string](
    compose.WithGenLocalState(func(context.Context) *State {
        return &State{}
    }),
)
```

节点通过类型化的 state pre/post handler 读写。state 放在运行 context 的内部包装中，子图可形成 parent 链；它不是全局变量，也不会跨两次 Invoke 自动共享。

## 何时使用 Graph

选择 Graph 的典型信号是：有环、动态路由、多入口汇合、需要任一前驱触发、需要节点级中断，或想准确控制控制流和数据流。纯线性流程优先 Chain，字段映射 DAG 优先 Workflow。

<div class="source-path">公开入口：compose/generic_graph.go<br>内部建图：compose/graph.go、graph_node.go、branch.go</div>

