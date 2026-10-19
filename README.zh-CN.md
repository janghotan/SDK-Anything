<p align="center">
  <img src="assets/sdk-anything-banner-zh.png" alt="SDK-Anything 横幅" width="100%">
</p>

<p align="center">
  <strong>将任何 TypeScript / JavaScript SDK 转化为可测试、可直接供 AI 代理使用的工具。</strong>
</p>

<p align="center">
  <a href="#核心特性">核心特性</a> •
  <a href="#快速上手">快速上手</a> •
  <a href="#核心工作流">核心工作流</a> •
  <a href="#能力清单规范">清单规范</a> •
  <a href="#安全与沙箱隔离">安全模型</a> •
  <a href="#接入-ai-代理">代理接入</a> •
  <a href="README.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20_LTS-339933?logo=node.js&logoColor=white" alt="Node.js 版本">
  <img src="https://img.shields.io/badge/TypeScript-5.7+-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/MCP-1.32+-8A2BE2?logo=anthropic&logoColor=white" alt="Model Context Protocol">
  <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="许可证">
</p>

---

## 项目概述

**SDK-Anything** 旨在消除传统开发者 SDK 与现代 AI 智能体（Agent）之间的鸿沟。无需手动为每个 SDK 手写工具定义或胶水代码，SDK-Anything 能够通过静态分析目标源码或 npm 包，直接生成标准版本化的**能力清单**（`sdk-anything/manifest/v1`）。

基于这份统一的事实清单，SDK-Anything 可以自动生成：
- 🔌 **官方标准 MCP 服务器**：基于 `@modelcontextprotocol/sdk` 构建的 Stdio 服务，直接向 AI 暴露类型安全的工具。
- ⌨️ **开发者 CLI 命令行**：支持人类友好交互与机器可读 `--json` 的自动化命令。
- 🤖 **代理技能文档 (`SKILL.md`)**：提供丰富的上下文指导，指导 LLM 代理如何在推理循环中发现、配置和组合原子操作。

> [!IMPORTANT]
> **静态安全第一：** 分析与检查阶段绝不导入或执行目标包代码，严格跳过 npm 安装生命周期脚本（如 `prepare`、`postinstall`）。

---

## 核心特性

- **确定性 API 提取：** 利用 TypeScript 编译器底层 API（`noEmit: true`），解析导出函数、声明文件、JSDoc 注释及复杂类型，精确降级为 JSON Schema Draft 2020-12。
- **单事实来源：** MCP 工具、CLI 命令、副作用安全策略与代理使用说明全部派生自同一份能力清单。
- **透明可审查的代码：** 生成可直接阅读、修改与构建的标准 TypeScript 源码，无任何隐式动态代理或 `eval`。
- **仅引用机密模型：** 敏感凭据（如 API 密钥、Token）绝不会硬编码在清单、生成代码或提示词中，仅通过环境变量引用（`env:API_KEY`）。
- **保守的副作用控制：** 纯函数计算与已验证的读取操作默认启用；写入、破坏性操作和未识别操作默认禁用，并在运行时严格拦截。
- **防逃逸容器沙箱：** 静态校验无需外部环境；测试不受信任的代码时必须使用真实容器沙箱（`--sandbox`，依赖 Docker/Podman），环境缺失时立即故障闭锁（Fail-Closed），绝不静默降级为本地执行。
- **可选 AI 辅助层：** 支持配置兼容 OpenAI 的接口以生成可读性更高的摘要和分组，具备严格的提示词注入防御隔离机制。

---

## 快速上手

### 环境要求

