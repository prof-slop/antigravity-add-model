<p align="center">
  <img src="gateway/dashboard/antigravity-logo.png" width="96" height="96" alt="Google Antigravity logo">
</p>

<h1 align="center">Antigravity Custom Model Enabler — 增强版分支 (Enhanced Fork)</h1>

<p align="center">
  <strong>属于你的服务商。属于你的本地模型。交互式生成式 UI。零干扰的账号池故障转移。</strong><br>
  适用于桌面端应用、Antigravity IDE 以及可选网关的高级模型路由、多账号配额自动故障转移与富交互组件渲染。
</p>

<p align="center">
  <a href="https://github.com/prof-slop/antigravity-add-model/actions/workflows/ci.yml"><img src="https://github.com/prof-slop/antigravity-add-model/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="#安装指南"><img src="https://img.shields.io/badge/Node.js-22.13%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 22.13 or newer"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-2563eb" alt="Apache License 2.0"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>简体中文</strong> · <a href="README_es.md">Español</a> · <a href="README_tr.md">Türkçe</a> · <a href="README_ru.md">Русский</a> · <a href="README_hi.md">हिन्दी</a> · <a href="README_ar.md">العربية</a>
</p>

<p align="center">
  <a href="#本分支新增特性"><strong>本分支新增特性</strong></a> ·
  <a href="#生成式-ui-与-csp-解锁演示">生成式 UI 演示</a> ·
  <a href="#安装指南">快速开始</a> ·
  <a href="#快速链接">快速链接</a> ·
  <a href="#与上游仓库同步">与上游仓库同步</a> ·
  <a href="https://github.com/prof-slop/antigravity-add-model/issues/new">提交问题 (Issue)</a>
</p>

---

在 Antigravity 内置模型的基础上，无缝添加外部 API 服务商、本地模型与多账号 Google Cloud Code 配额池。你可以在设置（Settings）中完成配置，直接在对话模型选择器中切换模型，在聊天流中内联渲染交互式 HTML/WebGL 组件，还可以按需通过网关（Gateway）路由请求，从而获得请求历史记录、备用服务商回退（Fallback）以及可视化浏览器控制台等功能。

> [!IMPORTANT]
> **独立的 Electron 桌面端应用**请使用下方的增量安装程序。独立的**基于 VS Code 的 Antigravity IDE** 则使用专属的[设置适配器与本地 Web 管理器](docs/ide.md)。安装前请先查阅[兼容性说明](docs/compatibility.md)。

---

## 本分支新增特性

