---
title: sorcery - another git (jj) repo viewer for the web
description: static-files-based git hosting
unlisted: true
---

i have been running several personal git forges for almost half my life, at this point. i like running my own dev infrastructure, especially because i'm almost always 120ms+ away from us-east-1 :3 in 2015 i had a Gogs instance which became a Gitea instance which became a Forgejo instance, and I've also deployed GitLab/Forgejo several other times for various groups I've been a part of. i like the communal git forge, and Forgejo is great at this!

but.

my Forgejo server keeps running out of disk space (from crashing while repacking git repos that haven't updated) and falling over / OOMing under ambient scraper load. it's clear that, for my needs, this is straight up just the wrong size of thing. it can't stand up to the internet's cosmic microwave background radiation. i also kinda want to simplify my experience by only exposing features i will *actually use* - Forgejo and its ilk do way more than i need them to: issues, PRs, releases, wikis -- a bunch of GitHub feature-compatibility that i don't care about, and pay some sort of cost for anyway :(

## publishing to the open web

the usual antidote prescribed for Forgejo resource exhaustion is to block scrapers via a web application firewall like [Anubis](https://anubis.techaro.lol/), which aims to gate access to the web application behind a JavaScript proof of work challenge. but this is counter to, like, the philosophy of the open web, right? the ostensible "user agent" is coerced into choosing between either executing near-useless code that taxes the user's device (the point of the challenge is to spin!), or to refuse & not show any user-relevant information at all. plus, alternative browsers that _don't_ support JavaScript (or just don't support JITted JavaScript) are either completely blocked off or locked behind a truly intrusive wait time. this is the opposite of open access.

additionally, deployment of such a thing is an admission of defeat that the fronted application *does not work correctly* when met with real-world internet traffic: when we have a workload where reads so heavily outnumber writes, this notion is kind of ridiculous - serving write-sparse data ought to be super cheap in practice: all of github pages ran on one machine for years!! why not have a git host where everything is static files?

## git repo views with minimal server compute

[sorcery](https://git.t4t.associates) (like.. source-ery ^-^) at its core is shaped like a static site generator: when it receives an update to a git repo, it will rebuild a bunch of on-disk HTML for that repo - an overview page, the directory tree the tip commit of each branch, and syntax-highlighted source code renderings for each file in the tips. this allows us to pay a fixed upfront cost for serving many future requests, which means we are resilient against scraper load (because a sendfile-and-forget has basically negligible cost). however, since it would be expensive to render out HTML ahead of time for every revision of every file, we choose not to serve static historical views of the repo.

repo history viewing is an integral feature of a git web interface, though, so we serve the `.git` directory directly, implement a basic read-only git client in JavaScript, and then client-side render all the "rich views" of the repository - the repo site generator does also need to emit some supplementary JSON data to aid the git client, since we can't reliably list directories in the git repo, but that's still static!

since browsing around history can mean many fetches to different objects (commits, trees \[i.e. repo directory listings], blobs \[i.e. file contents]), a high-latency connection can cause direct object fetching and traversal to feel really slow. even moreso when git stores these objects compressed in delta-encoded packfiles: a naïve fetch of a packfile index in `linux.git` to view the diff of one commit would use over 400MiB of bandwidth!! and smartly scanning ranges would kill cache hit rates and also waterfall out to a bunch of requests that depend on the data in prior requests.

so, as a non-static optimization[^1], we also provide a serverside route to fetch specific git objects by a list of object IDs (`QUERY /<user>/<repo>/obj`), returning a simple binary "git object bundle" format which gets trivially parsed on the client. this alleviates the burden of navigating packfiles on the client. additionally, even for loose object repos, we can still optimize roundtrips by providing "smart fetch" modes which traverse for referenced oids for a given access pattern (e.g. traversing commit history via `commit.parent->parent->parent->…`, or accessing all blobs in the trees of a pair of commits in order to diff them).

[^1]: `QUERY …/obj` is truly *just* an optimization - if you deploy a built sorcery site completely statically, the git client will still fall back and directly fetch and parse packfiles and loose objects, it will just be wayyyy slower with high latency.

## non-features

so sorcery is a _git repo viewer_ and not a _git forge_ because it omits user accounts, ssh/gpg key management, and issues+patches entirely. in fact, sorcery proper is entirely read-only! repos are only ever written via git over ssh, which is separate to sorcery. you can run [`sorcery-ssh`](https://git.t4t.associates/char/sorcery/ref/main/tree/extra/sorcery-ssh/) as your git user's ssh `ForceCommand`, and it will provide "autocreate repo on first push" + the ability to edit repo descriptions. the benefit of this setup is that your public deployment is as secure as its sshd, which is [reassuring in big 26](https://jyn.dev/a-year-to-fix-security/) :)

historical views _do_ require JavaScript, but I'm not super into blanket js allergy on the web (unless you live _in_ Ashburn, running ui code on-device is basically always better!) - sorcery uses [my own frontend microframework](https://github.com/char/aftercare), and a bunch of built-in web platform affordances, as well as intentional codesplitting, so e.g. loading a project overview page transfers about 9kb of gzipped JS to support recent commit pagination / language filtering / links through to commit diffs. the largest part of the site ends up being the syntax highlighting grammars; i think i want to try writing a pure-javascript executor for tree-sitter grammars and queries so that we can shed some of the WASM weight (especially from the code that gets repackaged in each highlight language's WASM bundle).

## so, yeah

i still like the communal git forge!! for my personal projects, i mostly just want somewhere to push code that i can browse from my phone / link to people: i don't need collaborative features, and it's much more lightweight this way. reading my code should _never_ involve a ceremony of proof to the server that you're worthy of receiving hypertext.

in the near-term i want to add support for CI annotations (which i am opinionated about, and will talk about in a future blog post!! smash that RSS button) & maybe in the future i'll extend the repo viewer into a discrete, more batteries-included forge project that i can use with my friends (once we really distill down to what's most important to us and what is superfluous...)

anyway, [check it out!](https://git.t4t.associates/char/sorcery)
