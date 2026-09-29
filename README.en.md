# dsh-vk-suite

[中文](README.md) | English

Three-column layout skeleton plus the settings centre: slot contract, shell, settings pages

## Packages

| Directory | What it does |
|---|---|
| `dsh-vk-contract` | Slot contract: slot table, pane registry, neutral service names |
| `dsh-vk-layout` | Layout shell: left/right tab hosts, settings host, overlay seats |
| `dsh-vk-settings` | Settings pages owned by the skeleton: Skill management and MCP management |
| `dsh-vk-settings-hub` | Settings centre: own left-column nav over the official panel, plugin market + enable/disable tabs, ZIP archive page |

## Release lines

| Release | DSH line | Notes |
|---|---|---|
| `v0.1.2` | 0.1.7 | Features developed on the local DSH 0.1.7 line; this update |
| `v0.1.0` | 0.1.6 | Last release of the DSH 0.1.6 line; stays usable, no further updates |

## Install

```sh
# one package
dsh plugin --profile web add file:<this repo>/dsh-vk-contract
```

Or install the whole family on Windows PowerShell:

```powershell
./install.ps1
```

Install straight from the release, no clone needed:

```sh
dsh plugin --profile web add "https://github.com/Ln1m/dsh-vk-suite/releases/download/v0.1.2/dsh-vk-contract-0.1.2.tgz"
dsh plugin --profile web add "https://github.com/Ln1m/dsh-vk-suite/releases/download/v0.1.2/dsh-vk-layout-0.1.2.tgz"
dsh plugin --profile web add "https://github.com/Ln1m/dsh-vk-suite/releases/download/v0.1.2/dsh-vk-settings-0.1.2.tgz"
dsh plugin --profile web add "https://github.com/Ln1m/dsh-vk-suite/releases/download/v0.1.2/dsh-vk-settings-hub-0.1.2.tgz"
```

If the install fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (a TLS-intercepting proxy; Node does not read the system CA store by default), run `$env:NODE_OPTIONS='--use-system-ca'` first.

Restart the web instance afterwards. Each package directory carries its own README.

## Screenshots

![dsh-vk-layout](dsh-vk-layout/assets/vk-suite-layout.png)

## License

MIT
