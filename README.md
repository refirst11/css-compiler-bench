# CSS compiler benchmark

**Live report: <https://refirst11.github.io/css-compiler-bench/>**

[![Benchmark](https://github.com/refirst11/css-compiler-bench/actions/workflows/benchmark.yml/badge.svg)](https://github.com/refirst11/css-compiler-bench/actions/workflows/benchmark.yml)

Build-time cost of compile-time CSS for React, on one identical Next.js app — with CSS
Modules and Tailwind as no-compiler controls, and styled-components at the other end as the
runtime approach the rest are an alternative to. Every setup ("lane") builds the same
components under the same conditions, so the numbers are actually comparable

A lane is one configuration, not one library: StyleX appears twice, compiled through Babel
and through SWC, and Tailwind appears with and without `cn`. Eight libraries currently
occupy eleven lanes

The question behind it: for a real component, what does each approach cost at `next build`,
and what class-name machinery does it leave in the bundle once the build is over

## The three mechanisms

"Compile-time CSS" names three different things here, and the difference is what this
benchmark is really measuring. Which one a lane does is not in its README — it is in its
Structure and Runtime columns.

| Lane | Folder | What it does at build | Where the class is decided |
|---|---|---|---|
| CSS Modules | `baseline` | rewrites local class names to unique ones; compiles no styles | build, names only |
| Tailwind | `tailwind` | scans for class names the author wrote by hand | authored |
| Tailwind + `cn` | `tailwind-cn` | the same, through `cn` | authored |
| vanilla-extract | `vanilla-extract` | **executes** `.css.ts` as a module | build |
| StyleX (Babel) | `stylex` | **reads the AST** and rewrites the call site | build |
| StyleX (SWC) | `stylexswc` | **reads the AST** and rewrites the call site | build |
| Plumeria | `plumeria` | **reads the AST** and rewrites the call site | build |
| next-yak | `next-yak` | **reads the AST** and rewrites the call site | build |
| Devup UI | `devup-ui` | **reads the AST** and rewrites the call site | build |
| Panda CSS | `panda` | scans source to generate the stylesheet | render, by a shipped function |
| styled-components | `styled-components` | nothing; no stylesheet is produced | render, into a `<style>` node |

The AST readers share one limit, and `pnpm bench:binding` measures it rather than asserting
it. The probe writes the same declaration three ways — the value at the call site, the value
behind a module-scope `const`, and the value behind an expression that has to be evaluated —
then looks for each in the emitted CSS. A plain binding does **not** defeat them: they fold
the constant. The expression does, and that is the line between reading the AST and executing
the module — vanilla-extract compiles all three, the AST readers compile the first two.

Deciding the class is not the same as deciding it at build. Panda decides it on every
render, and styled-components writes the rule at render too — which is why the last two
rows cost nothing at build and show up in the Runtime column instead.

The first three lanes are controls rather than contestants: neither CSS Modules nor Tailwind
reads a style declaration and decides what class it becomes, which is exactly what makes
them the baseline the rest are measured against. styled-components marks the other end of
the same line.

## Philosophy

- **Fairness.** The workload is defined once and applied to every lane: the same DOM, the
  same 1,000 instances across five variant axes (`color`, `size`, `padding`,
  `borderRadius`, `background`), and the same complex-style component with nested media
  queries, `:last-child` and conditional styles. A lane may not change the fixture. Library
  cost is literally this lane's build minus `benchmark/baseline/`, which styles that same
  DOM with plain CSS Modules and no library at all
- **Isolation.** Each lane is its own package under `benchmark/<lane>/` with its own
  `package.json`, its own dependencies and its own build config. The StyleX lane physically
  cannot import Plumeria, or a stray React copy; it only sees what it declares

There is no lane registry. A lane exists because its folder exists: `pnpm install` at the
root picks it up through a `benchmark/*/` glob, and every harness in `scripts/` discovers
it from the filesystem. Adding one is a folder, never an edit to a shared list

```
benchmark/<lane>/   one package per lane, listed in the table above
scripts/            the harnesses and their JSON exporter
scoreboard/         the Vite + React report
```

## What is measured

| Measurement | Unit | What it answers |
|---|---|---|
| **Cold build** | seconds ↓ | what one clean `next build` costs this lane |
| **Library cost** | ms | that build minus the control — everything adopting the library entails |
| **Scale** | seconds at 10 / 100 / 1,000 | whether cost tracks the number of *distinct definitions*, with rendered instances held fixed |
| **`.next` and CSS** | bytes | build output size, with `.next/cache` excluded |
| **Build cache** | bytes | what Turbopack persisted into `.next/cache` compiling this lane |
| **Shipped structure** | bytes | the class-name machinery left in the SSR chunk |
| **Client chunk** | bytes | the same, rebuilt with the fixture marked `"use client"` |
| **Binding escape** | verdict | whether the lane compiles a value it has to evaluate to know |

> [!IMPORTANT]
> **A difference smaller than the standard deviation is noise.** Every average is reported
> with its SD beside it, and the report is built so you can see that.

### How the numbers are taken

- **Rounds.** Each lane is built once per round, `.next` deleted before every build. There
  are as many rounds as lanes plus one, and the first is discarded — eleven measured builds
  per lane today. The discarded round is not for V8 startup, since every build is its own
  process and pays that anyway, but for what only a first run pays: a cold OS page cache
  over `node_modules` and the toolchain, and a CPU not yet at its sustained clock
- **Rotation.** Lane order rotates one place per round, which over a full cycle puts every
  lane in every position exactly once: no lane is systematically first on a cold machine,
  last on a hot one, or behind the same heavy neighbour
- **No parallelism.** Running the lanes at once would destroy the measurement rather than
  balance it — Turbopack already uses every core, and eleven concurrent builds on this
  laptop stretched each lane from 4.6–6.3s to 45–49s while inflating them unequally
- **What the clock covers.** The lane's whole `npm run build`, including the `prebuild` step
  npm runs ahead of it, so a lane needing a generation pass before `next build`
  (`panda codegen`) is timed with it. Deleting the previous round's output happens before
  the clock starts
- **Library cost** is everything adopting the library entails, not just time inside its
  compiler — a lane that moves the app off Next.js's SWC pipeline onto Babel pays for that
  here, because a user would too
- **Scale** separates "how big is the codebase" from "how many elements are on screen" by
  rebuilding the same lane at 10 / 100 / 1,000 distinct styled definitions
- **Bytes** are real file sizes summed recursively, not `du`, which rounds every file up to
  a disk block and overstates a tree of many small files
- **Build cache** is kept apart from output size because it is not a proxy for it: the two
  correlate at only r=0.38, and at 81–87% of their sum the cache would otherwise decide the
  ranking. Since `.next` is deleted before every measured build, all of it was written by
  the build being timed, and it reproduces to ±0.01MB across cold builds
- **Shipped structure** splits lookup tables, baked class strings and any resolver that
  ships with them from the component code around them. A string counts as class-name
  payload only if every one of its space-separated tokens is a selector that lane's own
  build emitted, so the measurement cannot drift into counting ordinary strings
- **Client chunk** is where a runtime resolver stops being free — `"use client"` is the
  normal case for variant-driven UI. It counts the chunks the fixture itself landed in;
  today Turbopack inlines each lane's styling code there, but a runtime hoisted into a
  shared vendor chunk by some future split would fall outside it
- **Failures** are recorded and the lane is dropped from the rest of the run, so one broken
  library still leaves every other lane measured. The run goes red and the report names the
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
pnpm bench                     # rounds = lanes + 1, first discarded
pnpm bench:scale               # 10 / 100 / 1,000 distinct definitions
pnpm bench:binding             # what each lane does with a value it must evaluate
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
