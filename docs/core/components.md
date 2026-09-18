# 组件抽象

`components` 目录定义“节点能做什么”，而不是“节点由谁实现”。编排层依靠固定输入输出签名将完全不同的实现放进同一张图。

## 主要组件

| 包 | 核心接口 | 输入 → 输出 |
| --- | --- | --- |
| `components/model` | `BaseChatModel` | `[]*Message` → `*Message` / stream |
| `components/prompt` | `ChatTemplate` | `map[string]any` → `[]*Message` |
| `components/tool` | `BaseTool`、`InvokableTool`、`StreamableTool` | JSON arguments → string / stream |
| `components/retriever` | `Retriever` | query → documents |
| `components/indexer` | `Indexer` | documents → IDs |
| `components/document` | `Loader`、`Transformer` | source/documents → documents |
| `components/embedding` | `Embedder` | strings → vectors |

## Option 模式

每类组件定义自己的 Option 函数类型。调用 Graph 时，`compose.Option` 可以包装某一组件类型的 Option，并进一步通过 `DesignateNode` 指定节点。

```go
r.Invoke(ctx, input,
    compose.WithChatModelOption(
        model.WithTemperature(0.2),
    ).DesignateNode("planner"),
)
```

运行前，`extractOption` 遍历节点元信息，把全局、按组件类型和按节点路径的选项转换成每个 `chanCall` 的参数。因而组件本身不需要理解 Graph。

## 回调元数据

各组件目录中的 `callback_extra.go` 把通用的 `callbacks.CallbackInput/Output` 转成带领域含义的结构。例如模型回调能暴露消息和模型输出，工具回调能暴露 arguments、tool call ID 等。

组件可以声明自己已处理 callbacks；否则 compose 会在执行包装器外层注入切面。这避免第三方组件遗漏观测能力。

## Lambda：逃生舱

并非所有节点都值得定义一个组件接口。`compose.Lambda` 接受 Invoke、Stream、Collect、Transform 函数，是连接业务逻辑与标准组件的适配层。

```go
parse := compose.InvokableLambda(
    func(ctx context.Context, msg *schema.Message) (Result, error) {
        return decode(msg.Content)
    },
)
```

Lambda 在内部同样被包装成 `composableRunnable`，所以仍能获得类型检查、流模式补全、回调和节点级 Option 分发。

## 实现自定义组件的原则

1. 实现最贴近领域的公开接口，而不是直接依赖 compose 内部类型；
2. 遵守流 reader 的所有权约定，消费后关闭，复制后不再使用原 reader；
3. Option 使用对应组件包提供的包装方式，扩展参数放进 implementation-specific option；
4. 明确 callbacks 是自行触发还是交给编排层代理；
5. 用接口 mock 测试编排，不把供应商 SDK 带进核心逻辑。

