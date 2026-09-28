# dsh-vk-suite

[中文](README.md) · English

![Three-column layout (dark)](assets/vk-suite-layout.png)

*Screenshot of a running DSH instance; demo content is sanitized.*

A three-column layout for DSH. It takes all 5 packages to form: `dsh-vk-contract` is the contract, the other 4 each fill one pane and hook onto the contract through `dsh.client.inject`.

| Package | Role |
|---|---|
| `dsh-vk-contract` | Ecosystem contract: slot-name constants, the `vkCard` registration API, service names. No runtime behaviour |
| `dsh-vk-layout` | Skeleton: area hosts, tab strip, slot wiring and three neutral services |
| `dsh-vk-files` | Files column: file tree + in-app directory browser + recent files / file list |
| `dsh-vk-composer` | Composer: @-references to data sources + file-search button + jump from a chat path to the right column |
| `dsh-vk-cmdstrip` | Command strip at the bottom of the right column (the official terminal itself) |

## Install

All eight packages are required; install the contract first:

```sh
dsh plugin --profile web add file:<this repo>/dsh-vk-contract
dsh plugin --profile web add file:<this repo>/dsh-vk-layout
dsh plugin --profile web add file:<this repo>/dsh-vk-files
dsh plugin --profile web add file:<this repo>/dsh-vk-composer
dsh plugin --profile web add file:<this repo>/dsh-vk-cmdstrip
```

Restart the web instance afterwards.

## Configuration

| Item | Where | Default |
|---|---|---|
| Landing-page roots for the files column | `HOME_DIRS` in `dsh-vk-files/lib/client.js` | `[]` — add your own directories |
| Desktop shortcut entry | `DESKTOP_HINT` in the same file | empty; set your own desktop path to show it |

## Requirements

- Depends on the official UI packages (`@deepseek-ai/dsh-client-ui-*`), provided by the DSH runtime

## Official-vs-vk slot map

Every vk slot carries an `origin` field:

- **`official-alias`**: an **alias of an official slot** — the feature can always fall back to the official one (plugins should not hard-depend on vk)
- **`vk-new`**: something **vk adds** with no official counterpart

| Area | Official | What vk does |
|---|---|---|
| **Sidebar** | One single `sidebar.workspaces` browsing region, **no tabs**; plus `sidebar.panellist` (global panel icons, unused by the official UI) and `sidebar.footer.action` | Turns the browsing region into **four tabs**: Sessions (= official region), Files, Tasks, Extensions — the last three are `vk-new`; the footer seat is an official alias |
| **Center (conversation)** | `main`, `conversation.session.header.*`, `conversation.input.left / right / dock / …` | Untouched — alias forwarding only; plugins may register in the official slots directly (dsh-skill-sets uses the official `conversation.input.dock`) |
| **Right column** | `rightbar` + `sidebar.right.pane.tab` (keyed by id) | Viewer / Open-local-file are aliases of the official keyed slot; the **bottom command strip is `vk-new`** |
| **Settings** | `settings.section` (one list entry = one page, custom id allowed) | All three sections are aliases of `settings.section(id=…)` |
| **Frame-wide** | `shell.overlay` | Overlay is an alias; the **status bar is `vk-new`** |

**Plugin authors**: prefer the official slots; reach for `vk.*` only when you need a vk-only seat (sidebar tabs 2–4, the bottom command strip, the status bar).

## Slots reserved for other plugins

Rows with `provider: null` in the contract table are reserved slots: a third-party plugin claims one without touching the skeleton.

```js
const { VK, vkCard } = require('dsh-vk-contract');
vkCard(ctx, { slot: VK.statusbar.left, id: 'my-lan-link', order: 10, component: MyLanLink });
```

Your own package must declare `dsh.client.inject: ["dsh-vk-contract"]` in its package.json before `require` resolves the contract.

| Reserved slot | Intended for |
|---|---|
| `vk.statusbar.left` | LAN links: local LAN access URLs, local service lists |
| `vk.statusbar.right` | Public links: tunnels / reverse proxies / share URLs |
| `vk.rightbar.tools` | Third-party right-column tool page (a tab) |
| `vk.input.left` | Slot left of the composer |
| `vk.session.header.left` | Session-header left actions |
| `vk.overlay` | Full-screen overlay |
| `vk.settings.extra` | "Extensions" section in Settings (currently taken by dsh-skill-sets) |

Status bar and overlay need a host first: they exist once `dsh-vk-layout` is installed.
