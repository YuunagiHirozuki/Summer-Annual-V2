---
title: Markdown 指南
description: Markdown 速查表
pubDate: 2025-09-14
tags: [Markdown]
category: 工具
draft: false
pinned: true
licenseName: CC-BY
sourceLink: ''
image: ''
---

## 标题

Markdown 支持 6 级标题：

```markdown
# 一级标题

## 二级标题

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题
```

## 强调

```markdown
_斜体_ 或 _斜体_
**加粗** 或 **加粗**
**_加粗斜体_** 或 **_加粗斜体_**
```

## 列表

### 无序列表

```markdown
- 项目 1
- 项目 2
    - 子项目 2.1
    - 子项目 2.2

* 项目 3

- 项目 4
```

### 有序列表

```markdown
1. 第一项
2. 第二项
    1. 子项 2.1
    2. 子项 2.2
3. 第三项
```

## 链接和图片

```markdown
[链接文本](https://example.com)
[链接文本](相对路径/example.md)
![Alt 文本](https://example.com/image.png)
![Alt 文本](相对路径/image.png)
```

## 图片与链接结合

```markdown
[![Alt 文本](相对路径/example.png)](https://example.com) //同样可使用相对路径
```

## 代码

### 行内代码

```markdown
这是 `行内代码` 示例
```

### 代码块

````markdown
```python
def hello():
    print("Hello, world!")
```
````

Markdown 允许用 3 个以上的反引号作为代码块标记。  
如果你外层用 4 个 `，就可以安全包裹内部的 3 个`：

## 引用

```markdown
> 这是引用文字
> 可以多行使用
>
> > 可以嵌套引用
> >
> > > 再嵌套引用
```

引用里面可以放 文字、列表、代码块、图片，都能渲染。

## 分割线

```markdown
---
```

## 表格

```markdown
| 表头1   | 表头2   | 表头3   |
| ------- | ------- | ------- |
| 单元格1 | 单元格2 | 单元格3 |
| 单元格4 | 单元格5 | 单元格6 |
```

## 转义字符

Markdown 特殊符号如果要显示本身，需要加反斜杠 \：

```markdown
\*显示星号
\# 显示井号
\` 显示反引号
```

## 注脚（部分 Markdown 支持）

```markdown
这是一个注脚示例(正文)[^1]

[^1]: 注脚内容
```

## 高亮（部分 Markdown 支持）

```markdown
==高亮文字==
```

## HTML 支持

如果你想，甚至可以在MD里面写HTML

```markdown
<b>加粗文字</b>
<i>斜体文字</i>
```

## 自动链接

```markdown
<https://example.com>
```

## （额外）折叠

````HTML
<details>
<summary>点击展开/收起</summary>

这里是折叠的内容，可以放文字
也可以放代码块：

```python
def hello():
    print("Hello, world!")

```
</details>
````

`<summary>` 里的内容永远可见，就像标题一样。
`<details>` 标签里的部分默认折叠，点击才能展开。
折叠块里可以放 普通 Markdown（段落、列表、代码、图片等）。
