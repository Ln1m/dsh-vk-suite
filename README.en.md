# dsh-vk-suite

[中文](README.md) | English

Three-column layout skeleton: slot contract + shell

## Packages

| Directory | What it does |
|---|---|
| `dsh-vk-contract` | Slot contract: slot table, pane registry, neutral service names |
| `dsh-vk-layout` | Layout shell: left/right tab hosts, settings host, overlay seats |

## Install

```sh
# one package
dsh plugin --profile web add file:<this repo>/dsh-vk-contract
```

Or install the whole family on Windows PowerShell:

```powershell
./install.ps1
```

Restart the web instance afterwards. Each package directory carries its own README.

## License

MIT