- Node.js >= 20.0.0（支持 v20、v22、v24 LTS）
- [pnpm](https://pnpm.io/) >= 9.0.0

### 安装与构建

```bash
# 克隆代码仓库
git clone https://github.com/your-org/sdk-anything.git
cd sdk-anything

# 安装依赖
pnpm install

# 编译项目
pnpm run build

# 全局软链接 CLI（可选）
pnpm link --global
```

---

## 核心工作流

```text
源定位符 (npm:包名, 本地目录, GitHub 公开仓库)
       │
       ▼
确定性静态分析器 (TypeScript Compiler AST & TypeChecker)
       │
       ▼
证据清单 (导出项、类型定义、文档、未解决项诊断)
       │
       ▼
人工审查覆盖引擎 (可选 sdk-anything.overrides.json)
       │
       ▼
能力清单规范 (sdk-anything/manifest/v1)
       │
 ┌─────┴─────────────────────┐
 ▼                           ▼
生成的 MCP 服务器       生成的 CLI 与 SKILL.md
(Stdio 协议传输)        (Commander.js 与说明文档)
       │                           │
 └─────┬─────────────────────┘
       ▼
通用运行时引擎 (参数模式校验、副作用策略拦截、分页与输出截断)
```

### 1. 检查 SDK

对公开 npm 包、本地工程目录或 GitHub 公开仓库进行静态审查：

```bash
# 审查公开 npm 包
sdk-anything inspect npm:@turf/turf

# 审查本地 TypeScript/JavaScript SDK 仓库
sdk-anything inspect ./path/to/my-sdk

# 输出格式化的 JSON 证据数据
sdk-anything inspect npm:@turf/turf --json
```

### 2. 配置覆盖规则（可选）

针对具有复杂构造工厂、类型歧义或需要配置特定认证环境变量的 SDK：

```bash
# 生成 starter 覆盖规则模板
sdk-anything inspect ./path/to/my-sdk --write-overrides
```

生成的 `sdk-anything.overrides.json` 示例：

```json
{
  "schemaVersion": "sdk-anything/overrides/v1",
  "client": {
    "construction": "class",
    "export": "ApiClient",
    "options": {
      "apiKey": {
        "type": "secret",
        "source": "env:MY_SERVICE_API_KEY",
        "required": true
      }
    }
  },
  "operations": {
    "records.delete": {
      "effect": "destructive",
      "enabledByDefault": false
    }
  }
}
```

### 3. 生成 MCP 服务器、CLI 与代理技能

```bash
# 生成 MCP 服务器与 CLI 到指定目录
sdk-anything generate npm:@turf/turf \
  --targets mcp,cli \
  --output ./generated/turf-tools

# 可选：启用 AI 辅助生成更详尽的操作描述
sdk-anything generate npm:@turf/turf \
  --targets mcp,cli \
  --ai \
  --output ./generated/turf-tools
```

### 4. 静态验证

对生成的清单格式、TypeScript 编译和命令一致性进行静态校验：

```bash
sdk-anything validate ./generated/turf-tools
```

### 5. 运行验证测试

```bash
# 本地受信任代码：在净化后的子进程中测试
sdk-anything test ./generated/turf-tools --trusted-local

# 不受信任的第三方包：在隔离的 Docker/Podman 容器中测试
sdk-anything test ./generated/turf-tools --sandbox
```

> [!WARNING]
> `--trusted-local` 仅在净化环境变量后的宿主进程中运行，**并不构成操作系统的安全边界**。测试来自不受信第三方的代码时，必须使用 `--sandbox`。

---

## 能力清单规范

生成的能力清单文件严格遵循 `schema/capability-manifest.schema.json` 规范：

```json
{
  "schemaVersion": "sdk-anything/manifest/v1",
  "generatorVersion": "0.1.0",
  "source": {
    "kind": "npm",
    "package": "@turf/turf",
    "version": "7.2.0",
    "digest": "sha256:0123456789abcdef..."
  },
  "operations": [
    {
      "id": "distance",
      "name": "distance",
      "summary": "Calculate distance between two points",
      "description": "Calculates the distance between two points in degrees, radians, miles, or kilometers.",
      "invoke": {
        "kind": "top-level-function",
        "functionName": "distance"
      },
      "inputSchema": {
        "type": "object",
        "properties": {
          "from": { "type": "array" },
          "to": { "type": "array" },
          "options": { "type": "object" }
        },
        "required": ["from", "to"],
        "additionalProperties": false
      },
      "effect": "pure",
      "enabledByDefault": true,
      "result": { "mode": "direct" },
      "provenance": {
        "sourceFile": "src/index.ts",
        "confidence": "high"
      }
    }
  ],
  "unresolved": []
}
```

---

## 安全与沙箱隔离

### 副作用分级策略

所有操作均划分到严格的副作用层级中：

| 副作用级别 | 默认状态 | 说明 |
|---|---|---|
| `pure` | **默认启用** | 无状态纯计算（如几何距离计算、格式转换） |
| `read` | **默认启用** | 不改变系统状态的远程或本地读取（如 `list`、`get`） |
| `write` | **默认禁用** | 状态修改型操作（如 `create`、`update`） |
| `destructive` | **默认禁用** | 具有破坏性的删除操作（如 `delete`、`drop`）。CLI 交互式调用时强制确认 |
| `unknown` | **默认禁用** | 存在歧义或未明确验证副作用的操作 |

### 凭据安全模型

- 凭据绝不固化在代码、清单文件或版本控制中。
- 配置通过 `env:VARIABLE_NAME` 进行解析。
- 运行时日志和错误追踪会自动脱敏匹配常见认证头或凭据格式的内容（显示为 `Bearer [REDACTED]`）。

### 有界分页截断

为了防止大模型被海量数据淹没并引发上下文内存溢出，分页调用具备严格限制：
- 单次调用最大条目限制（默认：100 条）。
- 单次调用最大响应字节限制（默认：1 MB）。

---

## 接入 AI 代理

### 配置 Claude Desktop

在 `claude_desktop_config.json` 中添加生成的 MCP 服务：

```json
{
  "mcpServers": {
    "turf-tools": {
      "command": "node",
      "args": ["/absolute/path/to/generated/turf-tools/mcp/dist/server.js"],
      "env": {
        "API_KEY": "你的Token（如需要）"
      }
    }
  }
}
```

### 配置 Cursor / Windsurf

在项目的 `.cursor/mcp.json` 中配置：

```json
{
  "mcpServers": {
    "my-sdk": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/generated/my-sdk/mcp/server.ts"]
    }
  }
}
```

### 通过 Agent Skill 调用

每个生成的项目均包含一份量身定制的 `SKILL.md`，提供：
- 所有可用原子工具的详细说明与输入参数约束。
- 指导大模型在推理步骤中如何将原子工具依次串联组合的示例。
- 错误恢复与分页参数说明。

---

## 项目工程结构

```text
sdk-anything/
├── schema/
│   └── capability-manifest.schema.json  # Manifest v1 JSON Schema 模式定义
├── skills/
│   └── sdk-anything/SKILL.md            # 宿主智能体编排技能
├── src/
│   ├── cli/                             # CLI 命令、配置与入口
│   ├── source/                          # 安全的 npm/本地/GitHub 解析器
│   ├── analyzer/                        # TypeScript 编译器静态分析与类型降级
│   ├── manifest/                        # 清单构建、校验与规范化序列化
│   ├── runtime/                         # 通用运行时、策略拦截器与凭据管理
│   ├── generators/                      # MCP 服务、CLI 与 SKILL.md 生成器
│   ├── ai/                              # 可选 AI 提案客户端与隐私告知
│   └── sandbox/                         # 静态检测与容器执行沙箱
├── tests/                               # 11 组全面的自动化测试套件
├── examples/
│   ├── turf/                            # 纯函数黄金范例
│   └── client-sdk/                      # 具备网络与认证的客户端 SDK 范例
└── docs/
    ├── architecture.md                  # 详尽的系统架构规范
    └── security.md                      # 安全模型与隔离设计
```

---

## 质量保障与测试矩阵

运行全套自动化测试套件：

```bash
# 运行 59 项自动化单元测试、集成测试与端到端测试
pnpm test

# 严格的 TypeScript 类型检查
pnpm run typecheck

# 检查代码风格与 Lint 规范
pnpm run lint

# 编译生成生产级别产物
pnpm run build
```
