---
title: Hiding phone number display on Signal Desktop
description: They rejected my PR, so I'll just do it myself
---

Today, we're going to patch the Signal desktop app to hide phone numbers. I need this functionality because of shoulder surfing / screen sharing / whatever.

![A screenshot showing an exposed phone number on Signal's desktop app](/assets/blog/hide-signal-phone-numbers/signal-danger.png)

## Introduction

A while ago, I [submitted a PR](https://github.com/signalapp/Signal-Desktop/pull/3647) to Signal to hide the phone numbers in the conversation view, to bring the desktop app the same functionality offered by an update to the mobile app. After having to sign a CLA, and after _three months(!)_ of silence (despite requesting some help), I received a small note about how they "have other ideas about how to address [this problem]", and my pull request was closed.

So, today, I'm going to do it myself, to an install of `signal-desktop` from the Arch repos.

## `signal-desktop`

`signal-desktop` is the Arch Linux package I use for Signal. If you want to reproduce these steps, that's probably what you want to use. It'll most likely work with other installations of Signal though.

## Electron and the `asar` format

Since Signal Desktop is an Electron application, it should be relatively simple to modify its presentation to suit our needs. Every Electron app has a 'resources' folder which contains the JavaScript source files (or, more likely, heavily processed transpiled-to-JavaScript blobs) necessary for its execution. Sometimes, these source files are packed in an 'asar' file - You can think of this like an Electron-specific 'tar' file if you will, but the [source is open](https://github.com/electron/asar) for the tools required to read the file format.

Anyway, we install the `asar` archiver tool with `npm` (but you can get it from the Arch repos via `pacman` if you are so inclined)

```bash
$ sudo npm install -g asar
```

## Extracting the code

So, to get at the Signal code, we want to extract the asar file and edit its contents:

```bash
/usr/lib/signal-desktop $ asar e app.asar /tmp/signal-app
```

This extracts just fine, as opposed to previous packagings of Signal (namely, some AUR packages). We can now go to `/tmp/signal-app` to edit the sources.

From writing the PR, I know that the phone number is rendered in `ts/components/conversation/ConversationHeader.tsx`, which you can view the source of [here](https://github.com/signalapp/Signal-Desktop/blob/development/ts/components/conversation/ConversationHeader.tsx).

So we know that the compiled JS file will probably be called `ts/components/conversation/ConversationHeader.js`. After viewing it, we see that we can apply a very simple change to get our desired behaviour:

```diff
    renderTitle() {
-     const { name, phoneNumber, i18n, isMe, profileName, isVerified, } = this.props;
+     const { name, i18n, isMe, profileName, isVerified, } = this.props;
+     const phoneNumber = null;
      if (isMe) {
        return (react_1.default.createElement("div", { className: "module-conversation-header__title" }, i18n('noteToSelf')));
```

Even with very little knowledge of React or Electron, it's simple to just set `phoneNumber` to null instead of receiving it from the component's `props`.

## Packing it back up

Here, we just replace the old `app.asar` with the new one, based on the extracted contents:

```bash
/tmp/signal-app $ cd ..
/tmp $ asar p signal-app app.asar
/tmp $ sudo mv app.asar /usr/lib/signal-desktop/app.asar
```

Cool, we're done. Now I won't inadvertently dox my friends when I screen-share. Great.

It's a shame I had to do this myself, when multiple people have requested this feature. I hope these instructions can help somebody out.

![A screenshot without a phone number on Signal's desktop app](/assets/blog/hide-signal-phone-numbers/signal-success.png)
