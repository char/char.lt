---
title: Transcoding my music collection
description: Saving a little storage space on my phone
---

I decided to transcode my active music collection from FLAC to MP3-320k, because I started to run out of space on my 64GB (!) phone and 25GB VPS.

To start, I created a temporary on my folder in which the FLAC files could live.

```
$ mkdir ~/Work/transcoding
```

Since my music folder is actually mixed-format, I wanted to only copy the FLAC files to the transcoding folder, and preserve the structure.

My first attempt looked something like this:

```
~/Music/ $ find . -name '*.flac' -exec cp {} ~/Work/transcoding/{} \;
[many errors]
```

Since `cp` doesn't let us copy a file where the parent directory doesn't exist, I resorted to a fast hack.

```
~/Music/ $ find . -name '*.flac' -exec mkdir -p ~/Work/transcoding/{} \;
~/Music/ $ find . -name '*.flac' -exec rmdir ~/Work/transcoding/{} \;
~/Music/ $ find . -name '*.flac' -exec cp {} ~/Work/transcoding/{} \;
```

This was what I knew how to do quickly, but if anyone would like to tell me the Right Way™ to do this, that'd be nice.

Next, we get to actually transcoding.

First try:

```
~/Work/transcoding/ $ find . -name '*.flac' -exec ffmpeg -i {} -threads 0 -b:a 320k {}.mp3
...

[In another terminal]
$ htop
[One core is maxed out, while the rest idle]
```

Even though we're passing in `-threads 0` here, it looks like ffmpeg's mp3 encoder doesn't thread too well.
Not a problem, let's use `parallel`.

```
~/Work/transcoding/ $ find . -name '*.flac' | parallel ffmpeg -i {} -threads 0 -b:a 320k {}.mp3
...

[Two minutes later]
~/Work/transcoding/ $
```

We're done, I delete the old FLACs with some more `find` hackery (but we've had enough of that for now), and copy the transcoded MP3s over. My music directory's shrunk from 30GB to only 17GB. Nice.
