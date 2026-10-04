---
title: yt-dlp 使用指南
description: yt-dlp 的常用指令说明
pubDate: 2025-9-10
tags: [yt-dlp]
category: 工具
draft: false
pinned: true
licenseName: CC-BY
sourceLink: ''
image: ''
---

## 常用命令

### 一般下载

```bash
yt-dlp URL
```

自动选择最佳视频流和最佳音频流（使用该下载方式似乎并非画质最佳而是画质和体积最佳的平衡选择）

### 最高画质 + 最高音质

```bash
yt-dlp -f "bestvideo+bestaudio/best" URL
```

### 查看视频可用格式

```bash

yt-dlp -F URL

```

### 指定下载格式并合并音频视频

`yt-dlp -F URL`后，假设输出流编号为  

```cmd
137 mp4 1920x1080 video only
251 webm audio only
```

使用此指令指定视频流和文件流的编号后将会通过ffmpeg自动合并为一个文件

```bash
yt-dlp -f 137+251 URL
```

也可只指定音频流单独下载音频文件

## 文件转换

### 下载并自动转成 mp3

```bash
yt-dlp -x --audio-format mp3 URL
```

### 指定格式 + 自动选择最高音质

```bash
yt-dlp -f bestaudio -x --audio-format m4a URL
```

### 只下载封面（缩略图）

```bash
yt-dlp --skip-download --write-thumbnail --convert-thumbnails jpg URL
```

### 把视频封面嵌进 mp3 封面里

```bash
yt-dlp -x --audio-format mp3 --embed-thumbnail URL
```

### 同时下载视频和封面

```bash
yt-dlp --write-thumbnail --no-embed-thumbnail URL

yt-dlp -f "bestvideo+bestaudio/best" --merge-output-format mp4 --write-thumbnail --no-embed-thumbnail URL
```

### 同时下载最高音质音频和封面

```bash
yt-dlp -x -f bestaudio --audio-format m4a --write-thumbnail --no-embed-thumbnail --convert-thumbnails jpg URL

#-x → 提取音频
```

### 更新yt-dlp

```bash
yt-dlp -U
```

## `yt-dlp -F` 输出说明

- ID：这个流的编号，下载时用它指定

- EXT：文件封装格式，比如 mp4、webm

- RESOLUTION：分辨率，比如 1920×1080

- FPS：帧率

- CH：声道数

- FILESIZE：文件大小

- TBR：平均总码率（total bitrate），单位 kbps（越高一般质量越好）

- PROTO：传输协议，一般是 https

- VCODEC：视频编码格式，比如 avc1（H.264）、vp9、av01（AV1）

- VBR：视频比特率

- ACODEC：音频编码格式

- ABR：音频码率

- ASR：音频采样率

- MORE INFO：额外说明（清晰度、封装类型等）
