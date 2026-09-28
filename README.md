# dsh-vk-suite

[English](README.en.md) · 中文

![三栏布局（暗色）界面实拍](assets/vk-suite-layout.png)

*界面实拍：截自本机运行中的 DSH 实例，示例内容已脱敏。*

框架仓，只有两个包：契约 + 骨架。功能插件各自独立成仓，按槽位注册进来，骨架里没有业务。

| 包 | 作用 |
|---|---|
| `dsh-vk-contract` | 生态契约：槽名常量、`vkCard` 注册 API、服务名；无运行时行为 |
| `dsh-vk-layout` | 骨架：左栏 Tab 宿主、右栏 Tab 宿主、槽接线与三个中立服务 |

## 装

```sh
dsh plugin --profile web add file:<本仓库>/dsh-vk-contract
dsh plugin --profile web add file:<本仓库>/dsh-vk-layout
```

装完重启 web 实例。骨架只提供位置，位置里放什么由各自的插件决定。

## 骨架做了什么

| 区域 | 官方原生 | vk 的做法 |
|---|---|---|
| **左栏** | 只有一整块 `sidebar.workspaces`（会话/工作区浏览区），**没有 Tab**；另有 `sidebar.panellist`（全局面板图标）与 `sidebar.footer.action`（设置旁的动作位） | 把浏览区改造成**四个 Tab**：会话（= 官方浏览区）、文件、任务、工具——后三个是 `vk-new`；底部动作位是官方槽的别名 |
| **中间会话栏** | `main`、`conversation.session.header.*`、`conversation.input.*` | **不动**，只做别名转发；插件可以直接挂官方槽 |
| **右栏拓展栏** | `rightbar` + `sidebar.right.pane.tab`（keyed：按 id 分发 Tab 正文） | 查看器 / 打开本机文件 都是官方 keyed 槽的别名 |
| **设置页** | `settings.section`（一个列表项 = 一页，可用自定义 id） | 三个分区是 `settings.section(id=…)` 的别名 |
| **帧级** | `shell.overlay` | 覆盖层是别名 |

## 独立成仓的功能插件

| 仓库 | 装了什么 |
|---|---|
| [dsh-files](https://github.com/Ln1m/dsh-files) | `dsh-files-tree`：左栏「文件」Tab（文件树 + 应用内目录浏览器 + 最近打开）+ 输入区 `@` 引用；`dsh-files-open`：右栏「打开本机文件」 |
| [dsh-viewer](https://github.com/Ln1m/dsh-viewer) | 右栏「查看器」：Office / 网页 / 图片 / 文本预览 |
| [dsh-cmdstrip](https://github.com/Ln1m/dsh-cmdstrip) | 右栏下段命令行面板（官方终端本体），自建宿主，不占槽 |
| [dsh-lt-tasks](https://github.com/Ln1m/dsh-lt-tasks) | 左栏「任务」Tab |
| [dsh-tools](https://github.com/Ln1m/dsh-tools) | 左栏「工具」Tab（范例） |
| [dsh-lan-services](https://github.com/Ln1m/dsh-lan-services) | 左栏「工具」Tab（局域网服务） |
| [dsh-wallet](https://github.com/Ln1m/dsh-wallet) / [dsh-archive-button](https://github.com/Ln1m/dsh-archive-button) | 左栏底部动作位 |

## 给别的插件留的位置

契约表里 `provider: null` 的行就是预留位：第三方插件不用改骨架，直接占。

```js
const { VK, vkCard } = require('dsh-vk-contract');
vkCard(ctx, { slot: VK.overlay, id: 'my-overlay', order: 10, component: MyOverlay });
```

自己的包要在 package.json 里声明 `dsh.client.inject: ["dsh-vk-contract"]`，`require` 才拿得到契约。

| 预留位 | 用途 |
|---|---|
| `vk.input.left` | 输入区左侧按钮位 |
| `vk.input.right` | 输入区右侧动作位 |
| `vk.session.header.left` | 会话头左侧动作 |
| `vk.overlay` | 全屏浮层 |

契约表每条都带 `origin` 字段：`official-alias` = 官方槽的别名（功能可退回官方），`vk-new` = vk 独占的新增（官方没有这个位置）。用 `vk.*` 之前先看官方槽够不够。
