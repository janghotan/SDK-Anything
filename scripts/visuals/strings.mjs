// Localized copy for the generated visual assets.
// Keep all human-readable diagram strings here so EN and zh-CN cannot drift.
// Code identifiers, commands, file paths, and product names stay unchanged.

export const copy = {
  en: {
    lang: "en",
    banner: {
      title: "SDK-Anything",
      tagline:
        "TypeScript/JavaScript SDKs → agent-native MCP tools, CLIs, and skills.",
      sub: "Static inspection · reviewable manifest · explicit effects",
      pipelineLabel: "PIPELINE",
      pipeline: ["SDK source", "Capability manifest", "MCP · CLI · Skill"],
      alt: "SDK-Anything banner: TypeScript or JavaScript SDKs become MCP tools, CLIs, and agent skills through a capability manifest.",
    },
    architecture: {
      eyebrow: "ARCHITECTURE",
      title: "One manifest, three agent surfaces",
      subtitle:
        "Static inspection turns TypeScript/JavaScript SDKs into a portable capability manifest.",
      sourcesLabel: "SDK SOURCES",
      sources: [
        ["npm package", "public registry or tarball"],
        ["Local source", "TypeScript / JavaScript"],
        ["Public GitHub", "repository snapshot"],
      ],
      resolver: {
        title: "Safe source resolver",
        lines: ["npm · local · GitHub", "bounded extraction", "no lifecycle scripts"],
      },
      analyzer: {
        title: "Static analyzer",
        lines: [
          "TypeScript AST + type checker",
          "no import · no execution",
          "evidence + diagnostics",
        ],
      },
      ai: {
        title: "Optional AI proposals",
        lines: ["OpenAI-compatible", "metadata only", "deterministic fallback"],
      },
      overrides: {
        title: "Human overrides",
        lines: ["client · effects", "secret references"],
      },
      manifest: {
        eyebrow: "CAPABILITY MANIFEST",
        title: "Capability manifest",
        schema: "sdk-anything/manifest/v1",
        badge: "SOURCE OF TRUTH",
        lines: [
          "typed operation inputs",
          "effect policy per operation",
          "env: secret references",
          "canonical, byte-stable JSON",
        ],
        footer: "portable · versioned · deterministic",
      },
      outputs: [
        ["MCP server", "stdio · typed tools"],
        ["Developer CLI", "JSON output · scriptable"],
        ["Agent skill", "SKILL.md usage guide"],
      ],
      runtime: {
        title: "Shared runtime",
        line: "schema validation · effects · secrets · caps · redaction",
        note: "Used by generated MCP servers and CLIs",
      },
      footnote:
        "Inspection is static: target SDK code is never imported or executed.",
      alt: "Architecture diagram: npm, local, or GitHub SDK sources pass through a safe resolver and static analyzer, then optional AI proposals and human overrides produce one capability manifest that feeds an MCP server, a CLI, and an agent skill.",
    },
    workflow: {
      eyebrow: "WORKFLOW",
      title: "From source to usable tools",
      subtitle:
        "Static checks come first. Execution tests are explicit about their isolation boundary.",
      staticLabel: "STATIC VERIFICATION",
      staticNote: "target code is not executed",
      steps: [
        ["1", "Inspect", "evidence inventory + diagnostics", "npm · local · GitHub"],
        ["2", "Review", "client · effects · secret refs", "optional when inference is ambiguous"],
        ["3", "Generate", "manifest + MCP + CLI + skill", "one manifest, three surfaces"],
        ["4", "Validate", "schema · parity · checksums", "no containers required"],
      ],
      testsLabel: "EXECUTION TESTS · OPTIONAL",
      trusted: {
        title: "Trusted-local execution",
        command: "test --trusted-local",
        lines: [
          "sanitized child process",
          "code you own and trust",
          "NOT a security sandbox",
        ],
      },
      container: {
        title: "Container isolation",
        command: "test --sandbox",
        lines: [
          "Docker or Podman required",
          "network none · read-only source",
          "no host credentials · fails closed",
        ],
      },
      use: {
        title: "Use",
        line: "MCP client · terminal automation · agent skill",
        note: "Generated MCP servers and CLIs enforce the same runtime policy.",
      },
      legend: ["primary flow", "optional path"],
      alt: "Workflow diagram: inspect, review overrides, generate, and validate statically; then optionally test with trusted-local execution or a container sandbox; finally use the generated MCP server, CLI, or agent skill.",
    },
    security: {
      eyebrow: "SECURITY",
      title: "Effects are explicit. Execution is bounded.",
      subtitle:
        "The shared runtime applies the same defaults to generated MCP servers and CLIs.",
      inspectionLabel: "STATIC INSPECTION",
      inspection: [
        "no target import",
        "no lifecycle scripts",
        "bounded archives",
        "content digest",
      ],
      policyLabel: "EFFECT POLICY",
      allowed: {
        title: "Allowed by default",
        items: ["pure", "read"],
        note: "Pure calculations and read-only queries.",
        tag: "default",
      },
      denied: {
        title: "Denied by default",
        items: ["write", "destructive", "unknown"],
        note: "Blocked before the SDK is invoked.",
        tag: "fail closed",
      },
      auth: {
        title: "Explicit authorization",
        commands: [
          "--allow-effects",
          "--allow-operations",
          "--allow-destructive",
        ],
        note: "MCP uses equivalent environment variables. Destructive calls also need confirmation when interactive.",
      },
      runtimeLabel: "RUNTIME PROTECTIONS",
      runtime: [
        "env: refs only",
        "runtime secret resolution",
        "error redaction",
        "100 items / 1 MB caps",
        "infinite-cursor guard",
        "no silent host fallback",
      ],
      footnote:
        "Trusted-local mode is not a sandbox. Container mode fails closed when Docker or Podman is unavailable.",
      alt: "Security diagram: inspection never imports target code or runs lifecycle scripts; pure and read effects are allowed by default, while write, destructive, and unknown effects require explicit authorization; runtime protections include env secret references, redaction, pagination caps, and fail-closed container behavior.",
    },
    transformation: {
      eyebrow: "TRANSFORMATION",
      title: "From SDK surface to atomic capabilities",
      subtitle:
        "The goal is a reviewable tool surface, not a magic wrapper around every symbol.",
      beforeLabel: "BEFORE · ORDINARY SDK",
      beforeTitle: "my-sdk",
      beforeKind: "TypeScript client package",
      beforeRows: [
        ["ApiClient", "class"],
        ["create()", "client method"],
        ["list()", "client method"],
        ["search()", "client method"],
        ["remove()", "client method"],
      ],
      beforeNote:
        "Types and JSDoc describe the API, but effects, secret handling, and result bounds are not expressed as agent policy.",
      middleTitle: "static analysis",
      middleNote: "reviewable evidence",
      loopTitle: "Diagnostics + overrides",
      loopLines: ["unresolved type", "reviewed override", "rerun inspection"],
      afterLabel: "AFTER · ATOMIC CAPABILITIES",
      afterRows: [
        ["search", "read", "typed query"],
        ["list", "read", "cursor pagination"],
        ["create", "write", "explicit grant"],
        ["remove", "destructive", "confirm or grant"],
      ],
      afterNote:
        "Typed inputs, effect labels, env: references, and bounded results are visible before an agent calls anything.",
      outputsLabel: "SAME MANIFEST",
      outputs: ["MCP server", "CLI", "Agent skill"],
      caveat:
        "Complex or unresolved types are surfaced as diagnostics. Overrides are the recovery path; conversion quality depends on the SDK's type surface.",
      alt: "Before-and-after diagram: an ordinary TypeScript SDK client becomes atomic operations with typed inputs and explicit read, write, or destructive effect labels; diagnostics and overrides recover unresolved types.",
    },
    ecosystem: {
      eyebrow: "ECOSYSTEM",
      title: "A manifest-centered ecosystem",
      subtitle:
        "One generated project carries the manifest, adapters, skill, and integrity inventory.",
      manifest: {
        eyebrow: "GENERATED PROJECT",
        title: "capability-manifest.json",
        schema: "sdk-anything/manifest/v1",
        lines: ["typed operations", "effect policy", "client + secrets", "provenance"],
      },
      inputs: {
        title: "Review inputs",
        lines: ["analyzer diagnostics", "sdk-anything.overrides.json"],
      },
      checks: {
        title: "Static checks",
        lines: ["validate: schema + parity", "doctor: files + environment"],
      },
      outputs: [
        {
          title: "MCP server",
          lines: ["official MCP SDK", "stdio transport", "typed tools"],
          hosts: "Claude Desktop · Cursor · Windsurf",
        },
        {
          title: "Developer CLI",
          lines: ["Commander.js", "JSON + stdin", "atomic commands"],
          hosts: "Terminal · shell pipelines · CI",
        },
        {
          title: "Agent skill",
          lines: ["SKILL.md", "usage + workflows", "same tool surface"],
          hosts: "Claude Code · Codex · OpenClaw",
        },
      ],
      filesLabel: "GENERATED FILES",
      files: [
        "capability-manifest.json",
        "mcp/",
        "cli/",
        "SKILL.md",
        ".sdk-anything-inventory.json",
      ],
      note:
        "Platform names describe documented connection paths, not endorsements.",
      alt: "Manifest-centered ecosystem diagram: one generated project contains capability-manifest.json, mcp/, cli/, SKILL.md, and an integrity inventory; it serves MCP clients, terminal and CI workflows, and agent skill hosts.",
    },
    features: {
      eyebrow: "CAPABILITIES",
      title: "What the tool surface includes",
      subtitle:
        "Implemented capabilities, with explicit boundaries where behavior is optional or environment-dependent.",
      cards: [
        [
          "Static analysis",
          "TypeScript AST + type checker. No SDK import or execution.",
        ],
        [
          "Capability manifest",
          "One versioned JSON source of truth for typed operations.",
        ],
        [
          "Generated CLI",
          "Commander.js CLI with JSON output, stdin, and atomic commands.",
        ],
        [
          "Generated MCP",
          "Official MCP SDK, stdio transport, and typed tools.",
        ],
        [
          "Agent skill",
          "SKILL.md generated from the same manifest and tool surface.",
        ],
        [
          "Safety controls",
          "pure/read allowed; write/destructive/unknown denied by default.",
        ],
        [
          "Diagnostics + overrides",
          "Unresolved types surfaced; reviewed overrides promote them.",
        ],
        [
          "Validate + doctor",
          "Schema, adapter parity, checksums, and environment health.",
        ],
        [
          "Optional AI",
          "OpenAI-compatible descriptions; deterministic fallback.",
        ],
      ],
      footnote:
        "Container sandbox testing requires Docker or Podman and fails closed when unavailable.",
      alt: "Feature cards: static analysis, capability manifest, generated CLI, generated MCP server, agent skill, safety controls, diagnostics and overrides, validate and doctor, and optional AI assistance.",
    },
    og: {
      kicker: "AGENT-NATIVE SDK TOOLING",
      title: "SDK-Anything",
      tagline:
        "Turn TypeScript/JavaScript SDKs into inspectable MCP tools, CLIs, and agent skills.",
      pipeline: ["SDK source", "Capability manifest v1", "MCP · CLI · Skill"],
      footer: "Static inspection · explicit effects · portable manifest",
      repo: "github.com/janghotan/SDK-Anything",
      alt: "SDK-Anything social preview: TypeScript or JavaScript SDKs flow into a capability manifest and out to MCP tools, a CLI, and an agent skill.",
    },
    release: {
      kicker: "RELEASE",
      version: "vX.Y.Z",
      title: "[Release title]",
      summary: "Replace this line with a one-sentence summary of the release.",
      boxes: [
        ["What changed", "[Add a concise bullet]"],
        ["Why it matters", "[Add a concise bullet]"],
        ["Upgrade notes", "[Add a concise bullet]"],
      ],
      templateNote: "editable SVG template",
      footer: "npm install -g sdk-anything · github.com/janghotan/SDK-Anything",
      alt: "Editable release announcement template with placeholders for version, title, summary, changes, impact, and upgrade notes.",
    },
  },

  zh: {
    lang: "zh",
    banner: {
      title: "SDK-Anything",
      tagline:
        "将 TypeScript/JavaScript SDK 转化为智能体可用的 MCP 工具、CLI 与技能。",
      sub: "静态审查 · 可复核清单 · 显式副作用",
      pipelineLabel: "流水线",
      pipeline: ["SDK 源码", "能力清单", "MCP · CLI · 技能"],
      alt: "SDK-Anything 横幅：TypeScript 或 JavaScript SDK 经能力清单转化为 MCP 工具、CLI 与智能体技能。",
    },
    architecture: {
      eyebrow: "架构",
      title: "一份清单，三种智能体接口",
      subtitle: "静态分析将 TypeScript/JavaScript SDK 转化为可移植的能力清单。",
      sourcesLabel: "SDK 来源",
      sources: [
        ["npm 包", "公开仓库或 tarball"],
        ["本地源码", "TypeScript / JavaScript"],
        ["GitHub 公开仓库", "仓库快照"],
      ],
      resolver: {
        title: "安全来源解析器",
        lines: ["npm · 本地 · GitHub", "有界解压", "不执行安装脚本"],
      },
      analyzer: {
        title: "静态分析器",
        lines: [
          "TypeScript AST + 类型检查",
          "不导入 · 不执行",
          "证据清单 + 诊断",
        ],
      },
      ai: {
        title: "可选 AI 提案",
        lines: ["兼容 OpenAI", "仅生成元数据", "失败时确定性回退"],
      },
      overrides: {
        title: "人工覆盖",
        lines: ["客户端 · 副作用", "密钥引用"],
      },
      manifest: {
        eyebrow: "清单规范",
        title: "能力清单",
        schema: "sdk-anything/manifest/v1",
        badge: "唯一事实来源",
        lines: [
          "强类型操作输入",
          "逐操作副作用策略",
          "env: 密钥引用",
          "稳定规范化 JSON",
        ],
        footer: "可移植 · 可版本化 · 确定性",
      },
      outputs: [
        ["MCP 服务", "stdio · 强类型工具"],
        ["开发者 CLI", "JSON 输出 · 可脚本化"],
        ["智能体技能", "SKILL.md 使用指南"],
      ],
      runtime: {
        title: "共享运行时",
        line: "模式校验 · 副作用策略 · 环境密钥 · 分页上限 · 敏感信息脱敏",
        note: "由生成的 MCP 服务与 CLI 共同使用",
      },
      footnote: "审查全程静态：绝不导入或执行目标 SDK 代码。",
      alt: "架构图：npm、本地或 GitHub 的 SDK 来源经过安全来源解析器与静态分析器，再结合可选 AI 提案与人工覆盖，生成一份能力清单，并输出 MCP 服务、CLI 与智能体技能。",
    },
    workflow: {
      eyebrow: "工作流",
      title: "从源码到可用的智能体工具",
      subtitle: "先做静态校验；执行测试必须明确选择运行边界。",
      staticLabel: "静态校验",
      staticNote: "不执行目标代码",
      steps: [
        ["1", "静态审查", "证据清单 + 诊断", "npm · 本地 · GitHub"],
        ["2", "人工复核", "客户端 · 副作用 · 密钥引用", "推断不明确时使用"],
        ["3", "生成", "清单 + MCP + CLI + 技能", "一份清单，三种接口"],
        ["4", "校验", "模式 · 一致性 · 校验和", "无需容器"],
      ],
      testsLabel: "执行测试 · 可选",
      trusted: {
        title: "本地受信执行",
        command: "test --trusted-local",
        lines: ["净化子进程", "仅用于你拥有且信任的代码", "不是安全沙箱"],
      },
      container: {
        title: "容器隔离",
        command: "test --sandbox",
        lines: [
          "需要 Docker 或 Podman",
          "无网络 · 只读源码",
          "无宿主凭据 · 故障闭锁",
        ],
      },
      use: {
        title: "使用",
        line: "MCP 客户端 · 终端自动化 · 智能体技能",
        note: "生成的 MCP 服务与 CLI 执行同一套运行时策略。",
      },
      legend: ["主流程", "可选路径"],
      alt: "流程图：先静态审查、人工复核覆盖、生成并校验；随后可选择本地受信执行或容器沙箱测试；最后使用生成的 MCP 服务、CLI 或智能体技能。",
    },
    security: {
      eyebrow: "安全",
      title: "副作用显式授权，执行严格有界",
      subtitle: "共享运行时为生成的 MCP 服务与 CLI 应用同一套默认策略。",
      inspectionLabel: "静态审查",
      inspection: [
        "不导入目标代码",
        "不执行安装脚本",
        "有界归档解压",
        "记录内容摘要",
      ],
      policyLabel: "副作用策略",
      allowed: {
        title: "默认允许",
        items: ["pure", "read"],
        note: "纯计算与只读查询。",
        tag: "默认",
      },
      denied: {
        title: "默认拒绝",
        items: ["write", "destructive", "unknown"],
        note: "在调用 SDK 之前拦截。",
        tag: "故障闭锁",
      },
      auth: {
        title: "显式授权",
        commands: [
          "--allow-effects",
          "--allow-operations",
          "--allow-destructive",
        ],
        note: "MCP 使用等价环境变量。交互式环境中的破坏性调用还需要确认。",
      },
      runtimeLabel: "运行时保护",
      runtime: [
        "仅保存 env: 引用",
        "运行时解析密钥",
        "错误信息脱敏",
        "100 条 / 1 MB 上限",
        "无限游标防护",
        "绝不静默回退宿主执行",
      ],
      footnote:
        "本地受信模式不是沙箱。容器模式在 Docker 或 Podman 缺失时故障闭锁。",
      alt: "安全图：静态审查绝不导入目标代码或执行安装脚本；pure 与 read 副作用默认允许，write、destructive 与 unknown 需要显式授权；运行时保护包括环境密钥引用、敏感信息脱敏、分页上限与容器故障闭锁。",
    },
    transformation: {
      eyebrow: "转化",
      title: "从 SDK 接口到原子能力",
      subtitle: "目标是可复核的工具面，而不是对所有符号做魔法包装。",
      beforeLabel: "改造前 · 普通 SDK",
      beforeTitle: "my-sdk",
      beforeKind: "TypeScript 客户端包",
      beforeRows: [
        ["ApiClient", "类"],
        ["create()", "客户端方法"],
        ["list()", "客户端方法"],
        ["search()", "客户端方法"],
        ["remove()", "客户端方法"],
      ],
      beforeNote:
        "类型与 JSDoc 描述了 API，但副作用、密钥处理与结果边界并未表达为智能体策略。",
      middleTitle: "静态分析",
      middleNote: "可复核证据",
      loopTitle: "诊断 + 人工覆盖",
      loopLines: ["未解析类型", "人工复核覆盖", "重新运行审查"],
      afterLabel: "改造后 · 原子能力",
      afterRows: [
        ["search", "read", "强类型查询"],
        ["list", "read", "游标分页"],
        ["create", "write", "需显式授权"],
        ["remove", "destructive", "确认或授权"],
      ],
      afterNote:
        "在智能体调用之前，强类型输入、副作用标签、env: 引用与结果上限都清晰可见。",
      outputsLabel: "同一份清单",
      outputs: ["MCP 服务", "CLI", "智能体技能"],
      caveat:
        "复杂或未解析类型会作为诊断暴露；人工覆盖是恢复路径。转化质量取决于 SDK 的类型表面。",
      alt: "前后对比图：普通 TypeScript SDK 客户端转化为带强类型输入与 read、write、destructive 副作用标签的原子操作；未解析类型通过诊断与人工覆盖恢复。",
    },
    ecosystem: {
      eyebrow: "生态",
      title: "以能力清单为中心的生态",
      subtitle: "一个生成项目同时包含清单、适配器、技能与完整性记录。",
      manifest: {
        eyebrow: "生成项目",
        title: "capability-manifest.json",
        schema: "sdk-anything/manifest/v1",
        lines: ["强类型操作", "副作用策略", "客户端 + 密钥", "来源信息"],
      },
      inputs: {
        title: "复核输入",
        lines: ["分析器诊断", "sdk-anything.overrides.json"],
      },
      checks: {
        title: "静态检查",
        lines: ["validate：模式 + 一致性", "doctor：文件 + 环境"],
      },
      outputs: [
        {
          title: "MCP 服务",
          lines: ["官方 MCP SDK", "stdio 传输", "强类型工具"],
          hosts: "Claude Desktop · Cursor · Windsurf",
        },
        {
          title: "开发者 CLI",
          lines: ["Commander.js", "JSON + stdin", "原子命令"],
          hosts: "终端 · Shell 管道 · CI",
        },
        {
          title: "智能体技能",
          lines: ["SKILL.md", "用法 + 工作流", "同一工具面"],
          hosts: "Claude Code · Codex · OpenClaw",
        },
      ],
      filesLabel: "生成文件",
      files: [
        "capability-manifest.json",
        "mcp/",
        "cli/",
        "SKILL.md",
        ".sdk-anything-inventory.json",
      ],
      note: "平台名称仅说明已验证的接入方式，不代表官方背书。",
      alt: "以能力清单为中心的生态图：一个生成项目包含 capability-manifest.json、mcp/、cli/、SKILL.md 与完整性记录，服务于 MCP 客户端、终端与 CI 工作流以及智能体技能宿主。",
    },
    features: {
      eyebrow: "能力",
      title: "工具面包含哪些能力",
      subtitle: "仅列出已实现能力，并明确可选功能或依赖环境的边界。",
      cards: [
        ["静态分析", "TypeScript AST 与类型检查；不导入、不执行 SDK。"],
        ["能力清单", "带版本号的 JSON 唯一事实来源，描述强类型操作。"],
        ["生成的 CLI", "Commander.js CLI，支持 JSON 输出、stdin 与原子命令。"],
        ["生成的 MCP", "官方 MCP SDK，stdio 传输与强类型工具。"],
        ["智能体技能", "由同一份清单与工具面生成 SKILL.md。"],
        ["安全控制", "pure/read 默认允许；write/destructive/unknown 默认拒绝。"],
        ["诊断 + 人工覆盖", "暴露未解析类型；经复核覆盖后晋升为可用操作。"],
        ["校验 + Doctor", "检查模式、适配器一致性、校验和与环境健康。"],
        ["可选 AI", "兼容 OpenAI 的描述增强；失败时确定性回退。"],
      ],
      footnote:
        "容器沙箱测试需要 Docker 或 Podman，环境缺失时故障闭锁。",
      alt: "功能卡片：静态分析、能力清单、生成的 CLI、生成的 MCP 服务、智能体技能、安全控制、诊断与人工覆盖、校验与 Doctor，以及可选 AI 辅助。",
    },
    og: {
      kicker: "AGENT-NATIVE SDK 工具链",
      title: "SDK-Anything",
      tagline:
        "将 TypeScript/JavaScript SDK 转化为可审查的 MCP 工具、CLI 与智能体技能。",
      pipeline: ["SDK 源码", "能力清单 v1", "MCP · CLI · 技能"],
      footer: "静态审查 · 显式副作用 · 可移植清单",
      repo: "github.com/janghotan/SDK-Anything",
      alt: "SDK-Anything 社交预览图：TypeScript 或 JavaScript SDK 流入能力清单，再输出 MCP 工具、CLI 与智能体技能。",
    },
    release: {
      kicker: "发布",
      version: "vX.Y.Z",
      title: "[版本标题]",
      summary: "用一句话概括本次发布。",
      boxes: [
        ["变更内容", "[填写简明要点]"],
        ["价值", "[填写简明要点]"],
        ["升级说明", "[填写简明要点]"],
      ],
      templateNote: "可编辑 SVG 模板",
      footer: "npm install -g sdk-anything · github.com/janghotan/SDK-Anything",
      alt: "可编辑的版本发布模板，包含版本、标题、摘要、变更、价值与升级说明的占位内容。",
    },
  },
};

export const iconMeta = {
  source: {
    title: "Source",
    desc: "npm package, local directory, or public GitHub repository.",
  },
  analyzer: {
    title: "Analyzer",
    desc: "Static TypeScript analysis without importing or executing the SDK.",
  },
  manifest: {
    title: "Manifest",
    desc: "Versioned capability manifest and typed operation inputs.",
  },
  mcp: {
    title: "MCP server",
    desc: "Generated stdio MCP server exposing typed tools.",
  },
  cli: {
    title: "CLI",
    desc: "Generated command-line interface with JSON output.",
  },
  skill: {
    title: "Agent skill",
    desc: "Generated SKILL.md aligned with the tool surface.",
  },
  security: {
    title: "Security",
    desc: "Explicit effect policy, secret references, and redaction.",
  },
  diagnostics: {
    title: "Diagnostics",
    desc: "Unresolved types and warnings surfaced for review.",
  },
  testing: {
    title: "Testing",
    desc: "Static checks, trusted-local tests, or a container sandbox.",
  },
};
