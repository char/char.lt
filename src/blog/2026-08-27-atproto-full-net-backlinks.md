---
title: "(draft) a storage engine for generic network-scale AT Protocol data"
description: "here's the plan."
unlisted: true
stylesheets:
  - /css/vendor/katex.min.css
  - /css/terminal.css
  - /css/atproto-backlinks.css
---

lately i have been working on indexing backlinks on the AT Protocol network. on atproto, every reply links to its parent (and thread root), every like/repost points links to its subject, and every follow/block points at the target identity. to do useful work, you often need to reverse these links (e.g. find everyone who follows a given account, or find all replies to a given thread). so i'm working on backlink indexing; this duplicates the prior art of fig's [microcosm.blue constellation](https://microcosm.blue) with two differences:

- constellation, as a live-tailing system, only contains data after a certain epoch (its setup time) - but i want to index _all_ data on the network
- i am really aggressively interested in cheap & available hosting
  - constellation _is_ cheap! it runs on an rpi at home with a connected HDD. but it seems annoying to have to bring down for hardware upgrades or residential net/power outages. we're looking to build low-cost yet reliable infrastructure
  - i want to be much more storage-efficient by rolling my own fixed-size key-only store, as opposed to a variable-length key-value store like fjall or rocks

## the goal

at a high level, we want to ingest all the data on the network, and provide a query which lets you provide a "target" uri and get all record URIs on the network that link there.

it's evident that a backlink store is _basically_ the same style of inverted index as a full-text search system: instead of tracking "&lt;token&gt; occurs in &lt;document&gt;", we track "&lt;target&gt; is linked to by &lt;source&gt;". a caveat is that we have many "documents" and far fewer "token" occurrences, which means we ought to throw out things like integer interning for documents and instead devise something that requires as few dictionary lookups as possible.

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
    <marker id="storage-arrowhead" markerWidth="10" markerHeight="12" refX="9" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
      <path d="M 1 1 L 9 6 L 1 11" />
    </marker>
  </defs>
  <g class="storage-node">
    <rect x="35" y="85" width="160" height="80" rx="4" />
    <text x="115" y="122">my-server</text>
    <text class="capacity" x="115" y="145">≈50 GiB</text>
  </g>
  <line class="storage-link" x1="196" y1="125" x2="419" y2="125" marker-start="url(#storage-arrowhead)" marker-end="url(#storage-arrowhead)" />
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

[^1]: let's assume we're using `{-# LANGUAGE DuplicateRecordFields #-}` so that we don't have to write ugly type defs

[^1] but you may notice that none of these components are fixed-length at all. that might be a problem for us. whaddamagonnadoo??

### fixed-width DIDs

an interesting (and perhaps temporary[^2]) property of the `did:plc` did method having a single canonical directory is that it gives us a total ordering for all plc operations. we can assign a numeric ID to a PLC DID by just using the `seq` number of its genesis operation! this gets us a `u64` for any `did:plc`, and for `did:web` (the other atproto-blessed DID method) we can maintain our own intern table local to the application; we'll call this technique of maintaining our own list **"outlining"**.

we'll get this canonical ordering directly from a [plox](https://tangled.org/cerulea.blue/plox) database. since i already run this service, i'm already paying the cost of a full plc.directory replica - were this not the case, we could easily design a thin `did:plc`<->`seq` service that throws out most of the plc operation log.

we'll need to outline both `did:web` as well as invalid `did:plc` DIDs. we can use the most significant bit to distinguish between inline did:plc and outline DIDs. i have also reserved an additional top bit to provide two extra reserved tags, in case of future need (e.g. to mark any future enumerable DID methods as atproto evolves - we won't have to pay the cost of storing these outlined)

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

[^2]: if the PLC DID method ever becomes consortium-operated with many read-write directories, we can maintain our own arbitrary canonical ordering of operations.

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
  rkey :: U64,
  collection :: U64,
  did :: U64
} deriving (Eq, Ord)

