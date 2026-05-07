---
title: "plox: lazy-trust verifiable, on-PDS bulk did:plc operation archival"
description: "atproto ethos as applied to open data? an experiment"
---

tl;dr: plox is a canonical encoding of the did:plc directory, stored in an atproto PDS. as of may 2026 [at://cerulea.blue/blue.cerulea.plox.bundle](https://pdsls.dev/at://did:plc:2reekgrdknp6kf3z6nv7n2av/blue.cerulea.plox.bundle) is taking up 35 GB on disk (`zstd`-compressed; ≈80 GB raw). you can use it to bootstrap a PLC directory mirror in minutes rather than hours, and since anyone can recompute and verify the plox CIDs against the canonical plc.directory, we have _lazy-trust_ properties.

anyway, i'll get to the long version:

## stable identity on atproto

please humor me while i define my terms:

a DID is essentially a referent to a blob of user-controlled JSON (the "DID Document"), you "resolve" (or "dereference") the DID to get the contents of the DID doc. on the mainline AT Protocol, we can choose between `did:plc` and `did:web`. these have a bunch of different trade-offs but in principle a `did:web` _points to a location_, while a `did:plc` _refers to an object_.

to resolve an atproto `did:web`, you basically submit a HTTPS request to `.well-known/did.json` at the hostname in the identifier[^1] . web DIDs are ripe for shenanigans: the user becomes privy to metadata about when/by which applications/how their DID is dereferenced, can provide different versions of the DID document to different requesters[^2], or perform other HTTP attacks (e.g. slow-loris) against a requesting application. if your application is resolving a `did:web`, make sure you guard against slow, very large, or otherwise unusual responses.

[^1]: the full web did specification defines a format for web dids that serve their `did.json` at other paths, but atproto discards these cases.
[^2]: if there's no established name for this I think we could call it a "web DID Janus attack". it could be pretty cool if you wanted to have an atproto repo that was served from a cluster of PDSes - you can give a different replica for every resolution of the document.

to resolve a `did:plc`, you ask the authoritative "DID PLC Directory" (at [plc.directory](https://plc.directory/)) to give you the document for the given identifier. this _is_ a severe centralization risk (see below), but the upshot is that we have very cheap resolution of an object that's referred to by a _non-arbitrary, deterministic identifier_: PLC DIDs are controlled by cryptographic keys, and their identifiers are a truncated hash of the creation data, so replicas of the ledger can validate and reproduce the exact same ID and key mutation log when presented the same (signed) operations[^3].

[^3]: this is actually not completely true in the case of a PLC hardfork and a DID with a rotated-out, compromised key: an attacker can use the leaked key to create an alternative history for the DID, and the replica has no way of knowing which fork is authoritative without trusting the original PLC directory's say on sequencing, but I digress.

but there's a problem: the directory of PLC DIDs only allows you to submit (in testing) 500 requests every 5 minutes. this is fine for most atproto services, but not for running a full-scale relay (where every DID must be dereferenced to check if a PDS/signing key is authoritative for an event) or for extremely scaled-up atproto apps (where 500 DID cache misses in 5 minutes is plausible). this is reason A to run a read replica.

reason B to run a replica is that we need it in the case of did:plc exit: we've all (passively) agreed to use the central service controlled by Bluesky PBC (for now; a Verein soon) to look up PLC DIDs. therefore, they essentially form a Proof-by-Decree ledger (_fiat DIDs_, if you will): the central directory is _supposed_ to accept all valid operations (subject to rate limits), but can technically refuse at any time - in this case, we can all agree on a directory run by someone else, but they need to already have a complete copy of the operation log, we don't want to beg our adversary.

## running a replica

a PLC directory has to perform the following tasks:
- return results for queries of DID documents (`GET /:did`) or their full operation log (`GET /:did/audit/log`) / current operation chain (`GET /:did/log`)
- accept PLC operations (`POST /:did`) - a read replica can skip this
- return bulk exports for all DIDs and accepted operations (`GET /export`)
- subtly: provide a reliable timestamp for any accepted PLC operation (as inside audit logs & exports)
- subtly: provide an ordinal sequence number for any accepted PLC operation[^4]

to be able to mirror all the operations, we must first fetch all the operations. as mentioned before, we can only submit a request every ≈600ms (5min / 500 requests) but there are almost a hundred million plc ops (a hundred thousand `/export` requests in sequence - about 17 hours of non-stop backfill!)

in comparison, plox bundles can be fetched in parallel (from as many separate PDSes as are hosting the data), contain 500,000 records each, and can allow you to backfill up to the latest plox snapshot, then cut over to the plc directory. since you will probably only be behind by 500,000 records, you then only have to fetch an upper bound of 500 `/export`  requests from the canonical directory, which takes five minutes.

[^4]: we hard-rely on the plc directory's `seq` numbers just for export pagination (for now), but they're also useful for perfect-hashing PLC DIDs for size! (you can turn a PLC DID into the first `seq` it appears in, or just an incrementing id of all DIDs ever seen on the directory - see [zplc-server](https://github.com/char/zplc-server).)

## release

the [plox source code is on tangled](https://tangled.org/cerulea.blue/plox) and is still work-in-progress & evolving - expect some related projects to come soon, like scripts to bootstrap the reference plc replica from the plox data & cerulea's own plc replica implementation.
