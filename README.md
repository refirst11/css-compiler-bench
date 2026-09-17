# CSS compiler benchmark

**Live report: <https://refirst11.github.io/css-compiler-bench/>**

[![Benchmark](https://github.com/refirst11/css-compiler-bench/actions/workflows/benchmark.yml/badge.svg)](https://github.com/refirst11/css-compiler-bench/actions/workflows/benchmark.yml)

Build-time cost of compile-time CSS for React, on one identical Next.js app — with CSS
Modules and Tailwind as no-compiler controls. Every setup ("lane") builds the same
components under the same conditions, so the numbers are actually comparable

A lane is one configuration, not one library: StyleX appears twice, compiled through Babel
and through SWC, and Tailwind appears with and without `cn`. Seven libraries currently
occupy ten lanes

The question behind it: for a real component, what does each approach cost at `next build`,
and what class-name machinery does it leave in the bundle once the build is over

## Philosophy

Two rules shape everything here:

- **Fairness.** The workload is defined once and applied to every lane: the same DOM, the
  same 1,000 instances across five variant axes (`color`, `size`, `padding`,
  `borderRadius`, `background`), and the same complex-style component with nested media
  queries, `:last-child` and conditional styles. A lane may not change the fixture. Every
  lane is measured against the same control — `benchmark/baseline/` styles that DOM with
  plain CSS Modules and no library at all, so "library cost" is literally this lane's build
  minus the control's. Two lanes are there to be controls rather than contestants: CSS
  Modules compiles no styles at all, it only rewrites local class names to globally unique
  ones, and Tailwind generates its stylesheet by scanning for class names the author already
  wrote by hand. Neither reads a style declaration and decides what class it becomes, which
  is exactly what makes them the baselines the other lanes are measured against. Note that
  deciding the class is not the same as deciding it at build. Three things get called
  compile-time CSS here and they are not the same mechanism: vanilla-extract **executes**
  the style code at build, in a compiler that evaluates `.css.ts` as a module; StyleX,
  Plumeria, next-yak and Devup UI **read the AST** at build and rewrite the call site, which
  is why a value reached through a binding defeats them; and Panda does neither — it scans
  source to generate the stylesheet, then ships a function that decides the class on every
  render. Which of the three a lane is doing is not in its README, it is in its Structure
  and Runtime columns
- **Isolation.** Each lane is its own package under `benchmark/<lane>/` with its own
  `package.json`, its own dependencies and its own build config. The StyleX lane physically
  cannot import Plumeria, or a stray React copy; it only sees what it declares

There is no lane registry. A lane exists because its folder exists: `pnpm install` at the
root picks it up through a `benchmark/*/` glob, and every harness in `scripts/` discovers
it from the filesystem. Adding one is a folder, never an edit to a shared list

```
benchmark/baseline/         CSS Modules — the no-library control
benchmark/plumeria/         Plumeria
benchmark/stylex/           StyleX (Babel)
benchmark/stylexswc/        StyleX (SWC)
benchmark/next-yak/         next-yak
benchmark/panda/            Panda CSS
benchmark/vanilla-extract/  vanilla-extract
benchmark/devup-ui/         Devup UI
benchmark/tailwind/         Tailwind CSS — concatenate only
benchmark/tailwind-cn/      Tailwind CSS + cn
scripts/                    the harnesses and their JSON exporter
scoreboard/                 the Vite + React report
```

## What is measured

- **Cold build** (seconds, lower better): 10 clean builds per lane, the first discarded to
  omit V8 and compiler cold start, `.next` deleted before each. Lanes are shuffled
  deterministically per round, so no lane is systematically first on a cold machine or last
  on a hot one. The average is reported with its standard deviation beside it — a
  difference smaller than the SD is noise, and the report is built so you can see that
- **Library cost** (ms): that average minus the control's. This is everything adopting the
  library entails, not just time inside its compiler — a lane that moves the app off
  Next.js's SWC pipeline onto Babel pays for that here, because a user would too
- **Scale** (build time vs distinct definitions): the same lane rebuilt with 10 / 100 /
  1,000 _distinct_ styled definitions, holding the rendered instance count fixed. This
  separates "how big is the codebase" from "how many elements are on screen"
- **`.next` and CSS** (bytes): real file sizes summed recursively, not `du`, which rounds
  every file up to a disk block and overstates a tree of many small files. This is build
  output only — `.next/cache` is reported on its own column instead
- **Build cache** (bytes): what Turbopack persisted into `.next/cache` while compiling this
  lane. Since `.next` is deleted before every measured build, all of it was written by the
  build being timed, and it is reproducible to ±0.01MB across cold builds. It is kept apart
  from the output size because it is not a proxy for it — the two correlate at r=0.38, and
  at 81–87% of their sum the cache would otherwise decide the ranking
- **Shipped structure** (bytes): the class-name machinery each lane leaves in the SSR
  chunk — lookup tables, baked class strings, and any resolver that ships with them —
  split from the component code around it. A string counts as class-name payload only if
  every one of its space-separated tokens is a selector that lane's own build emitted, so
  the measurement cannot drift into counting ordinary strings
- **Client chunk** (bytes): the same measurement on a rebuild with the fixture marked
  `"use client"`, which is the normal case for variant-driven UI. This is where a runtime
  resolver stops being free

A lane that fails to build is recorded and dropped from the rest of the run, so one broken
library still leaves every other lane measured; the run goes red and the report names the
lane that failed rather than quietly omitting it

> [!NOTE]
> **These are measurements, not verdicts.** Your hardware, your framework and bundler
> versions, and the size and shape of your codebase can all move these numbers — in places
> by enough to reorder the table. CI runners are shared and noisy, so treat a CI run as
> evidence that the relative trend reproduces on another OS and CPU, not as absolute
> timings for your laptop. The harness is in this repo precisely so the results can be
> re-run rather than taken on trust.

## Running it

```bash
pnpm install       # one install at the root covers every lane and the scoreboard

pnpm measure       # the full suite, exactly what CI runs
# or one measurement at a time:
pnpm bench                     # 10 cold builds per lane
pnpm bench:scale               # 10 / 100 / 1,000 distinct definitions
pnpm structure --client        # class-name structure, server and client

pnpm dev           # the scoreboard, reading whatever you just measured
pnpm build         # production build of the scoreboard
```

Every command merges its own section into `scoreboard/public/latest.json` — a build input,
not repository content — so the scoreboard always renders the run you just did. While
iterating, `BENCHMARK_ITERATIONS=3 pnpm bench` and `pnpm bench -- --lanes=plumeria,stylex`
cut a run down (the control is always included)

## How the report is published

`benchmark.yml` measures every lane on one runner in one job — build times are only
comparable when they were taken next to each other — and uploads the result as an artifact.
`deploy.yml` waits for that run to finish, builds the scoreboard around its JSON and
publishes to GitHub Pages; it also runs on a scoreboard-only push, where it redeploys in
about a minute from the last successful run's artifact without re-measuring. Until a
benchmark run has produced a result there is nothing to deploy, and the deploy skips rather
than publishing an empty page. The page itself then reads the public Actions API live, so it
can say whether CI is green right now and whether it is showing a measurement older than the
newest successful run

## Contributing

**Library authors are welcome to open a PR.** If your library is measured here and you can
make its lane faster or smaller, that PR is the point of the isolation rule: every lane is
its own package, so tuning yours touches only `benchmark/<your-lane>/` and cannot affect
anyone else's numbers. Check it with `pnpm bench -- --lanes=<your-lane>` — the control lane
is always included, so you can see your own library cost move

To add a library that is not here yet, create `benchmark/<name>/`:

1. `package.json` with a `bench` block — `{ "label": "Your Library", "scaleKind": "your-library" }`.
   `label` is what the charts show; `scaleKind` picks which fixture generator the scale
   sweep writes, so add a branch to `scripts/scale.ts` for a new one
2. `prebuild` and `build` scripts, where `prebuild` deletes `.next` — every measured build
   is a cold build
3. The fixture: copy the closest existing lane and swap only the styling layer

No registry edits anywhere; `pnpm install` picks the folder up and the next run measures it

What a PR may not change is the fixture itself: the DOM, the instance count and the variant
axes are the same for every lane, which is the only reason the numbers mean anything. If
your library needs a workload this benchmark cannot express, open an issue — that is a case
for a new fixture applied to everyone, not for one lane rendering something different
