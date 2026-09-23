import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  lang: 'zh-CN',
  title: 'Eino 源码解析',
  description: '从源码理解 Eino 的组件抽象、图编排、流处理与 Agent 运行时',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['meta', { name: 'theme-color', content: '#0b7f68' }],
    ['meta', { property: 'og:title', content: 'Eino 源码解析' }],
    ['meta', { property: 'og:description', content: '从 API 到运行时，系统拆解 Eino 的实现' }],
    ['script', {}, `(function () {
      try {
        var saved = localStorage.getItem('eino-doc-outline-collapsed')
        var useCompactDefault = saved === null && matchMedia('(min-width: 1280px) and (max-width: 1599px)').matches
        if (saved === '1' || useCompactDefault) document.documentElement.classList.add('outline-collapsed')
      } catch (_) {}
    })()`]
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Eino 源码解析',
    nav: [
      { text: '学习路径', link: '/guide/overview' },
      { text: '编排内核', link: '/orchestration/graph' },
      { text: 'Agent', link: '/adk/overview' },
      { text: '源码地图', link: '/reference/source-map' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: '开始阅读',
          items: [
            { text: '项目全景', link: '/guide/overview' },
            { text: '快速运行', link: '/guide/quick-start' },
            { text: '架构分层', link: '/guide/architecture' }
          ]
        },
        {
          text: '核心基础',
          items: [
            { text: '组件抽象', link: '/core/components' },
            { text: 'Schema 与消息', link: '/core/schema' },
            { text: '流处理系统', link: '/core/streaming' },
            { text: 'Callbacks 切面', link: '/core/callbacks' }
          ]
        }
      ],
      '/core/': [
        {
          text: '核心基础',
          items: [
            { text: '组件抽象', link: '/core/components' },
            { text: 'Schema 与消息', link: '/core/schema' },
            { text: '流处理系统', link: '/core/streaming' },
            { text: 'Callbacks 切面', link: '/core/callbacks' }
          ]
        },
        { text: '继续阅读', items: [{ text: '图编排', link: '/orchestration/graph' }] }
      ],
      '/orchestration/': [
        {
          text: '编排系统',
          items: [
            { text: 'Graph：通用图', link: '/orchestration/graph' },
            { text: 'Chain 与 Workflow', link: '/orchestration/chain-workflow' },
            { text: '编译期', link: '/orchestration/compile' },
            { text: '运行时', link: '/orchestration/runtime' },
            { text: '状态、中断与恢复', link: '/orchestration/state-checkpoint' }
          ]
        }
      ],
      '/adk/': [
        {
          text: '从零理解 ADK',
          items: [
            { text: 'ADK 总览', link: '/adk/overview' },
            { text: '最新源码校验报告', link: '/adk/latest-source-audit' },
            { text: 'ADK 图解总览', link: '/adk/visual-guide' },
            { text: '先理解这些概念', link: '/adk/beginner-concepts' },
            { text: '小白推演：一次 Agent 请求', link: '/adk/zero-to-agent' },
            { text: 'Agent / Runner / ChatModelAgent', link: '/adk/roles-and-boundaries' },
            { text: 'Typed Agent 与 AgenticMessage', link: '/adk/typed-agent-agentic' },
            { text: '完整生命周期', link: '/adk/lifecycle' },
            { text: '复杂请求端到端追踪', link: '/adk/end-to-end-trace' },
            { text: '第一个可运行 Agent', link: '/adk/first-agent' },
            { text: '自定义 Agent 实战', link: '/adk/custom-agent' },
            { text: '执行阶段与组件选型', link: '/adk/component-positioning' },
            { text: 'Agent 组装最佳实践', link: '/adk/agent-composition-best-practices' },
            { text: '状态、历史与记忆', link: '/adk/state-and-memory' },
            { text: '初学者常见问题', link: '/adk/faq' },
            { text: '术语与类型速查', link: '/adk/glossary' }
          ]
        },
        {
          text: '核心运行机制',
          items: [
            { text: '事件与异步迭代器', link: '/adk/events' },
            { text: 'Runner 与运行上下文', link: '/adk/runner-context' },
            { text: 'Runner 持久化读写链', link: '/adk/runner-persistence' },
            { text: 'LLM 上下文窗口与消息存储', link: '/adk/context-window' },
            { text: 'Context 的逐层传播', link: '/adk/context-flow' },
            { text: 'ADK 配置分层全景', link: '/adk/config-layers' },
            { text: 'Config 与 Option 转换', link: '/adk/config-option-flow' },
            { text: 'ChatModelAgent', link: '/adk/chat-model-agent' },
            { text: 'ReAct 图实现', link: '/adk/react' },
            { text: 'Callback 与 AgentEvent', link: '/adk/callbacks' },
            { text: '并发、取消与错误边界', link: '/adk/concurrency-errors' },
            { text: 'Cancel 与 TurnLoop', link: '/adk/cancel-turn-loop' }
          ]
        },
        {
          text: '组合与控制流',
          items: [
            { text: 'Middleware 新旧 API', link: '/adk/middleware-current' },
            { text: '兼容版 Middleware 源码', link: '/adk/middleware' },
            { text: '内置 Middleware 源码', link: '/adk/builtin-middlewares' },
            { text: 'AgentTool 与转交', link: '/adk/tools-transfer' },
            { text: '工作流 Agent', link: '/adk/workflows' },
            { text: 'Workflow 完整案例', link: '/adk/workflow-case-study' },
            { text: '中断、检查点与恢复', link: '/adk/interrupt-resume' }
          ]
        },
        {
          text: '预构建实现',
          items: [
            { text: 'Prebuilt 深入分析', link: '/adk/prebuilt' },
            { text: 'ADK 源码导读', link: '/adk/source-walkthrough' },
            { text: '调试与测试手册', link: '/adk/debugging-testing' },
            { text: '模块覆盖审计', link: '/adk/coverage-audit' }
          ]
        }
      ],
      '/reference/': [
        {
          text: '参考',
          items: [
            { text: 'Flow 预构建能力', link: '/reference/flows' },
            { text: '源码地图', link: '/reference/source-map' },
            { text: '设计取舍', link: '/reference/design-notes' }
          ]
        }
      ]
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/cloudwego/eino' }],
    editLink: {
      pattern: 'https://github.com/cloudwego/eino/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },
    search: { provider: 'local' },
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '最后更新' },
    footer: {
      message: '基于仓库源码整理，重点解释实现机制与设计取舍',
      copyright: 'Eino is licensed under Apache-2.0'
    }
  },
  mermaid: {
    theme: 'base',
    themeVariables: {
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      primaryColor: '#dff7ef',
      primaryTextColor: '#12352f',
      primaryBorderColor: '#0b7f68',
      secondaryColor: '#e8f1ff',
      tertiaryColor: '#fff4d6',
      lineColor: '#64748b'
    }
  },
  vite: {
    // Mermaid 11.17 loads fastdom through dynamic ESM chunks. Vite cannot
    // discover that old CommonJS package reliably during dev startup, so the
    // browser receives fastdom.js without a synthetic default export and the
    // whole VitePress app stops before mounting. Force both fastdom entry
    // points through Vite's dependency pre-bundler.
    optimizeDeps: {
      include: [
        'fastdom',
        'fastdom/extensions/fastdom-promised.js'
      ]
    }
  }
}))
