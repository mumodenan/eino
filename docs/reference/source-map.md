# 源码地图

这份地图按“遇到什么问题应该先读哪里”组织。

## 图编排

| 问题 | 首要文件 | 继续追踪 |
| --- | --- | --- |
| Graph API 从哪里进入 | `compose/generic_graph.go` | `graph.go` |
| 节点如何包装组件 | `compose/graph_node.go` | `component_to_graph_node.go` |
| Compile 做了什么 | `compose/graph.go` 的 `compile` | `graph_compile_options.go` |
| 运行循环 | `compose/graph_run.go` | `graph_manager.go` |
| 节点并发 | `compose/graph_manager.go` | `internal/safe` |
| Pregel / DAG 触发 | `compose/pregel.go`、`dag.go` | `graph.go` |
| Branch | `compose/branch.go` | `graph_run.go` |
| Chain builder | `compose/chain.go`、`chain_*.go` | `graph.go` |
| Workflow 映射 | `compose/workflow.go` | `field_mapping.go` |

## 流与类型

| 问题 | 首要文件 |
| --- | --- |
| 四态 Runnable | `compose/runnable.go` |
| 泛型到反射 | `compose/generic_helper.go`、`internal/generic` |
| 流 reader/writer/copy/merge | `schema/stream.go` |
| 流拼接注册 | `compose/stream_concat.go` |
| 通用拼接 | `internal/concat.go` |
| Message chunk 合并 | `schema/message.go` |

## 横切能力

| 问题 | 首要文件 |
| --- | --- |
| Callback 接口 | `callbacks/interface.go` |
| Callback 注入 | `callbacks/aspect_inject.go`、`internal/callbacks/inject.go`、`compose/utils.go` |
| Option 定位节点 | `compose/graph_call_options.go` |
| Local state | `compose/state.go` |
| 中断 / 恢复 | `compose/interrupt.go`、`resume.go` |
| Checkpoint | `compose/checkpoint.go`、`internal/core` |
| 图 introspection | `compose/introspect.go` |

## Agent

| 问题 | 首要文件 |
| --- | --- |
| Agent / Event 协议 | `adk/interface.go` |
| 应用执行入口 | `adk/runner.go` |
| ChatModelAgent | `adk/chatmodel.go` |
| ReAct 图 | `adk/react.go` |
| Agent run context | `adk/runctx.go` |
| Agent 包装成 Tool | `adk/agent_tool.go` |
| 顺序/并行/循环 | `adk/workflow.go` |
| Skill | `adk/middlewares/skill` |
| Plan-Execute / Deep | `adk/prebuilt` |

## 测试是规范

源码注释说明意图，测试则展示边界。推荐配对阅读：

- `runnable_test.go`：四态适配与类型断言；
- `graph_test.go`：拓扑、分支、流和 Option；
- `checkpoint_test.go` / `interrupt_test.go`：恢复协议；
- `workflow_test.go`：字段映射与 DAG；
- `schema/stream_test.go`：copy、merge、close 和并发；
- `adk/*_test.go`：事件路径、Agent workflow 与中断。
