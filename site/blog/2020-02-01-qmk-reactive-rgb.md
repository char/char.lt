---
title: reactive backlighting for QMK
description: make your custom mechanical keyboard's keys light up when pressed
unlisted: true
---

Recently, I picked up a new mechanical keyboard PCB (an HS60). It's nice, it even has addressable LEDs under each key.

I didn't like any of the stock LED pattern options. My thoughts were:

- I want keys to only light up when I press them
- They should fade out nicely
- I've seen this behaviour on pre-built keyboards before, why isn't it in the stock wilba_tech RGB matrix interface?

So, obviously, I [did some patching.](https://github.com/videogame-hacker/qmk-hs60v3iso-half-kh-hacker)

First off, we need to get our own RGB backlighting effect to be called:

```diff
@@ -1928,6 +1930,9 @@ static void gpt_backlight_timer_task(GPTDriver *gptp)
     case 10:
       backlight_effect_cycle_radial2();
       break;
+    case 11:
+      backlight_effect_user();
+      break;
     default:
       backlight_effect_all_off();
       break;
```

Then, we need to actually define this new `backlight_effect_user` for that file.

Above, I stuck a simple relative `#include` directive to point back to my own repository that is sub-tree-ed into the QMK sources:

```diff
+#include "../hs60/v2/iso/keymaps/half-kh-hacker/backlighting.h"
```

And in that header file, I simply define my desired backlighting behaviour:

```c
#pragma once

void backlight_effect_user(void) {
  for (int i = 0; i < BACKLIGHT_LED_COUNT; i++) {
    HSV hsv = { .h = 0, .s = 0, .v = 255 - g_key_hit[i] };
    RGB rgb = hsv_to_rgb(hsv);
    backlight_set_color(i, rgb.r, rgb.g, rgb.b);
  }
}
```

Obviously, you can set the HSV values to whatever you want, and probably multiply the value you get from `g_key_hit` - The `key_hit` value is a `uint8_t` of number of twentieths of a second, so with the snippet above it takes almost 13(!) seconds to fully fade out a key.
