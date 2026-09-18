# 设计取舍

这一页总结源码中反复出现的设计选择，以及使用者需要承担的代价。

## 泛型外壳，动态内核

公开 `Graph[I, O]` / `Runnable[I, O]` 提供清晰类型；内部异构节点使用 `any` 和反射。优点是 API 类型友好且拓扑灵活，代价是部分错误只能在 Compile 或真实值到达时发现。

## 编译一次，运行多次

Graph builder 可变，Runnable 拓扑不可变；每次运行创建 channel、task manager 和 local state。这样共享 Runnable 更安全，也把拓扑错误前移到启动阶段。

## 流式透明，但不是零成本

四态自动适配大幅降低组件组合难度，但降级适配可能执行 concat，fan-out 需要 copy，callbacks 观察流也需要复制。高吞吐系统仍应检查每个关键节点的原生流能力。

## 用 context 承载横切状态

callbacks、节点地址、local state、恢复目标和 ADK run context 都沿 context 传播。优点是签名稳定、嵌套自然；风险是丢失派生 context 会同时丢失多种框架语义。

## 控制边与数据边分离

这使 Workflow 能表达复杂依赖，并让 skip 正确传播；代价是调试时不能只看“值从哪里来”，还要看“谁决定何时运行”。Graph introspection 同时暴露 Edges 与 DataEdges 正是为了保留这一区别。

## 高阶能力由低阶组合

ReAct、MultiQuery、Plan-Execute 都尽量用组件、Graph 和 Agent workflow 实现。优点是天然继承 callbacks、stream、option、interrupt；代价是阅读高阶功能必须能沿多层抽象追到 runner。

## 错误、动作和中断分层

- error：当前计算失败；
- branch/control：正常路径选择；
- AgentAction：Agent 语义上的退出、转交或 break；
- interrupt：需要保存现场并等待外部输入。

把它们混为 error 会损失可恢复性，把普通错误当动作又会隐藏失败。扩展框架时应保持这些通道的语义边界。

## 适用边界

Eino 擅长进程内编排和流式 Agent 执行。它不是分布式任务队列、长期状态数据库或模型供应商 SDK。跨进程任务、幂等业务写入、调度持久化和权限边界仍应由应用基础设施负责。