data Backlink = Backlink {
  target :: RecordId, -- 24
  source :: RecordId, -- 48
  location :: U64,    -- 56
  sourceRev :: U64    -- 64
} deriving (Eq, Ord)
```

since most incoming firehose traffic consists of fresh records that link to other fresh records, we'll store the `rkey` first because they are likely to be (recent) timestamps: having largely-sequential ordering of incoming data allows us to curtail write amplification because our write key ranges will lie in one portion of the tree, instead of being uniformly distributed - this saves us having to dirty & re-compact a lot of deep levels of the tree all the time. once we get to a steady-state of relay tailing after our full repo ingests are done, we'll have a very light write workload.

we can also represent a bare DID target via `RecordId` in the same variant (i.e. without compromising fixed-length storage): let's reserve a special `<self>` collection & use the zero TID (`2222222222222`) as the rkey. these special links are only ever useful as the `target` of a `Backlink`, never the `source`. that is to say:

```
"at://did:example:bob" -> RecordId { rkey = 0, collection = 0, did = … }
```

## planning our query

in the ideal case, we would have a single sorted local run of every record-to-record link on the network: at query-time, this would mean that we would just need to binary search some sorted index of target `RecordId` -> byte offset into the big list of all backlink sources, and scan forward, returning `Backlink`s until we run into one that doesn't match our target. at ingestion-time, though, this would mean that we have to insert a record in the _middle_ of our index, and shift all the following ones forward - this leads to several hundred gigabytes of write just to add a new 64 byte entry!

this is a well-explored space, however, and the [LSM tree](https://github.com/tigerbeetle/tigerbeetle/blob/878411f/docs/internals/lsm.md) is a perfectly-shaped solution for us: we are essentially doing a prefix scan of a key-value store (with fixed-size keys and zero-sized values!). TigerBeetle's LSM implementation (linked above) is also excellent thanks to its incrementally-stepped compaction routines, instead of one-shot unamortized spikes. all we need to do is store sstables that contain our lexicographically sorted backlink data, with maybe some additional bloom(-esque?) filters per-table so that we can easily skip anything that we know for sure doesn't contain any data that we care about at query-time.

it's very fortunate that we only have one type of query to answer (`list_backlinks :: AtUri -> [Backlink]`) so we don't have to store any other type of index - but we could support e.g. some `listLinksByCollection` XRPC query with an index that uses a simple reordering of our `Backlink` struct (so that `source.collection` is prefix-scannable !)

we can do size-tiered compaction: group fully-published runs by compressed size, and merge eight similarly-sized runs into a super-run. for comparison parallelism, we can radix-split the runs by target hash and then sort these shards independently. then, we can just create a compacted run with one table per shard. we can use the same sharding at query-time to skip over tables we don't care about (we're only ever looking for one target!) and we don't need to sort the data across compacted tables either.

when we flush in-memory writes (to keep memory usage appropriately bounded!), we'll sort them and write a **"delta run"** which is characterized by having a single table: unlike a _compacted_ run, a delta run can contain frames from all shards - queries will need to check deltas at the same time as all the compacted runs, so we should eventually compact them into larger runs too.

<figure class="lsm-diagram">
<svg viewBox="0 0 720 370" role="img" aria-labelledby="lsm-title">
  <title id="lsm-title">compaction: eight runs merge by shard</title>
  <defs>
    <marker id="lsm-arrowhead" markerWidth="10" markerHeight="12" refX="9" refY="6" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M 1 1 L 9 6 L 1 11" />
    </marker>
  </defs>
  <text x="360" y="28">8 similarly sized published runs</text>
  <g class="run">
    <rect x="40" y="46" width="80" height="42" />
    <rect x="120" y="46" width="80" height="42" />
    <rect x="200" y="46" width="80" height="42" />
    <rect x="280" y="46" width="80" height="42" />
    <rect x="360" y="46" width="80" height="42" />
    <rect x="440" y="46" width="80" height="42" />
    <rect x="520" y="46" width="80" height="42" />
    <rect x="600" y="46" width="80" height="42" />
    <text x="80" y="73">A</text>
    <text x="160" y="73">B</text>
    <text x="240" y="73">C</text>
    <text x="320" y="73">D</text>
    <text x="400" y="73">E</text>
    <text x="480" y="73">F</text>
    <text x="560" y="73">G</text>
    <text x="640" y="73">H</text>
  </g>
  <line class="compact" x1="360" y1="89" x2="360" y2="130" marker-end="url(#lsm-arrowhead)" />
  <text x="360" y="153">(each worker reads one shard from all 8 input runs)</text>
  <g class="run">
    <rect x="40" y="176" width="160" height="48" />
    <rect x="240" y="176" width="160" height="48" />
    <rect x="520" y="176" width="160" height="48" />
    <text x="120" y="206">shard 1</text>
    <text x="320" y="206">shard 2</text>
    <text x="460" y="206">…</text>
    <text x="600" y="206">shard 64</text>
  </g>
  <g class="merge-links">
    <path d="M 120 225 V 252 H 600 V 225 M 320 225 V 252" />
    <line x1="360" y1="252" x2="360" y2="282" marker-end="url(#lsm-arrowhead)" />
  </g>
  <g class="result">
    <rect x="160" y="284" width="400" height="64" />
    <text x="360" y="310">all 64 shards become tables</text>
    <text x="360" y="334">and placed into 1 run</text>
  </g>
</svg>
</figure>

## metadata and bulk data

things get a little more complex, however, when we don't want to have the _entirety_ of the data resident on disk at once: our target case for operations is a cheap, small VPS (with little storage) backed by a large pool of object storage, without blowing up query latency. so we need to somehow keep latency-critical state local, but still offload the bulk of the data to object storage.

let's store our LSM tree's runs' sstables remotely as an object each and logically split it into independently-readable frames (≈64 KiB, then compressed with zstd). for each table, we'll keep an index locally which contains a bloom-esque[^3] filter over targets (so that we can skip irrelevant tables!), and metadata for each of its frames.

```haskell
data TableMetadata = TableMetadata {
  filter :: KeyFilter RecordId,
  frames :: [FrameMetadata]
}

