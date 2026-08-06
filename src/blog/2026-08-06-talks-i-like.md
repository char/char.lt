---
title: some software talks i like
description: "some talks that i think you should watch if you like watching talks"
stylesheets:
  - /css/talks-i-like.css
---

there are lots of recorded software talks! i have seen some of them. like anything with high volume & high variance in quality (tiktok, music, etc), it's often best to go through an intermediary for prefiltering. i will be your software talks filter today.

the type of talks i like are mostly about the craft of creating software, rather than any software itself: it's way more interesting to me to talk about the metaphysics of 'good abstraction' vs 'bad abstraction' than about how you can deploy three kubernetes pods to serve _200 OK Hello, world!_ or whatever. i am, however, sorry that i'm about to mostly show you a bunch of dudes saying shit. it's kind of just the demography of the field for now :/

## a preface

a wise scholar (me) once said:

<div class="bluesky-embed"><div class="author"><a class="avatar-link" href="https://bsky.app/profile/did:plc:7x6rtuenkuvxq3zsvffp2ide" target="_blank" rel="noopener"><img class="avatar" loading="lazy" src="https://cdn.bsky.app/img/avatar/plain/did:plc:7x6rtuenkuvxq3zsvffp2ide/bafkreicin6nsr6lbusyg5fthuljupjvhgul75lukgn27xpskfgjho7od7u" alt=""></a><a class="profile" href="https://bsky.app/profile/did:plc:7x6rtuenkuvxq3zsvffp2ide" target="_blank" rel="noopener"><bdi class="display-name">cinnamon 🐇 🏳️‍⚧️</bdi><span class="handle">@plushie.holdings</span></a><svg class="logo" aria-hidden="true" fill="none" viewBox="0 0 320 286"><path fill="#0A7AFF" d="M69.364 19.146c36.687 27.806 76.147 84.186 90.636 114.439 14.489-30.253 53.948-86.633 90.636-114.439C277.107-.917 320-16.44 320 32.957c0 9.865-5.603 82.875-8.889 94.729-11.423 41.208-53.045 51.719-90.071 45.357 64.719 11.12 81.182 47.953 45.627 84.785-80 82.874-106.667-44.333-106.667-44.333s-26.667 127.207-106.667 44.333c-35.555-36.832-19.092-73.665 45.627-84.785-37.026 6.362-78.648-4.149-90.071-45.357C5.603 115.832 0 42.822 0 32.957 0-16.44 42.893-.917 69.364 19.147Z"></path></svg></div><p class="text">i have been psyopped by aristotle into saying 'accidental' and 'essential' instead of saying incidental and inherent like a normal person</p><div class="footer"><time datetime="2026-04-21T09:39:20.450Z">April 21, 2026 at 10:39 AM</time><a class="permalink" href="https://bsky.app/profile/did:plc:7x6rtuenkuvxq3zsvffp2ide/post/3mjyoscvryk23" target="_blank" rel="noopener">View on Bluesky</a></div></div>

programming is language is communication. what we are doing when we program is to communicate a mechanism to a machine and to each other. the best talks give us effective shorthands (nomenclature) for novel or rediscovered mental models. essentially: i'm joining the war on jargon on the side of jargon. but you gotta use effective jargon

also i have a super recency-biased sample of talks here because i'm baby. sorry

## Simple made easy - Rich Hickey, at Strange Loop 2011

<figure class="youtube-embed"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/SxdOUGdseq4" title="Simple Made Easy — Rich Hickey" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><figcaption><a href="https://youtu.be/SxdOUGdseq4" aria-label="link to Simple Made Easy">(link)</a></figcaption></figure>

>  Okay, so there's this really cool word called "complect". I love it, it means _to interleave, or entwine, or braid_. It happens to be an archaic word, but you know, there're no rules that say you can't start using them again. \[...] This is where complexity comes from! Right? Complecting!

a beautiful snipe for me specifically. rich datomic appeals to etymology: "simple" -> "sim-plex" -> "one fold/weave"; as opposed to "com-plex" -> "woven together": complexity arises when concepts are entangled, and incidental complexity arises when concepts which _should be independent_ are entangled

## The Complexity of Simplicity - Bryan Cantrill, at TalosCon 2025

<figure class="youtube-embed"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/Cum5uN2634o" title="The Complexity of Simplicity — Bryan Cantrill" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><figcaption><a href="https://youtu.be/Cum5uN2634o" aria-label="link to The Complexity of Simplicity">(link)</a></figcaption></figure>

> When you have accidental complexity at one layer of the stack, it can explode: That accidental complexity can become the essential complexity of someone trying to build on top of you. [...] We don’t realize how contagious complexity can be.

