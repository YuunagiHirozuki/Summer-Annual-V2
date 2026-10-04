---
title: easytier快速组网脚本
description: 在节点上一键运行命令快速组网，解决每次插入可移动存储设备时需要重新输入命令的问题，适用于U盘，移动硬盘等设备
pubDate: 2025-10-20
tags: [异地组网工具, 脚本, 命令行, easytier]
category: 工具
draft: false
pinned: true
licenseName: CC-BY
sourceLink: ''
image: ''
---

在文本编辑器中粘贴以下命令并将文件后缀改为.bat

```bat
chcp 65001

@echo off

rem 保存为 run_easytier_admin.bat

rem 通过 net session 检查是否有管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    rem 非管理员 -> 使用 PowerShell 以管理员权限重启脚本
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo 已以管理员权限运行：%~f0
rem 切换到当前文件所在目录
cd /d "%~dp0"
".\easytier-core.exe" -d --network-name "abc" --network-secret "abc" -p "tcp://public.easytier.cn:11010"

```
