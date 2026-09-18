---
layout: home

hero:
  name: "Eino 源码解析"
  text: "从泛型 API 到 Agent 运行时"
  tagline: 以当前仓库源码为依据，拆解组件抽象、四态流转换、图编译、并发调度、中断恢复与 ADK。
  image:
    src: /logo.svg
    alt: Eino
  actions:
    - theme: brand
      text: 开始阅读
      link: /guide/overview
    - theme: alt
      text: 直达编排内核
      link: /orchestration/graph
    - theme: alt
      text: ADK 深入解析
      link: /adk/overview

features:
  - icon: 🧭
    title: 源码导向
    details: 每个结论都落到具体 package、类型或函数，建立从公开 API 到内部实现的映射。
  - icon: 🌊
    title: 流式系统
    details: 解释 Invoke、Stream、Collect、Transform 如何互相适配，以及复制、拼接、合并的实现边界。
  - icon: 🕸️
    title: 图运行时
    details: 分开分析图的构建、编译和执行，讲清 Pregel 与 DAG 两种触发语义及并发调度。
  - icon: 🤖
    title: Agent 与 ADK
    details: 从事件协议、Runner、ReAct 图到多 Agent 工作流，理解高阶能力如何复用底层编排。
---

## 阅读建议

第一次接触 Eino，按“项目全景 → 核心基础 → 编排系统 → ADK”顺序阅读；如果重点是 Agent，请从“Agent / Runner / ChatModelAgent → 完整生命周期 → Context → Config/Option → Middleware → Callback”这条路线进入。

> [!NOTE]
> 本站分析对象是当前检出的仓库版本。EinoExt 中的模型、向量库等外部实现不在本仓库内，文档会明确区分框架抽象与生态实现。
