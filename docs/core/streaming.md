# 流处理系统

流式处理是 Eino 的核心差异点：流不是 ChatModel 的特例，而是所有 Runnable 的一等输入输出形态。

## Reader / Writer

`schema.Pipe[T](capacity)` 返回一对 `StreamReader[T]` 和 `StreamWriter[T]`。writer 通过 `Send` 发送值或错误，并以 `Close` 表示 EOF；reader 通过 `Recv` 消费并负责最终 `Close`。

`StreamReader` 内部可以指向五类来源：channel stream、数组、合并流、转换流和 child reader。公开 API 保持一致，内部按 reader type 分发。

## 四态适配矩阵

`compose.newRunnablePacker` 接收组件原生提供的执行函数，再补齐其余模式。核心策略如下：

| 已有能力 | 补出单值输入 | 补出流输入 |
| --- | --- | --- |
| Invoke | 单值直接调用；输出可包装为单元素流 | 先 concat 输入流 |
| Stream | 输出流 concat 后得到单值 | 单值输入可包装成单元素流 |
| Collect | 单值包装成单元素流后收集 | 原生 |
| Transform | 输入包装或输出 concat | 原生 |

因此“可以调用”不代表“完全流式”。如果一个节点只实现 Invoke，Transform 仍要先收完整输入，再一次性执行；背压和首 token 延迟取决于每个节点的原生能力。

## 拼接 concat

`compose/stream_concat.go` 优先查找已注册的类型专用拼接函数，再回退到 `internal.ConcatItems` 的反射逻辑。字符串、slice、map 以及 `schema.Message` 等有各自语义。

通用拼接无法猜测所有业务对象，所以自定义 chunk 类型如果需要从流降级到单值，应注册明确的 concat 行为，或者让节点原生实现流输入输出。

## 复制 fan-out

一个流要发往多个下游或同时交给 callback 时不能被重复消费。`StreamReader.Copy(n)` 创建 child readers，并使原 reader 失效。内部以共享读取和子 reader 缓冲保证每个消费者看到完整序列。

这也是为什么 reader 所有权很重要：复制后继续读取原对象属于错误用法。

## 合并 fan-in

`MergeStreamReaders` 将多个同类型流并为一个流；`MergeNamedStreamReaders` 还保留来源名。图编译选项 `WithFanInMergeConfig` 可要求命名合并在每个来源结束时发出 `SourceEOF`，便于消费方感知局部完成。

合并不等于业务语义上的排序。并行来源之间的到达顺序由调度决定；如果结果必须稳定排序，应在业务节点显式完成。

## 错误与关闭

- `io.EOF` 表示正常结束；
- 普通 error 是流中的失败项；
- `ErrNoValue` 只用于转换函数跳过当前 item；
- 提前停止消费时也应 `Close`，让生产端释放资源；
- callback 要观察同一条流时，框架会复制而不是抢占业务 reader。

