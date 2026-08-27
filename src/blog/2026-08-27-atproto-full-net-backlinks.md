---
title: "(draft) a storage engine for generic network-scale AT Protocol data"
description: "here's the plan."
unlisted: true
stylesheets:
  - /css/vendor/katex.min.css
  - /css/terminal.css
---

lately i have been working on indexing backlinks on the AT Protocol network. this duplicates work by [microcosm.blue constellation](https://microcosm.blue) with two differences:

- constellation, as a live-tailing system, only contains data after a certain epoch (its setup time) - but i want to index _all_ data on the network
- i am really aggressively interested in cheap & available hosting
  - constellation _is_ cheap! it runs on an rpi at home with a connected HDD. but it seems annoying to have to bring down for hardware upgrades or residential net/power outages. we're looking to build low-cost yet reliable infrastructure
  - i want to be much more storage-efficient by rolling my own fixed-size key-only store, as opposed to a variable-length key-value store like fjall

at a high level, we want to ingest all the data on the network, and provide a query which lets you provide a "target" uri and get all record URIs on the network that link there.

```ansi
$ [32mcurl[0m [36m--get[0m [33m'https://[2m[…][22m/xrpc/blue.cerulea.backlinks.listBacklinks'[0m \
  [36m--data-urlencode[0m [33m'target=at://did:example:alice/app.bsky.feed.post/3muk2lq7n5s2a'[0m
{
  [94m"backlinks"[0m: {
    [94m"$.reply.parent"[0m: [
      [33m"at://did:example:bob/app.bsky.feed.post/3muk2m4x6p72b"[0m
    ],
    [94m"$.embed.record"[0m: [
      [33m"at://did:example:carol/app.bsky.feed.post/3muk2nq7v4k2c"[0m
    ]
  },
  [94m"cursor"[0m: [95mnull[0m
}
```

## object storage

the first decision i made in this project was to decouple storage and compute. as a write-heavy, read-sparse system, our storage requirements are super idiosyncratic vs what is available packaged _with_ compute, so being able to scale these axes independently is great for us. hosted object storage can be reasonably priced (around 8 dollars per TB for flat-rate options without transfer surcharges), so a couple terabytes plus a VPS can come out to around $40/mo to serve a full-network index!

high-touch local options are still open: running `garage` or similar in-homelab lets you disaggregate serving from storage (e.g. a NAS with a slow CPU + a faster server or laptop) & easily spread storage across multiple disks. so it's win-win :D

the drawbacks of remote storage are that query latencies go way up (especially for data dependency waterfalls!) because you're literally over WAN to get any data. but i think it's worth it & the pathological cases are avoidable via a much smaller set of local indices

<figure class="storage-diagram">
<svg viewBox="0 0 720 240" role="img" aria-labelledby="storage-title">
  <title id="storage-title">storage portions between the VPS and object storage</title>
  <defs>
    <marker id="storage-arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse" markerUnits="strokeWidth">
      <path d="M 0 0 L 8 4 L 0 8 z" />
    </marker>
  </defs>
  <g class="storage-node">
    <rect x="35" y="85" width="160" height="80" rx="4" />
    <text x="115" y="122">my-server</text>
    <text class="capacity" x="115" y="145">≈20 GiB</text>
  </g>
  <line class="storage-link" x1="230" y1="125" x2="385" y2="125" marker-start="url(#storage-arrowhead)" marker-end="url(#storage-arrowhead)" />
  <text x="305" y="105">WAN (slow!)</text>
  <g class="storage-node">
    <path d="M 420 65 V 155 C 420 167 471 175 535 175 C 599 175 650 167 650 155 V 65" />
    <ellipse class="storage-top" cx="535" cy="65" rx="115" ry="20" />
    <text x="535" y="122">s3://…</text>
    <text class="capacity" x="535" y="145">≈1 TiB</text>
  </g>
</svg>
</figure>

## fixed-width data

telically, storing sorted fixed-width data will allow you to efficiently query it via binary search. in the ideal case, you have _every_ backlink in a single, local sorted run (let's say 100 billion) ordered by target, and when you want to scan for all the backlinks to some target you get to binsearch & you will only need to perform <span class="language-math">\left\lceil \log_2(100\ 000\ 000\ 000) \right\rceil = 37</span> lookups, then you just perform a linear sweep. swag, right? unfortunately, we won't be able to keep all the data in a single packed local sorted run, because we're constantly appending new data and we have so much of it. but i'm getting ahead of myself

so we agree that having fixed length data is good: how do we turn backlinks into fixed length data? a backlink looks like this, a (target, source, location) triple:

```haskell
newtype AtUri = AtUri Text deriving (Eq, Ord)
data Backlink = Backlink {
  -- ex. "at://did:example:alice/app.bsky.feed.post/3mszwmrrick2s"
  target :: AtUri,
  -- ex. "at://did:example:bob/app.bsky.feed.post/3mszwmvzvk22s"
  source :: AtUri,
  -- ex. "$.reply.parent"
  location :: Text
} deriving (Eq, Ord)
```

but you may notice that none of these components are fixed-length at all. that might be a problem for us. whaddamagonnadoo??

### fixed-width DIDs

an interesting (and perhaps temporary[^1]) property of the `did:plc` did method having a single canonical directory is that it gives us a total ordering for all plc operations. we can assign a numeric ID to a PLC DID by just using the `seq` number of its genesis operation! this gets us a `u64` for any `did:plc`, and for `did:web` (the other atproto-blessed DID method) we can maintain our own intern table local to the application; we'll call this technique of maintaining our own list **"outlining"**. we'll need to outline both `did:web` as well as invalid `did:plc` DIDs. we can use the most significant bit to distinguish between inline did:plc and outline DIDs. i have also reserved an additional top bit to provide two extra reserved tags, in case of future need (e.g. to mark any future enumerable DID methods as atproto evolves - we won't have to pay the cost of storing these outlined)

| u64 header  | type     |
| ----------- | -------- |
| `0b00xx…xx` | did:plc  |
| `0b10xx…xx` | outlined |
| `0b01xx…xx` | reserved |
| `0b11xx…xx` | reserved |

for example:

```
did:plc:7x6rtuenkuvxq3zsvffp2ide -> 14997067
did:plc:ia76kvnndjutgedggx2ibrem -> 1726575
did:web:example.com              -> 9223372036854775809
```

[^1]: if the PLC DID method ever becomes consortium-operated with many read-write directories, we can maintain our own arbitrary canonical ordering of operations.

### fixed-width rkeys

most rkeys on the AT Protocol mainnet are [TIDs](https://atproto.com/specs/tid). there are two interesting facts here:

> - 64 bit integer
> - The top bit is always 0

this is almost suspiciously convenient: we can store TIDs as `u64`s ("inline rkeys") and non-TID rkeys outlined as a 63-bit counter with the most significant bit set to 1. i may reclaim some extra upper bits when the top bit is set for other quantizable rkey schemes, but right now people seem to be either using TIDs, fixed literals per collection, or some kind of low-cardinality slugs.

for example, if `self` and `for-you` are the first two entries in our rkey outline:

```
3jzfcijpj2z2a -> 1728652679052295174
self          -> 9223372036854775809
for-you       -> 9223372036854775810
```

### fixed-width backlinks

collections and locations are left over, but they're the most boring: we just have outline counter `u64`s for both. they're low-cardinality in the network (since they scale with the number of _lexicons_ and not the number of _records_), so this is fine.

we have an extra 8 bytes left before we fit perfectly in a cache line, so we'll also store a `sourceRev` for the backlink which tells us some clock value from when this backlink was recorded.

this leaves us with:

```haskell
data RecordId = RecordId {
  did :: U64,
  collection :: U64,
  rkey :: U64
} deriving (Eq, Ord)

data Backlink = Backlink {
  target :: RecordId, -- 24
  source :: RecordId, -- 48
  location :: U64,    -- 56
  sourceRev :: U64    -- 64
} deriving (Eq, Ord)
```

(the on-disk format will be big-endian, but it looks basically just like this!)

## planning our query

in the ideal case, we would have a single sorted local run of every record-to-record link on the network: at query-time, this would mean that we would just need to binary search some sorted index of target `RecordId` -> byte offset into the big list of all backlink sources, and return all the proceeding `Backlink`s until we run into one that doesn't match our target (TODO: clarify wording - maybe just use pseudocode here ?). at ingestion-time, though, this would mean that we have to insert a record in the _middle_ of our index, and shift all the proceeding ones forward - this leads to several hundred gigabytes of write just to add a new 64 byte entry!

this is a well-explored space, however, and the [LSM tree](https://github.com/tigerbeetle/tigerbeetle/blob/878411f/docs/internals/lsm.md) is a perfectly-shaped solution for us: we are essentially doing a prefix scan of a key-value store (with fixed-size keys and zero-sized values!). TigerBeetle's LSM implementation (linked above) is also excellent thanks to its incrementally-stepped compaction routines, instead of one-shot unamortized spikes. all we need to do is store sstables that contain our lexicographically sorted backlink data, with maybe some additional bloom filters or something per-block so that we can easily skip anything that we know for sure doesn't contain any data that we care about at query-time.

it's very fortunate that we only have one type of query to answer (`list_backlinks :: AtUri -> [Backlink]`) so we don't have to store any other type of index - but we could support e.g. some `listLinksByCollection` XRPC query with an index that uses a simple reordering of our `Backlink` struct (so that `target.collection` and `source.collection` are prefix-scannable !)

<figure class="lsm-diagram">
<svg viewBox="0 0 720 390" role="img" aria-labelledby="lsm-title">
  <title id="lsm-title">a backlink query touching many sorted LSM runs</title>
  <defs>
    <marker id="lsm-arrowhead" markerWidth="10" markerHeight="12" refX="9" refY="6" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M 1 1 L 9 6 L 1 11" />
    </marker>
  </defs>
  <g class="query">
    <rect x="180" y="12" width="170" height="44" />
    <text x="265" y="40">query: target = 0x42</text>
  </g>
<text class="level-label" x="24" y="119">L0</text>
<g class="run">
<rect x="80" y="90" width="54" height="46" />
<rect x="188" y="90" width="54" height="46" />
<rect class="match" x="134" y="90" width="54" height="46" />
<text x="107" y="119">00–2f</text>
<text x="161" y="119">30–5f</text>
<text x="215" y="119">60–8f</text>
</g>
<g class="run">
<rect x="270" y="90" width="54" height="46" />
<rect x="378" y="90" width="54" height="46" />
<rect class="match" x="324" y="90" width="54" height="46" />
<text x="297" y="119">10–2f</text>
<text x="351" y="119">30–4f</text>
<text x="405" y="119">50–9f</text>
</g>
  <line class="compact" x1="256" y1="146" x2="256" y2="176" marker-end="url(#lsm-arrowhead)" />
  <text class="small-label" x="275" y="166">compact</text>
<text class="level-label" x="24" y="214">L1</text>
<g class="run">
<rect x="80" y="185" width="58" height="46" />
<rect x="138" y="185" width="58" height="46" />
<rect x="312" y="185" width="58" height="46" />
<rect x="370" y="185" width="58" height="46" />
<rect class="match" x="196" y="185" width="58" height="46" />
<rect class="match" x="254" y="185" width="58" height="46" />
<text x="109" y="214">00–1f</text>
<text x="167" y="214">20–3f</text>
<text x="225" y="214">40–42</text>
<text x="283" y="214">42–5f</text>
<text x="341" y="214">60–8f</text>
<text x="399" y="214">90–bf</text>
</g>
  <line class="compact" x1="256" y1="241" x2="256" y2="271" marker-end="url(#lsm-arrowhead)" />
  <text class="small-label" x="275" y="261">compact</text>
<text class="level-label" x="24" y="309">L2</text>
<g class="run">
<rect x="80" y="280" width="116" height="46" />
<rect x="312" y="280" width="116" height="46" />
<rect class="match" x="196" y="280" width="116" height="46" />
<text x="138" y="309">00–2f</text>
<text x="254" y="309">30–5f</text>
<text x="370" y="309">60–bf</text>
</g>
  <g class="merge-links">
    <path d="M 442 113 H 490 V 303 M 438 208 H 490 M 438 303 H 490" />
    <line x1="490" y1="208" x2="520" y2="208" marker-end="url(#lsm-arrowhead)" />
  </g>
  <g class="result">
    <rect x="525" y="173" width="170" height="70" />
    <text x="610" y="202">return all matching</text>
    <text x="610" y="226">backlinks</text>
  </g>
  <g class="legend">
    <rect class="match" x="80" y="350" width="30" height="20" />
    <text x="122" y="365">block range may contain target</text>
  </g>
</svg>
</figure>

## storage layout

things get a little more complex, however, when we don't want to have all the data resident on disk at once: our target case for operations is a cheap, small VPS (with little storage) backed by a large pool of object storage, without blowing up query latency. so we need to somehow keep latency-critical state local, but still offload the bulk of the data to object storage.

let's store our LSM tree's runs' sstables (≈512MiB) remotely as an object each and logically split them into independently-readable blocks (≈1MiB, compressed). for each table, we'll keep an index locally which contains its target keyrange, a bloom-esque[^2] filter over targets (so that we can skip irrelevant tables!), and range fences for each of its blocks:[^3]

```haskell
data TableMetadata = TableMetadata {
  minTarget :: RecordId,
  maxTarget :: RecordId,
  filter :: KeyFilter RecordId,
  blocks :: [BlockMetadata]
}

data BlockMetadata = BlockMetadata {
  minTarget :: RecordId,
  maxTarget :: RecordId,
  offset :: U64, -- byte offset in table for this block
  len :: U64     -- compressed length
}
```

[^2]: we don't actually use a bloom filter exactly. sstables are definitionally immutable, so we can get better storage efficiency for the same probabilities by using a [xor](https://lemire.me/blog/2019/12/19/xor-filters-faster-and-smaller-than-bloom-filters/) or [binary fuse filter](https://lemire.github.io/talks/2023/fastfilters/fastfilter.html).
[^3]: let's assume we're using `{-# LANGUAGE DuplicateRecordFields #-}` so that we don't have to write ugly type defs

this means that to serve a query, we look at all table metadata, throw away any table whose target range / filter does not match our query target, and then binary search for matching blocks. a subtlety here is that since we have a block size limit we can't assume that there's only one matching block for a target: we need to allow exceptionally popular targets to span multiple blocks (or even tables!), but since blocks are sorted we can fetch many constituent blocks at once by folding their ranges and using one contiguous object GET.

we have to take into account our write path, as well: recent writes will stay local in the upper levels of our LSM tree and only after a few rounds of compaction into larger levels will we upload runs to object storage, so that we minimize object store write amplification & keep sparse data on a quickly-seekable medium. conversely, larger, deeper levels of the LSM tree should have fewer overlapping runs & more disjoint key ranges, so we will need to do scan fewer (remote) sstables.

additionally, when we're compacting backlinks into deeper level runs, we can discard anything with a non-latest `sourceRev` value (since it's superceded by fresher values).

## updates & deletes: 🐘 address me

ok. cleanup of deleted links is (or at least used to be) the [most resource-intensive part of microcosm](https://bsky.app/profile/bad-example.com/post/3llz5ypn3jc2t) so i want to solve this in an efficient way really badly: did you notice our `sourceRev` field on our `Backlink` struct? here's where we make use of it!! the high-level idea is that we store a revocation set of `(source, sourceRev)` pairs, and can tell if a backlink is irrelevant (and should be omitted from a query response) if its source and rev appear in the revocation set. we don't want to store the entire revoked set locally, however, so we'll need to employ the same strategies for offloading this data to object storage without blowing up query latency.

let's put all revocations in a similar LSMT and again store local metadata for each sstable of each run & each block within these tables:

```haskell
data Revocation = Revocation {
  source :: RecordId,
  rev :: U64
} deriving (Eq, Ord)

data RevocationTableMetadata = RevocationTableMetadata {
  min :: Revocation,
  max :: Revocation,
  filter :: KeyFilter Revocation,
  blocks :: [RevocationBlockMetadata]
}

data RevocationBlockMetadata = RevocationBlockMetadata {
  min :: Revocation,
  max :: Revocation,
  offset :: U64,
  len :: U64
}
```

when we receive a delete or update, though, we don't know the source record's current rev in order to revoke it! so we also need to store a forward index of _live_ `(source, rev)` values:

```haskell
data SourceHead = SourceHead {
  source :: RecordId,
  rev :: U64
} deriving (Eq, Ord)

data SourceHeadTableMetadata = SourceHeadTableMetadata {
  min :: RecordId,
  max :: RecordId,
  filter :: KeyFilter RecordId,
  blocks :: [SourceHeadBlockMetadata]
}

data SourceHeadBlockMetadata = SourceHeadBlockMetadata {
  min :: RecordId,
  max :: RecordId,
  offset :: U64,
  len :: U64
}
```

and just like backlinks, when we're compacting `SourceHead` runs we can discard anything with a non-latest `rev` for this `source` :)

## putting it all together

so, our read path looks like two round-trips to object storage:

- round 1: concurrently prefix-scan the `Backlink` remote LSMT for a given `target`
  - skip any tables that don't match min/max/filter: no need to fetch
  - fetch all blocks that match min/max for any matching tables concurrently
- round 2: for each of the results, discard any who have a corresponding entry in the `Revocation` LSMT
  - again, skip object fetches using min/max/filter
  - again, fetch all blocks concurrently
- return matching `Backlink`s as an API response

and our write path is a little more complex:

- to write a whole repo, we just have to fill the `Backlink` LSMT
- for firehose ingest, we have to inspect a commit's ops:
  - for `action: "create"`, we can populate the `Backlink` LSMT as usual
  - for `action: "delete"`, we have to read from the `SourceHead` LSMT to find the correct rev and then append to the `Revocation` LSMT
  - for `action: "update"`, we have to treat it like a delete && create, so we read from `SourceHead`s and then write to `Revocation`s and then write to `Backlink`s.

wish me luck chat
