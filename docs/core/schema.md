# Schema 与消息

`schema` 是所有组件共享的语言。它既包含业务数据对象，也包含流和序列化等运行时原语。

## Message

`schema.Message` 覆盖 LLM 交互中的主要信息：角色、文本内容、ToolCall、Tool 响应、多模态内容、响应元数据与额外字段。辅助构造器如 `UserMessage`、`SystemMessage` 让常见调用更简洁。

流式模型通常产生多个不完整消息块。`ConcatMessages` / `ConcatMessageStream` 不只是拼接 `Content`：还需要按索引合并 ToolCall 参数片段、usage、logprobs、多内容 part 和 extra 字段。相关逻辑集中在 `schema/message.go`。

## Document

`Document` 表达检索与索引链路中的内容、ID 和 MetaData。Parent Retriever / Indexer 会利用元数据保存父子文档关联；Router 和 MultiQuery 则对多个文档集合做融合。

## ToolInfo

`ToolInfo` 包含工具名、描述和参数定义。`ParamsOneOf` 可以来自 Eino 的 `ParameterInfo`，也可以包装 JSON Schema。模型组件使用这些信息生成 tool call，ToolsNode 再按名称选择具体工具。

## 类型注册与检查点

`schema/serialization.go` 维护类型名注册。包含接口值或自定义类型的状态在 gob 序列化前需要注册稳定名称；ADK 的 `RunStep`、中断信息等会在 `init()` 中完成注册。

这意味着引入自定义检查点状态时要注意：能在内存中运行，不等于可以跨进程序列化恢复。

## 设计价值

把数据协议独立出来有两个直接效果：

- 组件实现之间不互相依赖，只通过 schema 交换数据；
- compose 可以为已知 schema 类型注册更准确的流拼接策略，例如消息块合并，而不是采用通用反射规则。

