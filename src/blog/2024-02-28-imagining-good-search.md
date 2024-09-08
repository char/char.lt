---
title: imagining a good search engine
description: thinking through the conflicting incentives of search (& my contempt for the "SEO industry")
unlisted: true
draft: true
---

(THIS IS A DRAFT)

searching for information on the web feels like it's getting worse. or, has it always been bad? i'm not sure; i'm a zoomer.

anyway: recipe results take you to long-winded backstories, tech reviews are often shallow sponsor-pieces, programming guides are content marketing for SaaS products, and the 'instant answer' infobox feels wrong more often than it is right!

the sites you're taken to are also full of accidental complexity! i love interactive sites, and JavaScript is a super powerful & productive tool, but you shouldn't need to parse and execute [6 MB of scripts](https://tonsky.me/blog/js-bloat/#landings) just to view a mostly-static landing page for yet another $120/year subscription service :(

how did we get here?

## search engine optimization

the SEO game is borne, simply, of sites needing to rank high in search to drive traffic (which converts into revenue). every imperfection of a search engine's quality metric is exploited to outrank the competition, since 'true utility to the user' is something that can only be approximated.

so, here's my axiom: **"SEO is evil."**: the relationship between a user's web portal and an attention-seeking website is adversarial. sites which "play the game" must lose.

## proposal: an unoptimizable search engine

welcome to where this blog post begins.

there will be many more problems to come, but let's start with something simple:

building a ranking algorithm for search that is somehow better than the offerings of multiple multibillion dollar corporations.

easy. check this out:

1. users are different
    - holy shit :o
2. so ranking should not be "one-size-fits-all"
3. the more varied search ranking is, the harder it is to optimize for
    - especially if users have opposing preferences
4. if it's hard to do SEO, and SEO is evil, then there will be less evil in our search results.
    - when inorganic ranking boosts get harder, organic ranking (i.e. real user preference) wins more
5. so we should allow for specific, idiosyncratic, personalized user preferences to control search ranking algorithms
6. choosing on behalf of users is hard
    - machine learning >:(
7. letting users self-determine preferences is both easy and effective
    - `<select>` ^-^

so if we add some checkboxes and dropdowns to our search engine, we may be able to kill the SEO industry. yippee 🎉

## faceted ranking for websites

let's split ranking from a one-dimensional score into many separate metrics.

a metric is just an assessment algorithm with a well-known ID attached. it's a name and a function that takes in some data about a page load (i.e. the timing waterfall and content of a fetch of an HTML document and its associated resources)

look, here are some metrics i can think of right now:

- how large is the page download? `page_weight`
- how fast does the page load? `page_fetch_time`
- if there's client-side rendering: how long did we have to spend executing JS? `page_script_cost`
- is it the wikipedia article for the exact query `is_wikipedia`
- is there an RSS feed? `has_rss`
- is there any interstitial preventing interaction (e.g. a cookie warning, age gate, registration wall, etc) `interstitial`
- does this recipe have a huge backstory or does it get to the point `recipe_succinct`
- does the html look handwritten or generated `is_handwritten`

we can probably prefix these with namespaces, because:

## users care about different metrics, different amounts

you might even care about a metric in the opposite direction as somebody else!!

TODO: more brain dump

## making search feasible

so, we have the outline for... the philosophy of a ranking system for a search engine. what about the rest of the engine?

TODO: >:)
