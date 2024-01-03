---
title: '"reverse engineering" MultiMC on windows to get its MSAClientID'
description: it's more like reading a post-it note of a password kept inside of a glass box
featured: true
---

The [MultiMC maintainers are being kind of annoying to packagers](https://github.com/PolyMC/PolyMC/wiki/FAQ#why-was-this-fork-made) right now. If you'd like to package your own build of MultiMC, you'd best be able to get an MSA Client ID, right? I've created this handy guide for you to get it yourself, in case it changes!

Please note, **I am not affiliated in the slightest with PolyMC or MultiMC.**

## Setup

This guide is for Windows, since that's the operating system I have reverse engineering tooling installed on.

All you need to do to follow along is:

1. Download the [MultiMC binaries](https://multimc.org)
2. Grab [x64dbg](https://x64dbg.com/) (You want the contents of the `release` folder)

## Planning

This is a _really_ trivial exercise: Since we have [the source code](https://github.com/MultiMC/Launcher) of MultiMC, we can just... Look at it.

First, we find [where the MSA client ID is used](https://github.com/MultiMC/Launcher/blob/52420963cf1f258f14cedd7ff41412338d73b369/launcher/minecraft/auth/steps/MSAStep.cpp#L16):
![A screenshot of the source code. It shows an OAuth2::Options struct's clientIdentifier field being assigned by the result of a call to APPLICATION -> msaClientId](/assets/blog/extract-mmc-msa-cid/msa-step-client-id.png)

So we just need to set a breakpoint at this field assignment, and read the data from memory then :)

## Dynamic Analysis

Since this is an open-source application without any anti-debugging techniques or anything, we can just use plain x64dbg without any trickery!

MultiMC is a 32-bit application, so we tell the 'x96dbg' launcher that we want to use the 32-bit version of the program, x32dbg:

![A screenshot of the x96dbg launcher, with the x32dbg button highlighted.](/assets/blog/extract-mmc-msa-cid/x96dbg.png)

Then, just head over to File -> Open and point it to your `MultiMC5.exe`:

![A screenshot of x32dbg showing the Open button highlighted](/assets/blog/extract-mmc-msa-cid/x32dbg-open.png)

This will start the process, but suspend it before it runs any code. Hit Debug -> Run to user code to skip all the win32 initialization stuff.

Now, we want to find where `opts.clientIdentifier` is set in `MSAStep.cpp`. We have a lot of strings to search for nearby, so let's go for `"XboxLive.signin offline_access"`.

Right click the disassembly and go for Search for -> Current module -> String references, and when it's finished scanning type XboxLive. You should see the string we're looking for:

![A screenshot of x32dbg showing the 'XboxLive.signin offline_access' scope string result as well as some other miscellaneous strings that also contain 'xboxlive', since the search is filtered thusly](/assets/blog/extract-mmc-msa-cid/xboxlive-string-result.png)

Double-click it to jump to its reference. Now, we can examine the code around it. We know that the string will eventually be returned from `APPLICATION->msaClientId()`, and we see a reference to `Application::self` here, a little ways underneath the reference to the string literal we were looking for:

![A screenshot of x32dbg's disassembler. There is a mov instruction that references some symbol QCoreApplication.self](/assets/blog/extract-mmc-msa-cid/reference-to-application-self.png)

After the reference to self, there's an internal `call`, and then some offloading of values on the stack to registers.

![A screenshot of x32dbg's disassembler. There is a call instruction to some location inside the multimc.exe image](/assets/blog/extract-mmc-msa-cid/suspicious-call.png)

So we can set a breakpoint right afterwards. This will instruct x32dbg to pause the application once the CPU hits that instruction. You can then go to Debug -> Run to get a MultiMC5 window. to open up on your system. (If the debugger keeps pausing, you can hit Options -> Preferences -> Events and turn off auto-breaking on "System Breakpoints".)

In MultiMC, you can then go to the account manager and hit 'Add Microsoft' to set up the MSAStep and grab the token. The application will freeze once it hits your software breakpoint.

Once it's frozen, we can inspect the value of `edx` to find a pointer to a `QString`, which is a UTF-16 (LE) encoded string.

In the register view (in the top-right corner of the CPU pane), right click on the value of EDX and follow it in one of the dumps:

![The right-click context menu in the register view with Follow to dump -> Dump 1 highlighted](/assets/blog/extract-mmc-msa-cid/follow-in-dump.png)

## Conclusion

We are greeted with our prize, which is the UTF-16 encoded UUID:

![The UUID delimited by 00-bytes, shown in hex and ASCII decoded to the right in the x32dbg dump view](/assets/blog/extract-mmc-msa-cid/the-uuid.png)

As you can see, the value of the MSA Client ID in this release of MultiMC is `499546d9-bbfe-4b9b-a086-eb3d75afb78f` :)

Obviously, the information is included in this post for educational purposes only. ;)
