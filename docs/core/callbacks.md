# Callbacks 切面

Callbacks 为日志、Tracing、指标和调试提供统一切面。它们围绕组件或图调用工作，不改变业务函数签名。

## 五个时机

`callbacks.Handler` 覆盖五类事件：

- `OnStart`
- `OnEnd`
- `OnError`
- `OnStartWithStreamInput`
- `OnEndWithStreamOutput`

流式 start/end 单独建模，因为读取流本身会消耗数据。注入逻辑会复制 stream，一份给 handler，一份继续执行业务。

## HandlerBuilder

```go
handler := callbacks.NewHandlerBuilder().
    OnStartFn(func(ctx context.Context, info *callbacks.RunInfo, input callbacks.CallbackInput) context.Context {
        log.Printf("start %s", info.Name)
        return ctx
    }).
    OnErrorFn(func(ctx context.Context, info *callbacks.RunInfo, err error) context.Context {
        log.Printf("failed %s: %v", info.Name, err)
        return ctx
    }).
    Build()
```

`HandlerBuilder` 适合只关注部分时机的场景；未设置的函数保持空操作。

## 上下文传播

handler 列表与 `RunInfo` 通过 context 传播。嵌套图会追加 address segment，形成图、节点、组件的路径。`EnsureRunInfo`、`ReuseHandlers` 和 compose 内部的 context wrapper 共同确保第三方实现也处在正确观测层级。

Handler 返回新的 context，因此可以把 trace span 或派生信息传给后续阶段。实现时不要丢弃返回值。

## 全局与单次调用

- `InitCallbackHandlers` / `AppendGlobalHandlers` 配置全局 handler；
- `compose.WithCallbacks(handler)` 只配置一次 Runnable 调用；
- `DesignateNode` 可把 option 限定到具体节点。

全局回调适合基础设施，单次回调适合请求级调试。库代码应谨慎修改全局集合，避免测试互相影响。

## 组件内外两种注入

如果组件声明 callbacks 已启用，它负责在有业务语义的位置触发；否则 compose 在组件外包装。这种双轨机制兼顾可观测性覆盖率与高质量语义事件。

## Manager 与 Context 的内部结构

Callback manager 不是全局单例。每条运行 Context 里有自己的 manager：

```go
type manager struct {
    globalHandlers []Handler
    handlers       []Handler
    runInfo        *RunInfo
}
```

`globalHandlers` 是 manager 创建时从全局列表复制的快照，`handlers` 是本次调用或上层 Graph 继承的 handler。`ReuseHandlers` 创建新 manager 外壳并替换 `RunInfo`，从而让同一组 handler 在 Graph、Node 和 Tool 层看到不同组件信息。

Start 时的 RunInfo 还会被放入单独的 Context value。这样内层组件可以切换自己的 RunInfo，外层 End/Error 仍能从它自己的 Context 链找回对应信息。

## 精确执行顺序

假设本次 handler 为 `L1, L2`，全局 handler 为 `G1, G2`：

```text
Start: G2 → G1 → L2 → L1 → component
End:   component → L1 → L2 → G1 → G2
Error: error     → L1 → L2 → G1 → G2
```

Start 逆序、End/Error 正序，构成栈式包装。这让全局 tracing handler 可以最先创建 span，最后关闭 span。每个 handler 返回的 Context 会继续传给下一个 handler 和真实组件。

## 流式 Callback 不会共享同一个 Reader

有 N 个 handler 需要观察流时，内部会生成 N+1 份 reader：

```text
StreamReader
  → handler 1 copy
  → handler 2 copy
  → ...
  → business copy
```

所以 handler 读完自己的 copy 不会把业务流读空。但每个 handler 仍然负责消费或关闭自己的 reader。`OnError` 只覆盖创建返回流之前的调用错误；返回 reader 后的中途错误在 `Recv` 时才能观测。

## 类型化 HandlerHelper

底层 CallbackInput/Output 是 `any`。`utils/callbacks.NewHandlerHelper` 依据 `RunInfo.Component` 转换为类型化数据：

- ChatModel 转为 `*model.CallbackInput/Output`；
- Tool 转为 `*tool.CallbackInput/Output`；
- ToolsNode 转为 Message 或 Message slice；
- Graph/Chain/Lambda 保留通用输入输出。

Helper 自身也实现 `TimingChecker`，只在当前 Component 和 timing 确实有对应函数时参与调度。

## Callback 不是数据转换 Middleware

Handler 只返回 Context，不返回新 input/output/error。它适合 tracing、日志、指标和审计副作用。需要稳定改写数据时，应使用 Graph StatePre/PostHandler、ToolMiddleware 或组件自己的参数。

## ADK 为什么严重依赖 Callback

ChatModelAgent 使用内部 callback 把每轮 ChatModel 输出发成 assistant `AgentEvent`，把外层 Chain error 转成 error/中断事件，并与 Tool collector middleware 协作产生 Tool event。内部 handler 还会根据 Address 深度过滤嵌套 Agent，避免事件重复。

这条 ADK 专属链路见 [Callback 与 AgentEvent 事件桥](../adk/callbacks.md)，Context manager 所在的完整派生层级见 [Context 的逐层传播](../adk/context-flow.md)。

<div class="source-path">Public API：callbacks/interface.go、aspect_inject.go、handler_builder.go<br>Manager：internal/callbacks/manager.go、inject.go<br>Compose 注入：compose/utils.go<br>类型化转换：utils/callbacks/template.go</div>
