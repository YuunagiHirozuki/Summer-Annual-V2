---
title: Git 指南
description: Git 使用
pubDate: 2025-09-15
tags: [Git, 版本控制, 命令行]
category: 工具
draft: false
pinned: true
licenseName: CC-BY
sourceLink: ''
image: ''
---

## 基础命令

### 初始化

```Git
git init                   # 初始化本地仓库
git clone <仓库地址>        # 克隆远程仓库
```

### 常用操作

```Git
git add <文件名>           # 添加指定文件到暂存区
git add .                  # 添加所有修改到暂存区
git commit -m "提交说明"    # 提交到本地仓库
git status                 # 查看当前状态
```

### 推送 & 拉取

```Git
git remote add origin <仓库地址>    # 添加远程仓库
git push -u origin main            # 推送到远程 main 分支，并设置默认上游
git pull origin main               # 拉取远程 main 分支最新代码
```

### 分支操作

```Git
git branch <分支名>         # 创建分支
git checkout <分支名>       # 切换分支
git switch <分支名>         # 切换分支（推荐）
git checkout -b <分支名>    # 创建并切换到新分支
git switch -c <分支名>      # 创建并切换到新分支（推荐）
git merge <分支名>          # 合并分支
```

## 修改与撤销

### 文件操作

```Git
git rm <文件名>            # 删除文件并记录到暂存区
git mv <旧文件> <新文件>   # 移动或重命名文件
git restore <文件名>        # 撤销工作区的修改（推荐）
git checkout -- <文件名>    # 撤销修改（旧写法，不推荐）
```

### 提交回退

```Git
git reset <文件名>          # 取消暂存区的文件
git restore --staged <文件> # 从暂存区撤销到工作区
git reset --hard HEAD^      # 回退到上一个提交（不可逆）
```

### 查看与比较

```Git
git diff                   # 查看工作区与暂存区的差异
git difftool               # 使用外部工具查看差异
git range-diff <A> <B>     # 查看两个提交范围的差异

git show <提交哈希>         # 显示某次提交的详细信息
git log --oneline          # 简洁查看提交记录
git blame <文件名>          # 查看文件每行最后的修改记录

git shortlog               # 按作者统计提交情况
git describe               # 用最近 tag 描述当前提交
```

### 协作与扩展

```Git
git fetch                  # 获取远程最新分支和标签，但不合并
git submodule              # 管理子模块
git notes                  # 给提交添加额外的注释
```

## 特殊

```Git
git pull origin main --allow-unrelated-histories
# 当本地仓库和远程仓库历史不相关时允许合并（初始化时常见）
```

P.S. 以后如果新建远程仓库时选择 “添加 README / .gitignore / LICENSE”，而本地也初始化了仓库，就容易出现这个报错。为了避免，可以：

- 新建远程仓库时不勾选任何文件，然后本地直接 git push -u origin main

- 或者先在本地 commit，再 pull 时用 --allow-unrelated-histories

---

日常工作中只需熟练掌握 基础命令 + 修改与撤销 + 查看/比较 三个部分，其余可作为补充。

## 常用命令组合示例

### 初始化本地项目并推送到远程

```Git
# 初始化
git init
git add .
git commit -m "初始提交"

# 关联远程仓库
git remote add origin https://github.com/<用户名>/<仓库名>.git

# 推送到远程 main 分支
git branch -M main
git push -u origin main
```

### 克隆已有仓库并更新

```Git
# 克隆仓库
git clone https://github.com/<用户名>/<仓库名>.git

# 拉取最新代码
git pull origin main
```

### 开发新功能（分支开发流程）

```Git
# 创建并切换到新分支
git switch -c feature-xxx

# 开发 + 提交
git add .
git commit -m "添加新功能 xxx"

# 推送到远程
git push -u origin feature-xxx

# 修改上一个提交并重新提交
git add .
git commit --amend
不修改提交信息
git commit --amend --no-edit
git push

# 回到主分支并合并
git switch main
git merge feature-xxx
git push
```

### 撤销错误操作

```Git
# 撤销工作区修改（不影响暂存区/历史）
git restore <文件>

# 撤销暂存区的文件
git restore --staged <文件>

# 回退到上一个提交（慎用，历史丢失）
git reset --hard HEAD^
```

### 团队协作常见操作

```Git
# 获取远程最新分支和标签，但不合并
git fetch

# 将远程 main 分支的更新合并到本地
git pull origin main

# 查看是谁改了某行代码
git blame <文件>
```