本仓库（`prof-slop/antigravity-add-model`）基于 [`vahapogut/antigravity-add-model`](https://github.com/vahapogut/antigravity-add-model) 构建，针对重度开发者增加了以下核心增强：

| 增强特性 | 功能说明 |
| --- | --- |
| **生成式 UI 与沙箱解锁 (`cspPreload` + [`skills/generative_ui`](skills/generative_ui/SKILL.md))** | 放宽内容安全策略（`script-src`、`style-src`、`font-src`、`connect-src`、`worker-src`）并自动升级受限的 `<iframe>` 沙箱属性（`allow-scripts allow-forms allow-downloads allow-modals`）。支持在 Antigravity 对话中直接加载外部公共 CDN 并渲染交互式 3D WebGL（`Three.js`）、数学绘图（`JSXGraph`、`Plotly.js`）、`KaTeX`、`D3` 以及 `Chart.js + jStat`。仓库内置可选的 [`generative_ui` 技能包](skills/generative_ui/SKILL.md)以发挥最佳渲染效果。 |
| **全系列原生 Google 账号池故障转移** | 单个启用了 **Native Failover** 的 `google-cloudcode` 账号池会自动覆盖同一模型家族下的**所有推理强度变体**（`low`、`medium`、`high`、`xhigh`、`tiered`、`thinking` —— 如 `gemini-4-argon-low/medium/high` 或 `gemini-3.8-flash-low/medium/high/tiered`），在主账号触发 `429` 配额限制时无缝切流。 |
| **零干扰模型选择器** | 仅用于后台 **Native Failover** 的 Google Cloud Code 账号池会自动从聊天模型下拉选择器中隐藏，保持下拉菜单清爽，同时在后台保持激活并可在 **Settings → Custom Models** 中管理。 |
| **长流式传输心跳保活与工具调用容错** | 在缓冲大型流式工具调用参数（例如 OpenRouter 上高推理模型生成的 40 KB `write_file` 载荷）期间，每 5 秒向下游发送 `: keepalive` SSE 心跳，并将流式超时预算延长至 15 分钟，防止慢速 FP4/思考端点中途断连。 |
| **多轮工具调用推理保留与子代理路由** | 在兼容 OpenAI 的多轮工具调用及自定义 `invoke_subagent` 路由（`$model`、`customModelId`）中完整保留 `reasoning_content` / `<thinking>` 思考链。 |
| **零硬编码密钥的强化版 OAuth 提取** | 源码与 `dist/` 中均不包含任何硬编码 `GOCSPX-` 密钥。运行时通过不可逆的 64 位 SHA-256 配对指纹（`6f5c1920f8566f36`）及序号回退机制直接从本地 `language_server` 二进制文件中提取个人 OAuth 凭据，并动态适配 `process.platform` / `process.arch` User-Agent。 |

## 快速链接

| 快速上手 | 配置与连接 | 帮助与项目信息 |
| --- | --- | --- |
| [安装指南](#安装指南) | [可选网关与 Web 控制台](#可选网关与-web-控制台) | [故障排查与恢复](#更新诊断与恢复) |
| [添加你的第一个模型](#添加你的第一个模型) | [从另一台设备连接](#从另一台设备连接) | [受支持的应用版本与目录结构](docs/compatibility.md) |
| [服务商与模型目录](docs/providers.md) | [模型详细配置](docs/configuration.md) | [更新日志 (Changelog)](CHANGELOG.md) |
| [开发与贡献](#开发与贡献) | [Google 账号池设置](docs/configuration.md#google-cloud-code-account-pools) | [浏览现有 Issue](https://github.com/vahapogut/antigravity-add-model/issues) |
| [Antigravity IDE 配置指南](docs/ide.md) | [基于源码的功能特性对比](docs/feature-parity.md) | [IDE 状态检查与还原](docs/ide.md#status-and-recovery) |

## 核心功能

| 功能特性 | 包含内容 |
| --- | --- |
| **模型管理** | 按服务商分组、搜索、编辑、复制、启用/禁用以及模型自动发现。 |
| **连接主流与本地服务商** | 支持 OpenAI、Anthropic、Gemini、OpenRouter、[Cloudflare Workers AI](docs/providers.md#cloudflare-workers-ai) 等兼容 API；支持 Ollama、LM Studio、vLLM 等本地推理服务。 |
| **精细化请求调优** | 协议选择、推理/思考（Reasoning）参数设置、上下文/输出长度限制、自定义请求头、超时控制、自动重试、回退模型（Fallback）及熔断器（Circuit Breaker）。 |
| **选择子代理模型** | 内置模型或自定义模型均可通过 `invoke_subagent` 将任务委派给已配置并启用的模型；并行子代理的路由相互独立，切换服务商时保留原始工具调用历史。[配置说明](docs/configuration.md#subagent-model-selection)。 |
| **Google 账号池支持** | 使用受识别的 IDE **2.5.5** 安装通过 **Antigravity account** 登录，或使用自己的 OAuth 客户端；支持项目准备、凭据加密存储、配额检查、自适应账号选择及模型级别的冷却时间。[真实登录、令牌刷新与生成验证结果](docs/configuration.md#verified-google-account-flow)。 |
| **账号卡片管理** | 可折叠面板支持启用/停用账号、修改标签、从池中移除及 Preferred/Automatic 切换。各池的项目与配额独立保留；套餐标识仅使用提供商返回的数据。Native fallback 开关仅使用模型精确匹配的 Cloud Code 池，不转向公开 Gemini API。[详情](docs/configuration.md#quota-panel-and-preferred-accounts)。 |
| **可见上下文估算** | 识别到原生模型选择器后，只读圆环以 `~` 标记估算、以 `?` 标记用量未知。隐藏提示词、工具定义和图片不计入。优先采用已配置的上下文上限；点击后可通过有时间和大小限制的公开 models.dev 目录查询缺失上限，不修改配置。[估算范围](docs/configuration.md#native-context-estimate)。 |
| **直连请求诊断** | 内置诊断工具，可查看近期请求、实测延迟/Token 消耗，并提供显式的轻量生成测试。 |
| **连接 Antigravity IDE** | 可逆的设置适配器、托管代理启动器与浏览器端模型管理器；已在 Windows IDE 2.5.5 上配合本地 OpenAI 兼容服务商验证原生模型选择器与流式对话。[查看配置指南](docs/ide.md)。 |
| **保持原生模型选择稳定** | 为模型别名和推理强度变体提供持久、无冲突的 ID，并支持明确的[原生选择器容量管理](docs/ide.md#native-model-identities-and-capacity)。 |
| **配置导入与分享** | 经过校验的 JSON/Base64 导入与导出，自动剔除已保存的敏感凭据以保障安全。 |
| **Web 可视化控制台** | 可选配网关，支持服务商路由、请求/会话历史记录、请求重放、统计图表以及成本估算。 |
| **远程安全连接** | 支持通过 SSH 隧道或配置的网络端点进行带身份验证的远程网关访问。 |

安装程序会完整保留已安装应用的原生运行时，仅注入经过校验的钩子（Hooks）。它会按版本保留独立备份，并在部署失败时自动回滚。有关实现细节与功能范围，请参阅[功能特性对比](docs/feature-parity.md)。

## 界面截图

### 生成式 UI 与 CSP 解锁演示

启用 [`src/cspPreload.ts`](src/cspPreload.ts) 后，Antigravity 的 `<agent-embed>` 内联框架能够在保障宿主沙箱隔离的前提下，直接从公共 CDN 加载科学计算、图形学与 3D WebGL 引擎（**Three.js**、**Plotly.js**、**JSXGraph**、**D3.js**、**Mermaid**、**Chart.js + jStat** 与 **KaTeX**）：

<p align="center">
  <a href="assets/showcase_distributions_dark.png">
    <img src="assets/showcase_distributions_dark.png" width="1000" alt="在 Antigravity 对话流中内联渲染的 Chart.js + jStat 交互式高斯混合分布图表">
  </a>
  <br>
  <em><strong>交互式统计分布看板 (Chart.js + jStat)</strong> — 在对话流中通过 <code>sigma</code> 滑块实时驱动零闪烁的数据集原地更新。</em>
</p>

| **D3.js 力导向引擎拓扑图（暗色模式）** | **Three.js 3D WebGL 流形（亮色模式）** |
| :---: | :---: |
| <a href="assets/showcase_d3_graph_dark.png"><img src="assets/showcase_d3_graph_dark.png" width="490" alt="Antigravity 内联渲染的 D3.js 可拖拽节点力导向仿真"></a> | <a href="assets/showcase_threejs_light.png"><img src="assets/showcase_threejs_light.png" width="490" alt="亮色主题下的 Three.js WebGL 环面纽结流形与 900 粒子群"></a> |
| *支持拖拽节点的交互式物理力导向布局（`d3@7`）。* | *实时 WebGL 环面纽结流形 + 900 粒子群（`three@0.160.0`），支持明暗主题无缝切换。* |

> [!TIP]
> **推荐使用内置技能包以获得最佳效果（可选）：** 尽管 [`src/cspPreload.ts`](src/cspPreload.ts) 已在运行时底层解锁了外部 CDN 与 iframe 脚本执行，但 Antigravity 默认的内置提示词仍倾向于回退到保守的静态 SVG 或字符画。
>
> 为获得最佳开箱体验，建议安装项目附带的 [`skills/generative_ui`](skills/generative_ui/SKILL.md) 技能包（包含完整的 CDN 路由矩阵、`requestAnimationFrame` 零闪烁更新规范、`<430px` 无滚动条卡片布局以及无头截图脚本）。该技能包**完全可选**——你可以直接使用、按需修改，或编写自己的技能包：
> ```sh
> # 全局安装（对所有工作区生效，推荐）：
> mkdir -p ~/.gemini/config/skills
> cp -R skills/generative_ui ~/.gemini/config/skills/generative_ui
>
> # 或仅针对当前工作区安装：
> mkdir -p .agents/skills
> cp -R skills/generative_ui .agents/skills/generative_ui
> ```

---

### 模型管理器 (Model management)

在同一界面中搜索模型、按服务商分组整理，并集中编辑、复制或启用连接。

<p align="center">
  <a href="assets/model_manager.jpg"><img src="assets/model_manager.jpg" width="1000" alt="展示服务商分组、模型搜索、自动发现、导入导出及远程网关控件的自定义模型管理器"></a>
</p>

*在独立浏览器演示环境中渲染的当前插件控件及示例模型配置。点击图片可查看原图大小。*

### 模型编辑器 (Model editor)

配置服务商与模型、选择 API 协议格式，或自动探测可用模型。

<p align="center">
  <a href="assets/model_editor.jpg"><img src="assets/model_editor.jpg" width="1000" alt="包含服务商、API 格式、模型 ID、模型发现及高级设置的模型编辑器"></a>
</p>

### 远程网关 (Remote gateway)

保存网关连接、导入模型别名，并一键打开管理控制台。

<p align="center">
  <a href="assets/remote_gateway.jpg"><img src="assets/remote_gateway.jpg" width="1000" alt="包含网关 URL、脱敏 Token、控制台 URL、连接测试及模型别名导入的远程网关对话框"></a>
</p>

### 网关控制台 (Gateway dashboard)

在可选的 Web 面板中将模型别名映射到具体服务商，并配置备用回退模型及上下文窗口限制。

<p align="center">
  <a href="assets/model_gateway.jpg"><img src="assets/model_gateway.jpg" width="1000" alt="展示自定义模型别名、服务商选择、回退设置及上下文窗口控制的网关控制台"></a>
</p>

*本地测试配置文件中的当前网关界面；图中所示的模型映射关系仅供演示。*

<details>
<summary><strong>桌面端对话模型选择器 — 早期版本预览</strong></summary>

<p align="center">
  <img src="assets/chat_model_dropdown.png" width="720" alt="在 Antigravity 对话选择器中与内置模型并列显示的自定义模型">
</p>

*早期桌面版本示例。实际显示的模型名称与可用性取决于你配置的服务商。*

</details>

## 安装指南

### 1. 获取项目并构建

你需要安装**独立的 Antigravity 桌面端应用**、Git 以及 **Node.js 22.13 或更高版本**。该 Node 版本同时支持桌面端插件和可选网关。

```sh
git clone https://github.com/prof-slop/antigravity-add-model.git
cd antigravity-add-model
npm ci --ignore-scripts
npm run build
```

已经克隆过仓库？请先拉取最新代码（`git pull`），然后重新运行依赖安装与构建命令。

正在使用 **Antigravity IDE**？请前往阅读 [IDE 配置指南](docs/ide.md)，而无需运行下方的独立版安装命令。IDE 版的基本流程如下：

```sh
npm run ide:check -- --resources "/path/to/Antigravity IDE/resources"
npm run ide:apply -- --resources "/path/to/Antigravity IDE/resources"
npm run proxy:start -- --open
npm run ide:launch -- --resources "/path/to/Antigravity IDE/resources"
```

### 2. 检查并为已安装的应用打补丁

请先完全关闭 Antigravity 及其语言服务器（Language Server）进程。在仓库根目录下运行：

```sh
node scripts/deploy.mjs --check
node scripts/deploy.mjs
```

第一条命令仅检查兼容性，不会修改已安装的文件；第二条命令正式应用插件补丁。部署成功后重新打开 Antigravity 即可。

如果自动检测未能找到你的应用安装位置，请为两条命令指定相同的显式路径：

```sh
node scripts/deploy.mjs --check --resources "/path/to/Antigravity/resources"
node scripts/deploy.mjs --resources "/path/to/Antigravity/resources"
```

`--resources` 参数支持传入 `resources` 目录、应用安装根目录或 macOS 的 `.app` 包路径。在替换任何应用文件之前，安装程序会自动拒绝未知或不兼容的目录结构。

<details>
<summary><strong>各平台封装脚本与可选的 Windows 端点补丁</strong></summary>

各平台封装脚本底层调用同一个安装程序，并支持完全相同的命令行参数。

| 平台 | 封装脚本 |
| --- | --- |
| Windows / PowerShell | `./deploy.ps1` |
| macOS 独立桌面版 | `bash deploy.sh` |
| Linux | `bash deploy_linux.sh` |

部分已识别的 Windows 语言服务器（Language Server）二进制文件会绕过可配置的模型列表端点。针对此类版本，可以检查并应用可选的二进制补丁：

```powershell
.\deploy.ps1 --check --patch-language-server
.\deploy.ps1 --patch-language-server
```

该选项固定占用端口 **50999**，并同样纳入备份与回滚机制中，仅适用于受识别的 Windows 二进制文件。详情请参阅 [Windows 端点补丁说明](docs/compatibility.md#optional-windows-language-server-endpoint-patch)。

</details>

## 添加你的第一个模型

1. 打开 **Settings → Models & Usage**（在较早版本的界面中为 **Models**）。
2. 在 **Custom Models** 区域，点击 **Add model** 并选择一个服务商（Provider）。
3. 根据需要填写 **API URL** 和 **API key**。
4. 使用下方任一方式添加模型，保存后即可在对话窗口的模型选择器中切换使用。

| 添加方式 | 操作步骤 |
| --- | --- |
| **手动输入模型** | 输入准确的 **Provider model ID**（服务商模型 ID），可按需设置显示名称（Display Name），然后依次点击 **Test connection → Save model**。 |
| **从服务商目录中选择** | 点击 **Fetch provider models** 拉取列表，按名称或 ID 搜索，勾选所需模型或点击 **Select filtered**，最后点击 **Add selected**。 |

**在本地运行模型？** 请先启动本地推理服务（如 Ollama 等），然后点击 **Discover local**。本地探测仅在你主动点击时扫描常用端口。

**在多台设备间迁移配置？** 请使用 **Export**（导出）与 **Import**（导入）功能。导出的配置文件会自动剔除 API 密钥、自定义请求头以及 Google 令牌/客户端密钥；请在目标设备上重新输入相应凭据。

> [!NOTE]
> 连接测试成功仅代表模型列表拉取或身份认证通过，并不会实际发起对话生成，也无法证明账户拥有充足的生成配额。对于不提供模型列表查询接口的服务商，依然可以通过手动输入模型 ID 的方式完成配置。

### 支持的服务商与高级选项

| 连接类型 | 预设目录中包含的服务商示例 |
| --- | --- |
| 多模型聚合平台 | OpenRouter、Together AI、Hugging Face Inference Providers、Fireworks AI、SiliconFlow（硅基流动）、Novita AI |
| 官方直连 API | OpenAI、Anthropic、Google Gemini、DeepSeek、Groq、Mistral、xAI、Cerebras、SambaNova、Alibaba Cloud Model Studio（阿里云百炼 / DashScope）、NVIDIA NIM |
| 本地推理服务 | Ollama、LM Studio、llama.cpp、vLLM、LocalAI、TabbyAPI、Text Generation WebUI |
| 其他自定义端点 | LiteLLM、兼容的自定义端点（Custom Endpoint）或带身份认证的模型网关 |

预设项（Presets）会自动填充默认参数；**API format**（API 格式）决定了请求协议的转换方式。具体的模型 ID 与访问权限取决于对应服务商。完整列表可查看[服务商预设目录源码](src/providers.ts)。

**需要接入数百种模型选择？** OpenRouter 等多模型聚合平台支持通过 **Fetch provider models** 实时获取在线模型目录。你可以搜索并勾选所需模型；插件会自动导入可用的上下文/输出长度限制以及视觉（Image）/推理（Reasoning）元数据，同时保留你手动设置的覆盖项。模型目录会随时间动态更新，列出的模型仍需你的账户具备相应访问权限及任务所需能力。详情请参阅[服务商配置与模型发现](docs/providers.md)。

**使用视觉（识图）模型？** 桌面端代理支持将图片输入原生转发至兼容 OpenAI 和 Anthropic 协议的端点（包括支持多模态视觉的 DeepSeek 模型）。关于能力覆盖开关、支持的图片格式与端点要求，请参阅[图片输入配置指南](docs/configuration.md#image-inputs)。

展开 **Advanced settings**（高级设置）可配置请求限制、推理思考参数、自定义请求头、备用回退模型及其他覆盖选项。各字段定义与导入示例请参阅[配置参考文档](docs/configuration.md)。

如需使用 Google 账号池，请选择 **Google Cloud Code account pool** 并按照[账号池配置指南](docs/configuration.md#google-cloud-code-account-pools)操作。可通过受识别的 IDE **2.5.5** 安装使用 **Antigravity account** 登录，也可选择 **My Desktop OAuth client** 使用自己的客户端；账号与服务的可用资格仍由服务商控制。

## 可选网关与 Web 控制台

桌面端插件可以直接连接各模型服务商。当你希望实现集中式路由管理、浏览器端可视化配置、请求历史记录审计或远程端点访问时，可以额外部署网关（Gateway）。

```sh
npm run gateway:install
npm run gateway:build
npm run gateway -- setup --non-interactive
npm run gateway -- start
```

初始化命令（`setup`）会在本地终端打印生成的网关 Token 和控制台登录凭据。在浏览器中打开 **http://127.0.0.1:51001** 并登录，配置服务商凭据与模型别名后保存。

随后在桌面端的 **Remote gateway**（远程网关）对话框中填入：

| 字段 | 本地配置值 |
| --- | --- |
| Gateway URL | `http://127.0.0.1:51000` |
| Gateway token | `setup` 命令打印输出的 Token |
| Dashboard URL | `http://127.0.0.1:51001` |

点击 **Test gateway** 测试连接，然后点击 **Import model aliases** 导入模型别名。导入的模型会直接出现在桌面端的模型选择器中。点击 **Open dashboard** 即可在浏览器中打开已保存的控制台地址。

<details>
<summary><strong>常用网关管理命令</strong></summary>

```sh
npm run gateway -- status
npm run gateway -- logs
npm run gateway -- stop
```

在 Web 控制台中保存的服务商/模型更改会立即热重载生效；监听地址与端口的更改则需要重启网关。历史记录包含提示词（Prompts）、响应内容及工具调用参数；费用统计为估算值。

</details>

### 从另一台设备连接

在能够访问模型服务商的主机上运行网关，然后在客户端设备上通过 SSH 转发这两个端口：

```sh
ssh -N -L 51000:127.0.0.1:51000 -L 51001:127.0.0.1:51001 user@gateway-host
```

保持 SSH 隧道开启，并在客户端上使用上表中的本地回环地址（`127.0.0.1`）即可。默认情况下，网关的两个监听端口均仅绑定到本地回环地址（Loopback）。如需配置显式的局域网/公网监听或 HTTPS 反向代理，请参阅[远程访问指南](gateway/README.md#remote-access)。

## 架构与工作流原理

```mermaid
flowchart LR
    Desktop["Antigravity 桌面端"] --> Proxy["本地模型代理 (Local Proxy)"]
    Proxy --> Builtin["内置 Google 模型"]
    Proxy --> Providers["外部 API / 本地模型"]
    Proxy --> Gateway["可选网关 (Optional Gateway)"]
    Gateway --> Providers
    Dashboard["Web 控制台 + 历史记录"] --- Gateway
```

本插件在保留官方原生运行时的前提下增量注入 `customPreload` 与 `cspPreload`。可选网关则作为独立的 Node.js 进程运行，并使用其专属的数据目录。

## 与上游仓库同步

本分支将 [`vahapogut/antigravity-add-model`](https://github.com/vahapogut/antigravity-add-model) 作为 `upstream` 跟踪，同时在 `main` 分支上维护自定义增强功能。当上游发布新版本时，可通过以下流程同步更新并保留本分支特性：

```sh
# 1. 首次添加 upstream 远程仓库（如尚未添加）
git remote add upstream https://github.com/vahapogut/antigravity-add-model.git

# 2. 拉取上游更新并将本分支提交变基（rebase）到 upstream/main 之上
git fetch upstream
git rebase upstream/main

# 3. 重新编译 dist/、运行测试并重新部署到 Antigravity
npm run build && npm test && node scripts/deploy.mjs

# 4. 推送更新后的分支到个人远程库
git push --force-with-lease origin main
```

## 更新、诊断与恢复

每当 Antigravity 客户端升级后，请先重新构建插件并再次运行兼容性检查，确认无误后再重新部署。

| 需求场景 | 执行命令 |
| --- | --- |
| 检查构建产物、模型配置与本地服务状态 | `npm run doctor` |
| 以 JSON 格式输出诊断结果 | `npm run doctor -- --json` |
| 检查指定路径下的安装兼容性 | `npm run patch:check -- --resources "/path/to/Resources"` |
| 向受支持的安装目录重新应用插件 | `npm run doctor:repair -- --resources "/path/to/Resources"` |
| 还原此安装程序创建的备份 | `npm run patch:restore -- --resources "/path/to/Resources"` |

执行修复（`repair`）或还原（`restore`）前请先关闭应用。如使用 Windows 语言服务器二进制补丁，请附带相应的端点补丁参数。若检测到应用文件已被后续的官方更新覆盖修改，还原程序会拒绝覆盖以保护新版本文件。

| 常见问题现象 | 排查起点 |
| --- | --- |
| 安装程序报告 `NOT_SUPPORTED` 或 `UNSUPPORTED_RUNTIME` | 确认你安装的是独立桌面版应用，并核对[受支持的目录结构与版本](docs/compatibility.md)。 |
| 应用更新后出现黑屏 | 请按照[启动恢复指南](docs/compatibility.md#black-screen-after-an-update)操作；切勿随意还原旧版本的备份归档。 |
| 模型未显示在列表中 | 检查该模型是否已启用、已保存，并确认填写的 Provider model ID 准确无误。 |
| 服务商返回 401、403 或 404 错误 | 检查 API 密钥凭据、账户权限/所在地区限制、API URL 格式以及模型名称是否可用。 |
| 端口 50999 被占用 | 应用了二进制补丁的 Windows 版本需要固定占用该端口；未打二进制补丁的常规模式可自由选用其他端口。 |
| TLS 连接失败 | 检查目标端点的 SSL 证书有效性以及系统的受信任根证书（CA）配置。 |

更多详情请参阅：[兼容性与故障恢复](docs/compatibility.md) · [模型配置参考](docs/configuration.md)

## 凭据与数据安全

| 组件 | 存储位置与安全机制 |
| --- | --- |
| 桌面端插件 | 模型配置保存在 `~/.gemini/antigravity/custom_models.json`。已保存的 API 密钥、自定义请求头、网关 Token 及 Google 凭据均经过加密存储，并在编辑器中脱敏显示。 |
| 加密回退机制 | 当操作系统级安全存储不可用时，将回退使用本地 AES-256-GCM 加密，密钥保存在 `~/.gemini/antigravity/.model-credentials-key`。进行私人备份时请妥善保管该密钥文件。 |
| 模型配置导出 | 导出时会自动剔除已保存的 API 密钥、自定义请求头以及 Google 令牌/客户端密钥，仅保留常规模型配置字段。 |
| 可选网关 | 使用独立的 `~/.gemini/antigravity/gateway` 配置目录。其凭据配置与 Electron 桌面端存储相互独立；历史记录中包含请求与响应正文内容。 |

请使用 **Export** 功能安全地分享模型配置。在直接复制本地配置文件夹之前，请先阅读[数据处理说明](docs/configuration.md#credentials-and-data)与[网关存储机制](gateway/README.md#lifecycle-and-data)。

## 文档指南

| 文档名称 | 涵盖内容 |
| --- | --- |
| [配置参考手册 (Configuration reference)](docs/configuration.md) | 模型配置字段、导入格式规范、Google 账号池及凭据管理 |
| [服务商与模型目录 (Providers and model catalogs)](docs/providers.md) | 主流服务商、API 端点地址、大型目录自动发现及账户要求 |
| [网关指南 (Gateway guide)](gateway/README.md) | 网关部署、路由规则、Web 控制台、生命周期管理与远程访问 |
| [兼容性与恢复 (Compatibility and recovery)](docs/compatibility.md) | 受支持的目录结构、版本更新、备份机制与故障排查 |
| [功能特性对比 (Feature comparison)](docs/feature-parity.md) | 参考仓库对比、已实现特性及差异说明 |
| [更新日志 (Changelog)](CHANGELOG.md) | 最新改动与历史版本发布记录 |
| [网关溯源说明 (Gateway provenance)](gateway/UPSTREAM.md) | 上游源码版本记录与保留的许可证声明 |

## 开发与贡献

桌面端插件采用 TypeScript 编写（位于 `src/` 目录），并编译输出至纳入版本控制的 `dist/` 目录。可选网关作为独立包位于 `gateway/` 目录下。

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run lint
```

如需开发或测试网关及集成功能：

```sh
npm run gateway:install
npm run gateway:build
npm run gateway:test
npm run test:integration
```

CI 自动化测试基于本地模拟服务商数据（Fixtures）和隔离安装包在 Windows、macOS 和 Linux 三大平台上运行。CI 不会验证真实服务商的在线凭据，也无法预验证未来发布的每一个 Antigravity 新版本。

如需新增服务商预设，请从[桌面端服务商预设目录](src/providers.ts)、[协议注册表](src/proxy/registry.ts)以及[网关服务商目录](gateway/src/provider-catalog.ts)入手。提交更改时请附带相应的单元测试并重新构建桌面端产物（`dist/`）。非常欢迎提交 Pull Request；如遇可复现的 Bug，请附带你的应用类型/版本号、操作系统及诊断信息[提交 Issue](https://github.com/vahapogut/antigravity-add-model/issues)。

## 开源许可与致谢

本项目基于 [Apache License 2.0](LICENSE) 开源。改编自上游的网关组件保留其原有的 [MIT 许可证](gateway/LICENSE.upstream)及[上游归属声明](gateway/UPSTREAM.md)。

Antigravity 徽标来自 [Google 官方媒体资源库](https://antigravity.google/press)。

本分支由 **[prof-slop](https://github.com/prof-slop/antigravity-add-model)** 维护 · 上游项目由 **[vahapogut](https://github.com/vahapogut/antigravity-add-model)** 维护

<p align="center"><a href="#快速链接">↑ 返回快速链接</a></p>
