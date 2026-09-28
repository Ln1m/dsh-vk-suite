# dsh-vk-suite

[English](README.en.md) · 中文

![三栏布局（暗色）界面实拍](assets/vk-suite-layout.png)

*界面实拍：截自本机运行中的 DSH 实例，示例内容已脱敏。*

一套三栏 layout，5 个包合起来才成形。`dsh-vk-contract` 是契约，其余 4 个各填一格，都靠 `dsh.client.inject` 挂在契约上。

| 包 | 作用 |
|---|---|
| `dsh-vk-contract` | 生态契约：槽名常量、`vkCard` 注册 API、服务名；无运行时行为 |
| `dsh-vk-layout` | 骨架：区域宿主、标签条、槽接线与三个中立服务 |
| `dsh-vk-files` | 文件栏：文件树 + 应用内目录浏览器 + 最近打开 / 文件列表 |
| `dsh-vk-composer` | 输入区扩域：@ 引用数据源 + 文件搜索按钮 + 对话文件路径跳右栏 |
| `dsh-vk-cmdstrip` | 右栏下段命令行面板（官方终端本体） |

## 装

八个包都要装，先装契约：

```sh
dsh plugin --profile web add file:<本仓库>/dsh-vk-contract
dsh plugin --profile web add file:<本仓库>/dsh-vk-layout
dsh plugin --profile web add file:<本仓库>/dsh-vk-files
dsh plugin --profile web add file:<本仓库>/dsh-vk-composer
dsh plugin --profile web add file:<本仓库>/dsh-vk-cmdstrip
```

装完重启 web 实例。

## 配置

| 项 | 位置 | 默认 |
|---|---|---|
| 文件栏落地页常用根 | `dsh-vk-files/lib/client.js` 的 `HOME_DIRS` | `[]`，按需补自己的目录 |
| 桌面快捷入口 | 同文件 `DESKTOP_HINT` | 空；填自己的桌面路径才显示 |

## 前提

- 依赖官方 UI 包（`@deepseek-ai/dsh-client-ui-*`），由 DSH 运行时提供

## 与官方槽位的对照

vk 的槽分两类，契约表每条都带 `origin` 字段：

- **`official-alias`**：官方槽的**别名**，功能都能退回官方（插件不该硬依赖）
- **`vk-new`**：vk **独占的新增**，官方没有这个位置

| 区域 | 官方原生 | vk 的做法 |
|---|---|---|
| **左栏** | 只有一整块 `sidebar.workspaces`（会话/工作区浏览区），**没有 Tab**；另有 `sidebar.panellist`（全局面板图标，官方自己没用）与 `sidebar.footer.action`（设置旁的动作位） | 把浏览区改造成**四个 Tab**：会话（= 官方浏览区）、文件、任务、功能——其中「文件 / 任务 / 功能」是 `vk-new`；底部动作位是官方槽的别名 |
| **中间会话栏** | `main`（中央面板）、`conversation.session.header.*`、`conversation.input.left / right / dock / …` | **不动**，只做别名转发；插件可以直接挂官方槽（技能档已改挂官方 `conversation.input.dock`） |
| **右栏拓展栏** | `rightbar` + `sidebar.right.pane.tab`（keyed：按 id 分发 Tab 正文） | 查看器 / 打开本机文件 都是官方 keyed 槽的别名；**底部命令行面板是 `vk-new`** |
| **设置页** | `settings.section`（一个列表项 = 一页，可用自定义 id） | 三个分区是 `settings.section(id=…)` 的别名 |
| **帧级** | `shell.overlay` | 覆盖层是别名；**底部状态栏是 `vk-new`** |

**给插件作者**：优先挂官方槽；只有要用「左栏第 2/3/4 个 Tab、底部命令行、状态栏」这类 vk 独占位置时，才用 `vk.*` 槽。

## 给别的插件留的位置

契约表里 `provider: null` 的行就是预留位：第三方插件不用改骨架，直接占。

```js
const { VK, vkCard } = require('dsh-vk-contract');
vkCard(ctx, { slot: VK.statusbar.left, id: 'my-lan-link', order: 10, component: MyLanLink });
```

自己的包要在 package.json 里声明 `dsh.client.inject: ["dsh-vk-contract"]`，`require` 才拿得到契约。

| 预留位 | 用途 |
|---|---|
| `vk.statusbar.left` | 局域网链接：本机 LAN 访问地址、局域网服务清单 |
| `vk.statusbar.right` | 公网链接：隧道 / 反代 / 分享地址 |
| `vk.rightbar.tools` | 第三方右栏工具页（标签页） |
| `vk.input.left` | 输入区左侧按钮位 |
| `vk.session.header.left` | 会话头左侧动作 |
| `vk.overlay` | 全屏浮层 |
| `vk.settings.extra` | 设置页「扩展」分区（现由 dsh-skill-sets 占） |

状态栏与浮层要先有宿主：装了 `dsh-vk-layout` 骨架才有这些位置。