data FrameMetadata = FrameMetadata {
  firstTarget :: RecordId,
  firstSource :: RecordId,
  targetContinues :: Bool, -- first target appears in previous frame
  offset :: U64,
  len :: U64
}
```

[^3]: we probably won't use a bloom filter exactly. sstables are definitionally immutable, so we can get better storage efficiency for the same probabilities by using a [xor](https://lemire.me/blog/2019/12/19/xor-filters-faster-and-smaller-than-bloom-filters/) or [binary fuse filter](https://lemire.github.io/talks/2023/fastfilters/fastfilter.html).

this means that to serve a query, we look at the full deltas + our target's shard in each compacted run, throw away any table whose filter doesn't match the query target, and then binary search for matching frames. a subtlety here is that since we have a frame size limit we can't assume that there's only one matching frame for a target: we need to allow exceptionally popular targets to span multiple frames (or even tables!), but since tables are sorted that means frames _within_ a table are sorted, and we can fetch many constituent frames at once by folding their ranges and using one contiguous object GET.

additionally, when we're compacting backlink runs, we can deduplicate identical backlinks with differing `sourceRev` values, keeping the fresher ones.

<figure class="lookup-diagram">
<svg viewBox="0 0 720 490" role="img" aria-labelledby="lookup-title">
  <title id="lookup-title">local filters and frame fences plan remote reads for a backlink query</title>
  <defs>
    <marker id="lookup-arrowhead" markerWidth="10" markerHeight="12" refX="9" refY="6" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M 1 1 L 9 6 L 1 11" />
    </marker>
  </defs>
  <g class="query">
    <rect x="265" y="12" width="190" height="44" />
    <text x="360" y="40">target = 0x42…</text>
  </g>
  <line class="flow" x1="360" y1="57" x2="360" y2="87" marker-end="url(#lookup-arrowhead)" />
  <rect class="panel" x="25" y="88" width="670" height="110" rx="4" />
  <text class="stage-label" x="45" y="116">1. probe candidate tables' filters (local)</text>
  <g class="table match">
    <rect x="100" y="138" width="160" height="42" />
    <text x="180" y="164">A: possible match</text>
  </g>
  <g class="table filter-miss">
    <rect x="280" y="138" width="160" height="42" />
    <text x="360" y="164">B: absent</text>
  </g>
  <g class="table match">
    <rect x="460" y="138" width="160" height="42" />
    <text x="540" y="164">C: possible match</text>
  </g>
  <line class="flow" x1="360" y1="199" x2="360" y2="229" marker-end="url(#lookup-arrowhead)" />
  <rect class="panel" x="25" y="230" width="670" height="110" rx="4" />
  <text class="stage-label" x="45" y="258">2. binary-search frame fences (local)</text>
  <g class="blocks">
    <rect x="100" y="280" width="80" height="42" />
    <rect class="match" x="180" y="280" width="80" height="42" />
    <rect class="match" x="260" y="280" width="80" height="42" />
    <rect x="380" y="280" width="80" height="42" />
    <rect class="match" x="460" y="280" width="80" height="42" />
    <rect x="540" y="280" width="80" height="42" />
    <text x="140" y="306">A0</text>
    <text x="220" y="306">A1</text>
    <text x="300" y="306">A2</text>
    <text x="420" y="306">C0</text>
    <text x="500" y="306">C1</text>
    <text x="580" y="306">C2</text>
  </g>
  <line class="flow" x1="360" y1="341" x2="360" y2="371" marker-end="url(#lookup-arrowhead)" />
  <rect class="panel" x="25" y="372" width="670" height="106" rx="4" />
  <text class="stage-label" x="45" y="400">3. fetch candidate frames concurrently (disk or S3)</text>
  <g class="get">
    <rect x="160" y="420" width="180" height="42" />
    <text x="250" y="446">A.data: frames 1–2</text>
    <rect x="380" y="420" width="180" height="42" />
    <text x="470" y="446">C.data: frame 1</text>
  </g>
</svg>
</figure>

## updates & deletes

this is the last big challenge: cleanup of deleted links is (or at least used to be) the [most resource-intensive part of microcosm](https://bsky.app/profile/bad-example.com/post/3llz5ypn3jc2t) so i want to solve this in an efficient way really badly: did you notice our `sourceRev` field on our `Backlink` struct? here's where we make use of it!! the high-level idea is that we store a revocation threshold for each source `RecordId`: we can tell if a backlink is irrelevant (and should be omitted from a query response) if its `sourceRev` is below the threshold. we don't want to store all the thresholds locally, however, so we'll need to employ the same strategies for offloading this data to object storage without blowing up query latency.

here, `sourceRev` is the value of an ingestion lamport clock, not the repo revision: this lets us process arbitrarily many deletes and recreates in the same atproto commit (i.e. they would all have the same rev!), in the case of a weird `applyWrites` or something. let's put all thresholds in a similar LSMT and again store local metadata for each table & each frame within these tables:

```haskell
data Revocation = Revocation {
  source :: RecordId,
  rev :: U64
} deriving (Eq, Ord)
-- & revocation block, revocation frame
```

when we receive a delete or update, we append a revocation with the current ingestion clock as the rev, invalidating all older links from that source. updates are handled the exact same way, except we _also_ scan the new version of the record for links :)

just like backlinks, when we're compacting revocation runs we can discard anything with a non-latest `rev` for the same source record :)

for a concrete example, let's suppose a record `A` is created at rev `10` with a link to `X`. we'll append `Backlink { target = X, source = A, sourceRev = 10 }`. at rev `20`, `A` is updated to link to `Y` instead. we append `Revocation { source = A, rev = 20 }`; then we append the new backlink to `Y` with `sourceRev = 20`. a query for `X` will still encounter the old backlink, but discard it after finding the revocation, while a query for `Y` will return the new one.

as a special case, we'll also support using the same "whole DID" `RecordId` zero-coll/-rkey encoding in a Revocation - this will apply to _all records in the repo_ (i.e. a backlink must be unrevoked at both its source record + rev as well as its source _repo_ + rev) so that we can "reset" a repository whenever we need to resync - we can just write a single revocation and then add all the links we find.

## filesystem layout

this is the part where we have all the information we need to concretize the in-filesystem layout of all our data: let's give each of our LSM trees a local & remote subdirectory, and each table within them a random ID as its name. we'll also need a local SQLite catalog which references all the active tables, and remote manifests for published views:

```text
[local data]
├── outlines.db
├── repos.db
└── state/
    ├── state.db
    └── tables/
        ├── links/<id>.{meta,data}
        └── thresholds/<id>.{meta,data}

