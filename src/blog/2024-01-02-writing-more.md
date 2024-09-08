---
title: i told myself i would write more this year
description: but first, I had to invent the universe
---

haha, hey! welcome to my new site!! I've moved all of my blog posts over and I will be setting up redirects from the old places, since "cool URLs don't change" and all[^1].

[^1]: https://www.w3.org/Provider/Style/URI

## inventing the universe

so I made a new blog engine today today! i'm using [Lume](https://lume.land/) to generate this site, which is a Deno-based static site generator.
you might remember that i [previously had one of these in 2019](https://github.com/char/side) (5 years ago!!) when Deno was just taking off,
but i switched away to my Rust one, `siru`.

i really, _really_ love Deno. TypeScript is an amazing language for code that is written about-once,
and the ESM-first approach + not having to deal with Node dependency management is great :3

i _will_ be porting some of `siru`'s features to Lume via `cdylib` crates & Deno FFI, so expect to see tree-sitter based syntax highlighting (via [`chroma-syntaxis`](https://git.lavender.software/charlotte/chroma-syntaxis)) for Lume very soon!

## writing more

i've resolved to do it this year! I'm trying to overcome some perfectionism[^2] but I have lots to talk about: software architecture, sound design & DSP, digital archivism, and lots of cursed repurposing of tools :)

[^2]: i haven't really written properly since 2020, and in the intervening years i've adopted this lowercase, informal, and imperfect communication style. i'm big on typographic-style-as-tone in the textual internet age, but i think that's a whole other article to get myself into…

i also plan to finish up my article for [nullpt.rs](https://nullpt.rs/), which is something I have been meaning to do for a while…

see you around!
