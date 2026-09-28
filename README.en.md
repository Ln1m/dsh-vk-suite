# dsh-vk-suite

[中文](README.md) · English

![Three-column layout (dark)](assets/vk-suite-layout.png)

*Screenshot of a running DSH instance; demo content is sanitized.*

A framework repo with just two packages: contract + skeleton. The skeleton provides every three-column position — left-column tabs, right-column tabs and **the command panel in the right column's lower segment**; other feature plugins live in their own repos and register into slots.

| Package | Role |
|---|---|
| `dsh-vk-contract` | Ecosystem contract: slot-name constants, the `vkCard` registration API, service names. No runtime behaviour |
| `dsh-vk-layout` | Skeleton: the left-column tab host, the right-column tab host (including the command panel in its lower segment), slot wiring and three neutral services |

## Install

```sh
dsh plugin --profile web add file:<this repo>/dsh-vk-contract
dsh plugin --profile web add file:<this repo>/dsh-vk-layout
```

Restart the web instance afterwards. The skeleton only provides positions; what lands in them is up to the individual plugins.

## What the skeleton does

| Area | Official | What vk does |
|---|---|---|
| **Sidebar** | One single `sidebar.workspaces` browsing region, **no tabs**; plus `sidebar.panellist` (global panel icons) and `sidebar.footer.action` | Turns the browsing region into **four tabs**: Sessions (= official region), Files, Tasks, Extensions — the last three are `vk-new`; the footer seat is an official alias |
| **Center (conversation)** | `main`, `conversation.session.header.*`, `conversation.input.*` | Untouched — alias forwarding only; plugins may register in the official slots directly |
| **Right column** | `rightbar` + `sidebar.right.pane.tab` (keyed by id) | Viewer / Open-local-file are aliases of the official keyed slot; **the command panel in the lower segment ships with the skeleton** (the official terminal, own host node, no slot) |
| **Settings** | `settings.section` (one list entry = one page, custom id allowed) | All three sections are aliases of `settings.section(id=…)` |
| **Frame-wide** | `shell.overlay` | Overlay is an alias |

## Feature plugins, each in its own repo

| Repo | Contents |
|---|---|
| [dsh-files](https://github.com/Ln1m/dsh-files) | `dsh-files-tree`: the sidebar "Files" tab (file tree + in-app directory browser + recent files) plus the composer's `@` references; `dsh-files-open`: the right-column "Open local file" tab |
| [dsh-viewer](https://github.com/Ln1m/dsh-viewer) | Right-column "Viewer": Office / web / image / text preview |
| [dsh-lt-tasks](https://github.com/Ln1m/dsh-lt-tasks) | The sidebar "Tasks" tab |
| [dsh-tools](https://github.com/Ln1m/dsh-tools) | The sidebar "Extensions" tab (example) |
| [dsh-lan-services](https://github.com/Ln1m/dsh-lan-services) | The sidebar "Extensions" tab (LAN services) |
| [dsh-wallet](https://github.com/Ln1m/dsh-wallet) / [dsh-archive-button](https://github.com/Ln1m/dsh-archive-button) | The sidebar footer seat |

## Slots reserved for other plugins

Rows with `provider: null` in the contract table are reserved slots: a third-party plugin claims one without touching the skeleton.

```js
const { VK, vkCard } = require('dsh-vk-contract');
vkCard(ctx, { slot: VK.overlay, id: 'my-overlay', order: 10, component: MyOverlay });
```

Your own package must declare `dsh.client.inject: ["dsh-vk-contract"]` in its package.json before `require` resolves the contract.

| Reserved slot | Intended for |
|---|---|
| `vk.input.left` | Slot left of the composer |
| `vk.input.right` | Action seat right of the composer |
| `vk.session.header.left` | Session-header left actions |
| `vk.overlay` | Full-screen overlay |

Every contract row carries an `origin` field: `official-alias` means an alias of an official slot (the feature can always fall back), `vk-new` means something vk adds with no official counterpart. Check whether an official slot already fits before reaching for `vk.*`.
