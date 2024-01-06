---
title: "ngx: a TypeScript DSL for nginx config generation"
description: but really, this is about imperfection & saving time
---

hi! [i made a thing](https://git.lavender.software/char/ngx) - but this post isn't really about the thing.

## a taste of ngx

so, just this month I moved my whole blog from its old domain to this one, but since i'd like to do my best to prevent link rot, i'd like to redirect all the pages to the new site!

there are a million ways to "serve http 3xx", and i have half-invented countless solutions:

- a productized redirection SaaS with automatic TLS provisioning where setup is just a CNAME
- a globally-distributed CDN reading redirects from a dynamic replicated database
- a dynamic hot-swappable WebAssembly-blob-per-route webserver

but I never finished any of these (despite making a bunch of progress on a lot of them). all I need to do right now is redirect from my old site to my new one. so let's do it!

let's say we have a site `A.com` and we want to redirect a handful of pages to the same route on `B.com`

- `A.com/a` ⇒ `B.com/new-a`
- `A.com/b` ⇒ `B.com/b-v2`

in nginx, that would look something like this:

```nginx
server {
  server_name a.com;

  listen 443 ssl http2;
  listen [::]:443 ssl http2;

  ssl_certificate /etc/letsencrypt/live/a.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/a.com/privkey.pem;

  location = /a {
    # 302 ('Found') is a temporary redirect,
    # but you may want a different 3xx code.
    return 302 https://b.com/new-a;
  }
  location = /b {
    return 302 https://b.com/b;
  }
}
```

that's a lot of typing!! how does it look with `ngx`?

here's a script that you run with `deno run` and it spits out an nginx config (which you can put inside `/etc/nginx/http.d/` or something):

```typescript
import ngx from "https://char.lt/ngx/v0.1/ngx.ts";

const redirects = {
  "/a": "https://b.com/new-a",
  "/b": "https://b.com/b-v2",
};

export const config = ngx("server", [
  [
    "server_name a.com",
    ...ngx.listen(),
    ...ngx.letsEncrypt("a.com")
  ],
  Object.entries(redirects).map(([path, uri]) =>
    ngx(`location = ${path}`, [
      `return 301 ${uri}`
    ])
  ),
]);

if (import.meta.main) console.log(config.build());
```

well, it's a similar length - but this way, adding a new redirect goes from three lines to one short (& memorable) one!

```diff
 const redirects = {
   "/a": "https://b.com/new-a",
   "/b": "https://b.com/b-v2",
+  "/c": "https://b.com/my-c-replacement",
 };
```

plus, this is all using a fully-fledged programming language! you could add these from a `for` loop or something!
here's real code i have written for redirecting from the old `som.codes` website to this new one on `char.lt`:

```typescript
const blogPosts = [
  // just pasted in from browser address bar:
  "https://som.codes/blog/2019-07-12/transcoding-music/",
  "https://som.codes/blog/2019-12-07/deploying-static-sites/",
  "https://som.codes/blog/2019-12-30/jvm-hackery-noverify/",
  "https://som.codes/blog/2020-01-07/hide-signal-phone-numbers/",
  "https://som.codes/blog/2021-06-08/duo-mobile-hotp/",
  "https://som.codes/blog/2022-01-09/extract-multimc-msa-cid/",
];

for (let postUrl of blogPosts) {
  postUrl = postUrl.substring("https://som.codes/blog/".length);
  const matches = postUrl.match(/^(\d{4})-(\d{2})-(\d{2})\/(.+)\//);
  if (matches == null) continue;
  const year = matches[1];
  const month = matches[2];
  const title = matches[4];
  redirects[`/blog/${postUrl}`] = `https://char.lt/blog/${year}/${month}/${title}/`;
}
```

## ngx isn't amazing

i still have to think about nginx configuration! i still have to check the docs for the right directive to put in a string, it's still possible to mess up some syntax or semantics of the config file which can cause nginx to fail to reload, and i now have to generate each config individually.

BUT: i don't have to type a site's domain three times or remember the default letsencrypt live directory path ever again!

## automating away toil

writing this little tool has saved me a good amount of effort & choosing to *not* write a better tool has saved me a lot more :)

is there some computer chore you have that's trivially partially-automated? what's a minimal approach that can alleviate some boring work for you? i don't dread nginx configuration anymore :)
