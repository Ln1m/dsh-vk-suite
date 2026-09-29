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

Install straight from the release, no clone needed:

```sh
dsh plugin --profile web add "https://github.com/Ln1m/dsh-vk-suite/releases/download/v0.1.0/dsh-vk-contract-0.1.0.tgz"
dsh plugin --profile web add "https://github.com/Ln1m/dsh-vk-suite/releases/download/v0.1.0/dsh-vk-layout-0.1.0.tgz"
```

If the install fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (a TLS-intercepting proxy; Node does not read the system CA store by default), run `$env:NODE_OPTIONS='--use-system-ca'` first.

Restart the web instance afterwards. Each package directory carries its own README.

## License

MIT