bmc dtrace proposes a taxonomy of systems on two axes: from "simple" to "complex" and from "engineered" to "emergent". this works out to a matrix of "constructed" (complex, engineered), "rebellious" (simple, emergent), "accreted" (complex, emergent), and "revolutionary" (simple, engineered). this is like, _such_ a good framework for thinking about your dependencies, rivals, and favorite systems

## Programming is Forgetting: Toward a new hacker ethic - Allison Parrish, OSHW Summit 2016

<figure class="youtube-embed"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/MN0ZxG6K1-g?start=189" title="Programming is Forgetting: Toward a New Hacker Ethic — Allison Parrish" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><figcaption><a href="https://youtu.be/MN0ZxG6K1-g?t=189" aria-label="link to Programming is Forgetting: Toward a New Hacker Ethic">(link)</a></figcaption></figure>

> Bias in computer systems exists because every computer program is, by necessity, written from a particular point of view. \[...] The process of computer programming is taking the world, which is infinitely variable, mysterious, and unknowable, and turning it into procedures and data. We have a number of different names for this process: scanning, sampling, digitizing, transcribing, schematizing, programming; but the result is the same: the world \[...] is reduced to the repeatable and the discrete.

aparrish kills it. i think this reframing of abstraction as quantization (deliberate forgetting) is super interesting - who are you excluding when you codify your point of view into your software?

## Steel, Rust, and truth - Steve Klabnik, at Bug Bash 2026

<figure class="youtube-embed"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/L2AOrseB2_Y" title="Steel, Rust, and Truth — Steve Klabnik" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><figcaption><a href="https://youtu.be/L2AOrseB2_Y" aria-label="link to Steel, Rust, and Truth">(link)</a></figcaption></figure>

> for like, people who are supposed to be very rationally- & scientific-minded literally everyone has _so_ many feelings right now.

steve oomf basically frenetically calms you. he confronts the anxiety of labor displacement and alienation in software engineering apropos of AI, and parallels it with Pittsburgh's reinvention wrt the waxing and waning of the steel industry. the talk is also about how we can ever know machine-authored software is correct. and like, what even is correctness?? also he (duly!) says "weird" a bunch of times. shit is weird right now i get it

## Don't take the black pill! - Andrew Kelley, at Software Should Work 2026

<figure class="youtube-embed"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/zLZwpH5lCD4" title="Don't Take the Black Pill! — Andrew Kelley" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><figcaption><a href="https://youtu.be/zLZwpH5lCD4" aria-label="link to Don't Take the Black Pill!">(link)</a></figcaption></figure>

> As technologists, our role is to accelerate humanity along its current trajectory. The same technology can be a force for good or for evil, depending on who wields it. \[...] Thus, if humanity is good, then technology is good. And if humanity is evil, then technology is evil. This is why we must believe that humanity is generally good. Otherwise, what are we even doing?

andrewrk ziglang closes this talk out by saying "we will defeat those who use computers for coercion". i don't have much to add, it's really good. if you need hope you can get it here. i think i cried? when i was thinking about Stanislav Petrov again.. it must have been the day i did my estrogen shot lol

## Solving the right problems - Mike Acton, at Tehran Game Convention 2017

<figure class="youtube-embed"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/4B00hV3wmMY" title="Solving the Right Problems — Mike Acton" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><figcaption><a href="https://youtu.be/4B00hV3wmMY" aria-label="link to Solving the Right Problems">(link)</a></figcaption></figure>

> I'm not engineering in an imaginary fairy tale land, right? I'm not engineering for an abstract model that's running on an abstract piece of hardware, telling an abstract story. I'm specifically building a game that needs to run on a specific, finite set of hardware, and it needs to be done in this specific amount of time in this specific amount of money, right? There's a reality that we need to actually build for.  
> \[...]  
> The more context we have, the better we can solve the problem, so we need to be working in more context, not in less context. I think this is a trap for programmers in general, is they try to remove context.

Mike Insomniacgames starts by crucifying a bunch of common advice, and then focuses on outlining general, practical problem-solving skills for game engine programmers. it's really good to hold this one in tension with every other talk you may watch

## Swarm Testing - Will Wilson, at a Papers We Love in San Francisco

<figure class="youtube-embed"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/wzfC7Q-xNik" title="Swarm Testing — Will Wilson" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><figcaption><a href="https://youtu.be/wzfC7Q-xNik" aria-label="link to Swarm Testing">(link)</a></figcaption></figure>

> And again, these diagrams just look the same to me. I, like-- I've seen these before. And now I'm wondering, is this a coincidence?

William FoundationDB is here to talk about software testing a little and then (metaphorically) get a bunch of pushpins and red yarn and tie together a bunch of things on a corkboard. i really can't spoil the details. go watch
