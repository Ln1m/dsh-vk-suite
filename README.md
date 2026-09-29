# dsh-vk-suite

[English](README.en.md) · 中文

![三栏布局（暗色）界面实拍](assets/vk-suite-layout.png)

*界面实拍：截自本机运行中的 DSH 实例，示例内容已脱敏。*

框架仓，只有两个包：契约 + 骨架。骨架给全三栏的位置——左栏 Tab、右栏 Tab、**右栏下段命令行面板**；其余功能插件各自独立成仓，按槽位注册进来。

| 包 | 作用 |
|---|---|
| `dsh-vk-contract` | 生态契约：槽名常量、`vkCard` 注册 API、服务名；无运行时行为 |
| `dsh-vk-layout` | 骨架：左栏 Tab 宿主、右栏 Tab 宿主（含右栏下段命令行面板）、槽接线与三个中立服务 |

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
| **右栏拓展栏** | `rightbar` + `sidebar.right.pane.tab`（keyed：按 id 分发 Tab 正文） | 查看器 / 打开本机文件 都是官方 keyed 槽的别名；**右栏下段命令行面板由骨架自带**（官方终端本体，自建宿主、不占槽） |
| **设置页** | `settings.section`（一个列表项 = 一页，可用自定义 id） | 三个分区是 `settings.section(id=…)` 的别名 |
| **帧级** | `shell.overlay` | 覆盖层是别名 |

## 独立成仓的功能插件

| 仓库 | 装了什么 |
|---|---|
| [dsh-files](https://github.com/Ln1m/dsh-files) | `dsh-files-tree`：左栏「文件」Tab（文件树 + 应用内目录浏览器 + 最近打开）+ 输入区 `@` 引用；`dsh-files-open`：右栏「打开本机文件」 |
| [dsh-viewer](https://github.com/Ln1m/dsh-viewer) | 右栏「查看器」：Office / 网页 / 图片 / 文本预览 |
| [dsh-lt-tasks](https://github.com/Ln1m/dsh-lt-tasks) | 左栏「任务」Tab |
| [dsh-tools](https://github.com/Ln1m/dsh-tools) | 左栏「工具」Tab（范例） |
| [dsh-lan-services](https://github.com/Ln1m/dsh-lan-services) | 左栏「工具」Tab（局域网服务） |
| [dsh-wallet](https://github.com/Ln1m/dsh-wallet) / [dsh-archive-button](https://github.com/Ln1m/dsh-archive-button) | 左栏底部动作位 |

## 推荐怎么用 / 会跟谁冲突

左栏那四个 Tab（会话 / 文件 / 任务 / 工具）是**本骨架**提供的，功能插件只往槽里放内容：

- **功能插件各有两个版本**：各仓 `main` = **vk 版**（只注册 vk 槽，必须配本骨架），另有 `official` 分支 = **官方挂载版**（零 vk 依赖，只挂官方槽）。**推荐用 vk 版**：左栏 Tab 切换与右栏、设置的位置都在骨架里，只有 vk 版装得进这些位置；目前 `dsh-files`、`dsh-tools` 两仓还没有官方挂载版。
- **推荐一起装**：左栏功能插件（[dsh-files](https://github.com/Ln1m/dsh-files) 的文件树、[dsh-lt-tasks](https://github.com/Ln1m/dsh-lt-tasks) 的任务、[dsh-tools](https://github.com/Ln1m/dsh-tools) / [dsh-lan-services](https://github.com/Ln1m/dsh-lan-services) 的工具、[dsh-wallet](https://github.com/Ln1m/dsh-wallet) / [dsh-archive-button](https://github.com/Ln1m/dsh-archive-button) 的底部动作位）**和本骨架配成一套用**：不装骨架时它们注册的槽没人声明，页面上什么都不多；只装骨架不装功能插件时，后三个 Tab 是空的。
- **冲突按槽判定**（不是报错，是静默遮蔽）：同一槽位**同优先级**重复注册会抛错，**不同优先级**只有最高的那条渲染。本骨架占的槽：`sidebar.workspaces`（左栏正文，priority -2）、`conversation.session.header.corner`（会话头右上，-2）、`settings.section`（设置页分区）、`conversation.input.left`、`conversation.input.dock`、`sidebar.right.pane.tab`（keyed，按 tab id 分发）、`shell.overlay`。
- **同类布局插件不要叠**：两个「三栏布局」类插件同时装，只有一个的左栏 / 右栏形状生效，另一个的按钮会整块不出现——这是槽位规则，不是报错。
- **终端接管**：右栏下段的命令行面板不占槽（自建宿主），但按官方「终端」条目接管 `sidebar.right.pane.tab` 的一条 key；同样接管终端 tab 的插件会与它互斥。
- 和官方界面本身不冲突：骨架动过的都是官方槽的别名转发，卸掉骨架后官方界面原样可用。

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
