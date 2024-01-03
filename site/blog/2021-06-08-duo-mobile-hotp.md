---
title: circumventing my university's Cisco Duo app requirements
description: mandatory cisco software? no thanks.
---

I go to [Loughborough University](https://lboro.ac.uk/). Recently, I got an email saying from university's IT Services saying
"hey, we're going to force the use of multi-factor authentication". This is a good idea for security, but the implementation of MFA that they have chosen is subpar.

TL;DR: I don't like to be mandated to run commercial software on my own devices, so I did some reverse engineering and [reimplemented it in the open](https://github.com/char/duo-hotp-export).

## Duo Security

Duo Security is a Cisco-owned company that aims to "Protect your workforce with simple, powerful access security."
Since we're being forced onto it as a student body, they must also have a killer sales pitch.

The problem, however, is that Duo's 2FA implementation requires that you have [*their* app](https://duo.com/product/multi-factor-authentication-mfa/duo-mobile-app).
This is inadequate, since the minimum Android API level is too new to use an dedicated, airgapped, outdated device for 2FA.

## Registering a Device

The regular flow for registering a 2FA device looks like this:

1. Head on over to `duo.lboro.ac.uk`, where there's an iframe pointing to some `duosecurity.com` domain.
2. Choose **Tablet** (*Phone* is for SMS authentication[^1], apparently), then **Android**, then **I already have Duo Mobile installed**, where we are presented with a QR code.
3. Scan the QR code, and, presumably, the Duo Mobile app does the rest of the work.

[^1]: Yikes.

## QR Codes

Throwing [CyberChef](https://gchq.github.io/CyberChef/) at the QR code (because I'm too lazy to grab `qrdecode` for my system), we see that it looks something like this: 
`xxxxxxxxxxxxxxxxxxxx-YXBpLXh4eHh4eHh4LmR1b3NlY3VyaXR5LmNvbQ==`

There's a `-` in here, and there's telling marks of a Base 64 string.
If I decode with Base 64, it fails, since `-` isn't part of the standard b64 alphabet.
However, if I just take the portion after the `-`, I get: `api-xxxxxxxx.duosecurity.com`

Neat.

Anyway, we can find out more with some analysis of the software.

## The Protocol

I don't want to run the Duo Mobile app[^cisco], so, I grab an APK from a Play Store mirror,
run [apktool](https://ibotpeaches.github.io/Apktool/) to convert the Android package to a JAR,
and throw my Java reverse engineering toolkit[^java-re] at the app.

[^cisco]: Seriously, who trusts Cisco software in a post-Snowden world?

[^java-re]: I develop a commercial Java obfuscator, so I have this stuff ready-made for debugging my own work.

After a glance at the (ProGuard-obfuscated) Android app, we see that:

1. The QR code is parsed, and decoded as ASCII text
2. The resulting string is split by a `-` into two components
3. The first component is used as a URL parameter
4. The second component is used as the URL's authority

The constructed URL looks like:
`POST https://{param2}/push/v2/activation/{param1}`

Which I guess expands to something like `https://api-xxxxxxxx.duosecurity.com/push/v2/activation/xxxxxxxxxxxxxxxxxxxx`

There's also a URL-encoded request body, but I can either throw a proxy or a debugger at the actual application to get *those* details.

### Prior Art

At this point, I'm thinking "this is too simple" to myself, and I really do want to avoid running the app.
So I code-search GitHub for `duosecurity.com`, and I find this repo[^repo-fork]: [chris4795/duo-cli](https://github.com/chris4795/duo-cli).

[^repo-fork]: Well, I found the base fork (called `duo-bypass`), and followed the network to this, more updated, project.

Okay, so we can see the rest of the protocol from `duo_activate.py`:

1. Send the POST request with some parameters reassuring the server that the, uh - Android device we're running on ;) - is Very Real and doesn't have its integrity compromised from rooting, or something.
2. JSON-decode the response, and you can find the HOTP secret at `.response.hotp_secret`. I guess we're done, HOTP is an open standard.
3. Calling the `/push/v2/activation` endpoint probably increments a counter server-side, so we'll need to not get too out-of-sync with the serverside counter.

Anyway, this is shaping up to be really easy.

## Doing the Thing

So, let's take our QR code and turn it into some HOTP secret that I can use with a better OTP application.
I planned to throw it into my Bitwarden vault[^vaultwarden], but it looks like the Bitwarden client only supports TOTP.
So, instead, I'm using [FreeOTP](https://freeotp.github.io/), which is a Red Hat project.

Now, the `duo-cli` repo would be perfect, but it doesn't let me decode the QR code straight from the CLI: I have to do it manually, and then *edit the Python script* to set some variables for use.

Instead of fixing this minor gripe, I made something Invented Here: [github.com/char/duo-hotp-export](https://github.com/char/duo-hotp-export)

You can just `cargo run --release -- ./path/to/some/qr/code.png`.

So now authenticating at Loughborough is as easy as:

1. Building a Rust project that some random student made,
2. Putting your security-sensitive credentials (as a QR code) into this program,
3. Letting it spit out an `otpauth://` URI,
4. Hoping that Duo Mobile doesn't update to a different authentication scheme in the future!
5. Giving the HOTP URI to an actual OTP management app, and letting it generate codes for you.

But, hey, at least we're avoiding running some weird commercial software on our own devices.

[^vaultwarden]: If you're using Bitwarden, I really recommend the third-party [Vaultwarden](https://github.com/dani-garcia/vaultwarden) server running on a machine that you own, if you're up for it.
