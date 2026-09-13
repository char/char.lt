---
title: what if my git host was a static site generator?
description: "introducing: sorcery, the source-ery.."
stylesheets:
  - /css/sorcery.css
  - /css/fakeshot-sorcery.css
---

i have been running several personal git forges for, at this point, almost half my life :o i like running my own dev infrastructure, not only because i'm almost always 120ms+ away from `us-east-1`, but because sysadmin is just plain fun :3 in 2015 i had a Gogs instance which became a Gitea instance which became a Forgejo instance, and i've also deployed GitLab/Forgejo several other times for various groups i've been a member of. i like the communal collaborative git forge, and Forgejo is great at this!

but my Forgejo server keeps running out of disk space (from crashing while repacking git repos that haven't updated) and falling over / OOMing under ambient scraper load. it's clear that, for my needs, this is just the wrong size of thing: on the tiny machines i use for personal infrastructure, the software can't stand up to the internet's cosmic microwave background radiation. i also kinda wanna simplify my experience by only exposing features i'll _actually use_: Forgejo and its ilk do way more than i need them to: issues, PRs, releases, wikis - a bunch of GitHub feature-compatibility that i don't care about, and pay some sort of cost for anyway :(

## publishing to the open web

the usual antidote prescribed for Forgejo resource exhaustion is to block scrapers via a web application firewall like [Anubis](https://anubis.techaro.lol/), which aims to gate access to the webapp behind a JavaScript proof of work challenge.

but this is counter to, like, the philosophy of the open web, right? the browser, ostensibly the "user agent", is coerced into user-unfriendly behavior, executing near-useless code that taxes the user's device (the point of the challenge is to spin!) - were it to refuse, no user-relevant information could be displayed at all. alternative browsers that _don't_ support JavaScript (or just don't support JITted JavaScript) are either completely blocked off or locked behind a truly intrusive wait time. this deepens the oligoculture of the modern web, which i think is a bad thing.

additionally, deployment of such a thing is an admission of defeat that the fronted application *does not work correctly* when met with real-world internet traffic: when we have a workload where reads so heavily outnumber writes, this notion is kind of ridiculous - serving write-sparse data ought to be super cheap in practice: all of github pages ran on one machine for years!! why not have a git host where everything is static files?

## git repo views with minimal server compute

at its core, [sorcery](https://git.t4t.associates/char/sorcery) is shaped like a static site generator: when it receives an update to a git repo, it will rebuild a bunch of on-disk HTML for that repo - an overview page, the directory tree the tip commit of each branch, and syntax-highlighted source code renderings for each file in the tips. this allows us to pay a fixed upfront cost for serving many future requests, which means we are resilient against scraper load (because a sendfile-and-forget has basically negligible cost). however, since it would be expensive to render out HTML ahead of time for every revision of every file, we choose not to serve static historical views of the repo.

repo history viewing is an integral feature of a git web interface, though, so we serve the `.git` directory directly, implement a basic read-only git client in JavaScript, and then client-side render all the "rich views" of the repository - the repo site generator does also need to emit some supplementary JSON data to aid the git client, since we can't reliably list directories in the git repo, but that's still static!

since browsing around history can mean many fetches to different objects (commits, trees \[i.e. repo directory listings], blobs \[i.e. file contents]), a high-latency connection can cause direct object fetching and traversal to feel really slow. even moreso when git stores these objects compressed in delta-encoded packfiles: a naïve fetch of a packfile index in `linux.git` to view the diff of one commit would use over 400MiB of bandwidth!! and smartly scanning ranges would kill cache hit rates and also waterfall out to a bunch of requests that depend on the data in prior requests.

so, as a non-static optimization[^1], we also provide a serverside route to fetch specific git objects by a list of object IDs (`QUERY /<user>/<repo>/obj`), returning a simple binary "git object bundle" format which gets trivially parsed on the client. this alleviates the burden of navigating packfiles on the client. additionally, even for loose object repos, we can still optimize roundtrips by providing "smart fetch" modes which traverse for referenced oids for a given access pattern (e.g. traversing commit history via `commit.parent->parent->parent->…`, or accessing all blobs in the trees of a pair of commits in order to diff them).

<figure class="sorcery-diagram">
<div class="sequence-pair">
<svg viewBox="0 0 350 356" role="img" aria-labelledby="sorcery-direct-title sorcery-direct-desc">
  <title id="sorcery-direct-title">fetching history directly from loose git objects</title>
  <desc id="sorcery-direct-desc">the browser fetches commit C, learns its parent B, fetches B, then learns and fetches A. each consecutive parent lookup requires another round-trip.</desc>
  <defs>
    <marker id="sorcery-direct-arrow" markerWidth="10" markerHeight="12" refX="9" refY="6" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M 1 1 L 9 6 L 1 11" />
    </marker>
  </defs>
  <text class="heading" x="175" y="22">direct object fetching</text>
  <text x="55" y="54">browser</text>
  <text x="295" y="54">server</text>
  <path class="lifeline" d="M 55 66 V 298 M 295 66 V 298" />
  <g class="flow" marker-end="url(#sorcery-direct-arrow)">
    <path d="M 55 82 L 295 98" />
    <path d="M 295 120 L 55 136" />
    <path d="M 55 162 L 295 178" />
    <path d="M 295 200 L 55 216" />
    <path d="M 55 242 L 295 258" />
    <path d="M 295 280 L 55 296" />
  </g>
  <text class="code label" x="175" y="79">GET C</text>
  <text class="label" x="175" y="118">C → parent B</text>
  <text class="code label" x="175" y="159">GET B</text>
  <text class="label" x="175" y="198">B → parent A</text>
  <text class="code label" x="175" y="239">GET A</text>
  <text class="label" x="175" y="278">A → …</text>
  <g class="result">
    <rect x="65" y="316" width="220" height="32" />
    <text x="175" y="337">3 commits / 3 round-trips</text>
  </g>
</svg>
<svg viewBox="0 0 350 346" role="img" aria-labelledby="sorcery-smart-title sorcery-smart-desc">
  <title id="sorcery-smart-title">fetching the same history with optional smart fetch</title>
  <desc id="sorcery-smart-desc">the browser requests history starting at A. the server follows parent links locally & returns A, B, and C in one round-trip.</desc>
  <defs>
    <marker id="sorcery-smart-arrow" markerWidth="10" markerHeight="12" refX="9" refY="6" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M 1 1 L 9 6 L 1 11" />
    </marker>
  </defs>
  <text class="heading" x="175" y="22">smart fetch</text>
  <text x="55" y="54">browser</text>
  <text x="295" y="54">server</text>
  <path class="lifeline" d="M 55 66 V 184 M 295 66 V 184" />
  <path class="flow" d="M 55 82 L 295 98" marker-end="url(#sorcery-smart-arrow)" />
  <text class="code label" x="175" y="79">QUERY …/obj</text>
  <text class="label" x="175" y="120">(server follows parents)</text>
  <path class="flow" d="M 295 166 L 55 182" marker-end="url(#sorcery-smart-arrow)" />
  <text class="label" x="175" y="160">bundle: A + B + C</text>
  <g class="result">
    <rect x="65" y="202" width="220" height="32" />
    <text x="175" y="223">3 commits / 1 round-trip</text>
  </g>
</svg>
</div>
<figcaption>round-trip reduction with the help of the server!</figcaption>
</figure>

[^1]: `QUERY …/obj` is truly *just* an optimization - if you deploy a built sorcery site completely statically, the git client will still fall back and directly fetch and parse packfiles and loose objects, it will just be wayyyy slower with high latency.

## non-features

so sorcery is a _"git repo viewer"_ and not a _"git forge"_ because it omits user accounts, ssh/gpg key management, and issues+patches entirely. in fact, sorcery proper is entirely read-only! repos are only ever written via git over ssh, which is separate to sorcery. you can run [`sorcery-ssh`](https://git.t4t.associates/char/sorcery/ref/main/tree/extra/sorcery-ssh/) as your git user's ssh `ForceCommand`, and it will provide "autocreate repo on first push" + the ability to edit repo descriptions. the benefit of this setup is that your public deployment is as secure as its sshd, which is [reassuring in big 26](https://jyn.dev/a-year-to-fix-security/) :)

historical views _do_ require JavaScript, but I'm not super into blanket js allergy on the web (unless you live _in_ Ashburn, running UI code on-device is basically always better!) - sorcery uses [my own frontend microframework](https://github.com/char/aftercare), and a bunch of built-in web platform affordances, as well as intentional codesplitting, so e.g. loading a project overview page transfers about 9kb of gzipped JS to support recent commit pagination / language filtering / links through to commit diffs. the largest part of the site ends up being the syntax highlighting grammars; i think i want to try writing a pure-javascript executor for tree-sitter grammars and queries so that we can shed some of the WASM weight (especially from the code that gets repackaged in each highlight language's WASM bundle).

## so, yeah

i still like the communal git forge!! for my personal projects, i mostly just want somewhere to push code that i can browse from my phone / link to people: i don't need collaborative features, and it's much more lightweight this way. reading my code should _never_ involve a ceremony of proof to the server that you're worthy of receiving hypertext.

<figure class="sorcery-fakeshot">
<div class="screen" role="img" aria-label="a screenshot of sorcery's commit diff view" tabindex="0">
<div class="commit-page" aria-hidden="true">
  <div class="repo-heading">
    <div><div class="repo-name">char/sorcery</div><div class="muted">static-files based git repo viewer</div></div>
    <code class="clone">git clone https://git.t4t.associates/char/sorcery</code>
  </div>
  <div class="muted">← close</div>
  <div class="crumbs"><span class="link">sorcery</span><span class="muted">•</span><span><span class="muted">commit: </span>1acdf74</span><span class="link push-right">browse files</span></div>
  <div class="subject">remove --allow-all from ngx script</div>
  <div class="muted">idk why i was even pretending to need permissions here</div>
  <dl class="metadata">
    <dt>author</dt><dd><code>Charlotte Som &lt;charlotte@som.codes&gt;</code></dd>
    <dt>date</dt><dd><code>2026-09-07 19:32 +0100</code></dd>
    <dt>commit</dt><dd><code>1acdf74737b6ad81a929b6ab717b087033bba32f</code></dd>
    <dt>parent</dt><dd><code class="link">f92b8f41e7dd0d095b0316ee2bd55a7cc38b5550</code></dd>
    <dt>change-id</dt><dd><code>kzwvxtnpoysllvtzsysolnxmxxsxrtyo</code></dd>
  </dl>
  <div class="stats"><span class="added">+2</span><span>•</span><span class="removed">-2</span><span>•</span><span>2 changed files</span></div>
  <div class="file-diff">
    <div class="file-heading"><code>README.md</code><span class="added push-right">+1</span><span class="removed">-1</span><span class="link">view</span></div>
    <div class="diff-line hunk"><span>@@ -26,7 +26,7 @@</span></div>
    <div class="diff-line"><span>26</span><span>26</span><span></span><code>production nginx config generated via [`@char/ngx`](https://jsr.io/@char/ngx):</code></div>
    <div class="diff-line"><span>27</span><span>27</span><span></span><code></code></div>
    <div class="diff-line"><span>28</span><span>28</span><span></span><code>```sh</code></div>
    <div class="diff-line del"><span>29</span><span></span><span class="removed">-</span><code>deno run -A sorcery.ngx.ts &gt; sorcery.conf</code></div>
    <div class="diff-line add"><span></span><span>29</span><span class="added">+</span><code>deno run sorcery.ngx.ts &gt; sorcery.conf</code></div>
    <div class="diff-line"><span>30</span><span>30</span><span></span><code>```</code></div>
    <div class="diff-line"><span>31</span><span>31</span><span></span><code></code></div>
    <div class="diff-line"><span>32</span><span>32</span><span></span><code>## systemd</code></div>
  </div>
  <div class="file-diff">
    <div class="file-heading"><code>sorcery.ngx.ts</code><span class="added push-right">+1</span><span class="removed">-1</span><span class="link">view</span></div>
    <div class="diff-line hunk"><span>@@ -1,4 +1,4 @@</span></div>
    <div class="diff-line del"><span>1</span><span></span><span class="removed">-</span><code>#!/usr/bin/env -S deno run -A</code></div>
    <div class="diff-line add"><span></span><span>1</span><span class="added">+</span><code>#!/usr/bin/env -S deno run</code></div>
    <div class="diff-line"><span>2</span><span>2</span><span></span><code></code></div>
    <div class="diff-line"><span>3</span><span>3</span><span></span><code><span class="keyword">import</span> ngx <span class="keyword">from</span> <span class="string">"jsr:@char/ngx@0.2"</span>;</code></div>
    <div class="diff-line"><span>4</span><span>4</span><span></span><code></code></div>
  </div>
</div>
</div>
<figcaption><a href="https://git.t4t.associates/char/sorcery/#commit/1acdf74737b6ad81a929b6ab717b087033bba32f">a commit diff in sorcery</a></figcaption>
</figure>

in the near-term i want to add support for CI annotations (which i am opinionated about, and will talk about in a future blog post!! smash that RSS button) & maybe in the future i'll extend the repo viewer into a discrete, more batteries-included forge project that i can use with my friends (once we really distill down to what's most important to us and what is superfluous...)

anyway, [check it out!](https://git.t4t.associates/char/sorcery)