s3://…/
├── CURRENT
├── manifests/<generation>-<digest>
├── tables/
│   ├── links/<id>.{meta,data}
│   └── thresholds/<id>.{meta,data}
├── outlines/<kind>/<after>-<through>
└── checkpoints/<generation>/<id>/repos.db.zst
```

since runs are immutable, we'll never need to overwrite anything in here: after compaction, we can just reference the newly-created run in the manifest, and schedule the now-obsolete constituent runs to be garbage collected.

we'll also support locally-caching hot tables. we'll store upload status in the local catalog so that we can keep a bounded size target of local data, without ever accidentally clobbering a table which is still pending upload.

## recap

so, our read path looks like at most two serially dependent round-trips to object storage:

- round 1: concurrently prefix-scan the `Backlink` LSMT for a given `target`, including recent in-memory writes
  - skip any tables that don't match the filter: no need to fetch
  - fetch matching frames concurrently, using the local fences
  - deduplicate identical backlinks, folding differing `sourceRev` by greatest-wins
- round 2: for each of the results (concurrently), read the `Revocation` LSMT to:
  1. find their record-level & repo-level thresholds
  2. discard any with a threshold greater than their source revision stamp
- return all matching `Backlink`s as an API response

our write path is simpler:

- to write a whole repo, we write a repo threshold and fill the `Backlink` LSMT at the same ingestion stamp
- for firehose ingest, we have to inspect a commit's ops:
  - for `action: "create"`, we can populate the `Backlink` LSMT as usual
  - for `action: "delete"`, we append a record threshold to the `Revocation` LSMT
  - for `action: "update"`, we have to treat it like a "delete; create", so we write to `Revocation`s and then write to `Backlink`s at the same stamp.

i have a few prototypes that aided in arriving at a design for this thing, and will be implementing this one shortly. wish me luck chat
