# dsh-vk-suite

一套三栏 layout，8 个包合起来才成形。`dsh-vk-contract` 是契约，其余 7 个各填一格，都靠 `dsh.client.inject` 挂在契约上。

| 包 | 作用 |
|---|---|
| `dsh-vk-contract` | 生态契约：槽名常量、`vkCard` 注册 API、服务名；无运行时行为 |
| `dsh-vk-layout` | 骨架：区域宿主、标签条、槽接线与三个中立服务 |
| `dsh-vk-files` | 文件栏：文件树 + 应用内目录浏览器 + 最近打开 / 文件列表 |
| `dsh-vk-composer` | 输入区扩域：@ 引用数据源 + 文件搜索按钮 + 对话文件路径跳右栏 |
| `dsh-vk-viewer` | 右栏查看器：Office 文档 / 网页 / 图片 / 文本预览 |
| `dsh-vk-settings` | 设置页分区：全局人设 / Skill 管理 / MCP 管理 |
| `dsh-vk-terminal` | 会话头重启入口：两击确认 + 后端探针复位 |
| `dsh-vk-cmdstrip` | 右栏下段命令行面板（官方终端本体） |

## 装

八个包都要装，先装契约：

```sh
dsh plugin --profile web add file:<本仓库>/dsh-vk-contract
dsh plugin --profile web add file:<本仓库>/dsh-vk-layout
dsh plugin --profile web add file:<本仓库>/dsh-vk-files
dsh plugin --profile web add file:<本仓库>/dsh-vk-composer
dsh plugin --profile web add file:<本仓库>/dsh-vk-viewer
dsh plugin --profile web add file:<本仓库>/dsh-vk-settings
dsh plugin --profile web add file:<本仓库>/dsh-vk-terminal
dsh plugin --profile web add file:<本仓库>/dsh-vk-cmdstrip
```

装完重启 web 实例。

## 配置

| 项 | 位置 | 默认 |
|---|---|---|
| 文件栏落地页常用根 | `dsh-vk-files/lib/client.js` 的 `HOME_DIRS` | `[]`，按需补自己的目录 |
| 桌面快捷入口 | 同文件 `DESKTOP_HINT` | `D:\Desktop` |

## 前提

- 依赖官方 UI 包（`@deepseek-ai/dsh-client-ui-*`），由 DSH 运行时提供
- 关掉官方 sidebar 布局插件后再用本套三栏

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