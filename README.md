# dsh-vk-suite

中文 | [English](README.en.md)

三栏布局骨架：槽位契约 + 布局外壳。其余各家族都装在它上面

## 包

| 目录 | 作用 |
|---|---|
| `dsh-vk-contract` | 槽位契约：槽位表、栏目注册表与中立服务名 |
| `dsh-vk-layout` | 布局骨架：左栏与右栏 Tab 宿主、设置宿主、浮层座位 |

## 装

```sh
# 只装其中一个包
dsh plugin --profile web add file:<本仓库>/dsh-vk-contract
```

整族一次装完（Windows PowerShell）：

```powershell
./install.ps1
```

装完重启 web 实例。每个包目录里还有它自己的 README。

## 许可

MIT
