# 快速运行

Eino 核心仓库只提供抽象和编排。真实模型通常来自 `github.com/cloudwego/eino-ext`；为了把注意力放在框架机制上，下面用 Lambda 构建一个无外部依赖的可运行示例。

## 最小 Chain

```go
package main

import (
    "context"
    "fmt"
    "strings"

    "github.com/cloudwego/eino/compose"
)

func main() {
    ctx := context.Background()

    normalize := compose.InvokableLambda(func(_ context.Context, in string) (string, error) {
        return strings.TrimSpace(in), nil
    })
    answer := compose.InvokableLambda(func(_ context.Context, in string) (string, error) {
        return "Eino received: " + in, nil
    })

    r, err := compose.NewChain[string, string]().
        AppendLambda(normalize).
        AppendLambda(answer).
        Compile(ctx)
    if err != nil {
        panic(err)
    }

    out, err := r.Invoke(ctx, "  hello  ")
    if err != nil {
        panic(err)
    }
    fmt.Println(out)
}
```

`Compile` 是关键边界：调用前得到的是可修改的构建器；调用后得到统一的 `Runnable[string, string]`，并且原图不能继续修改。

## 四种运行方式

同一个 `Runnable[I, O]` 暴露四种输入输出组合：

| 方法 | 输入 | 输出 | 常见场景 |
| --- | --- | --- | --- |
| `Invoke` | `I` | `O` | 普通同步调用 |
| `Stream` | `I` | `StreamReader[O]` | 模型逐块输出 |
| `Collect` | `StreamReader[I]` | `O` | 汇总上游流后处理 |
| `Transform` | `StreamReader[I]` | `StreamReader[O]` | 端到端流式管道 |

组件不必原生实现全部四种模式。`compose/runnable.go` 会从已有实现推导缺失模式，例如把单值包装成单元素流，或将流拼接后调用只接收单值的方法。

## 最小 Graph

```go
g := compose.NewGraph[string, string]()
_ = g.AddLambdaNode("normalize", normalize)
_ = g.AddLambdaNode("answer", answer)
_ = g.AddEdge(compose.START, "normalize")
_ = g.AddEdge("normalize", "answer")
_ = g.AddEdge("answer", compose.END)

r, err := g.Compile(ctx, compose.WithGraphName("minimal_graph"))
```

同样的线性逻辑用 Graph 会更啰嗦，但 Graph 可以表达环、分支、多个出入边和局部状态；Chain 是对常见线性建图操作的 builder 封装。

## 选择编排 API

- 顺序处理，偶尔带分支或并行块：用 `Chain`。
- 需要环、动态路由或细粒度控制：用 `Graph`。
- DAG 且节点间需要结构体字段映射：用 `Workflow`。
- 编写自治 Agent：优先看 `adk`，必要时下沉到 `compose`。

## 调试入口

出现编译错误时先看节点输入输出类型；出现运行时错误时用 `WithGraphName` 和 callbacks 标识节点。如果涉及流，确保每个消费方最终调用 `Close()`，并注意 `Copy` 后原 reader 不再可用。

