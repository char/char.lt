---
title: what i do when i reinstall windows
description: a little checklist just for me
---

this is one of those blog posts where it's mostly a note-to-self.

unfortunately, i find windows to be the least-worst option for my workstation.
as running windows usually goes, i am often forced to reinstall it from scratch.
here is what i do to reduce the pain:

## essentials

### ninite

i get a bunch of stuff from [Ninite](https://ninite.com/) - it's a single installer that can install lots of software with little interaction:

- Chrome (not my primary browser, but i still need it for testing)
- Discord
- Dropbox (for storing my music production / 3d art projects) 
- 7-Zip
- VLC
- Spotify
- FileZilla
- Visual Studio Code (my primary text editor)
- Krita
- ShareX
- WizTree
- Steam

### ssh key

windows comes with OpenSSH out-of-the-box now, which is really awesome. i grab my workstation's ssh key from a backup (so that i don't need to generate a new key whenever i reinstall windows every, like, 3 months)

### tailscale

[tailscale](https://tailscale.com/) pretty much powers my personal infrastructure. i can access all of my machines via their hostnames using MagicDNS. it's great.

## development tools

### dev drive

usually this is auto-detected on install, but I have a ReFS "Dev Drive" partition that persists across Windows installations where I keep source code and package caches (as well as some tools for my PATH like ffmpeg, cmake)

### git for windows

- download installer from [git-scm.com](https://git-scm.com/)
- non-default: external OpenSSH
- non-default: core.autocrlf "checkout as-is, commit as-is"
- `git config --global init.defaultBranch main`
- `git config --global core.editor vim`
- `git config --global --add safe.directory $dev_drive`
- don't forget `user.name` and `user.email`

### rust

- i use [rustup](https://rustup.rs/). it's a toolchain manager for Rust.
- it will also ask if you want to install Visual Studio Community for the MSVC toolchain. you want this. thank you rustup

### node.js

i use [volta](https://volta.sh/). it's a toolchain manager for Node.js. it's great. "rustup for JavaScript"

1. run the installer
2. `volta install node@lts`
3. you're done

### deno

i just install deno from [deno.land](https://deno.land/)

```shell
$ irm "https://deno.land/install.ps1" | iex
$ # you're done
```

### python

i use [rye](https://rye-up.com/). it's great. "rustup for python".

```shell
$ # turn on global shims!!
$ rye config --set-bool behavior.global-python=true
$ # defaults to latest:
$ python --version
Python 3.12.0
$ # look, any version you want!
$ python +3.8 --version
Python 3.8.18
$ # install tools from pip:
$ rye install yt-dlp
$ # get them globally:
$ yt-dlp --version
2023.12.30
```

unfortunately updating a tool requires `rye uninstall $x; rye install $x`

sometimes I want pytorch with CUDA in a project managed by rye, in this case i just need to add a snippet to `pyproject.toml`:

```toml
[[tool.rye.sources]]
name = "pytorch"
url = "https://download.pytorch.org/whl/cu118"
```

## audio tools

there's no way around how much reinstalling audio tools sucks.

i install:
- Ableton Live (for music production)
- Bitwig Studio (for plugin development)

for plugins, i get these for free:
- Vital
- MeldaProduction MFreeFXBundle
- Empy (codec emulation): https://github.com/ArdenButterfield/Empy

i use my licensed versions of:
- Kilohearts Ultimate (Phase Plant, Snap Heap, Multipass, etc)
- Rift by Minimal Audio
- MeldaProduction MMorph, MVocoder
- imagiro piano, autochroma
- Serum, SerumFX via Splice
