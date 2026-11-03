import { Fragment, type ReactNode } from "react";
import type { BenchmarkData, Environment } from "./types";

// What each lane's declared mechanism means, in the README's order. Which lanes
// carry each one is read from the run, so a new lane appears here without an
// edit.
const MECHANISMS: { key: string; label: string; description: ReactNode }[] = [
  {
    key: "names-only",
    label: "names only",
    description: "Rewrites local class names to unique ones and compiles no styles.",
  },
  {
    key: "authored-classes",
    label: "authored classes",
    description: "Scans for class names the author wrote by hand; never reads a style declaration.",
  },
  {
    key: "scans-source",
    label: "scans source",
    description:
      "Reads declarations out of source to generate the stylesheet, but leaves the call site alone: a shipped function picks the class at render.",
  },
  {
    key: "evaluates-module",
    label: "evaluates module",
    description: (
      <>
        Executes <code>.css.ts</code> files as modules during the build.
      </>
    ),
  },
  {
    key: "rewrites-ast",
    label: "rewrites AST",
    description: "Reads the AST and rewrites the call site into class names during the build.",
  },
  {
    key: "runtime",
    label: "runtime",
    description: (
      <>
        Produces no stylesheet; each rule is written into a <code>&lt;style&gt;</code> node at
        render.
      </>
    ),
  },
];

export function mechanismLabel(mechanism?: string) {
  if (!mechanism) return "—";
  return MECHANISMS.find((item) => item.key === mechanism)?.label ?? mechanism;
}

function Detail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="note">
      <summary>{title}</summary>
      <div className="note-body">{children}</div>
    </details>
  );
}

// The page describes whichever machine produced the JSON it is showing, rather
// than asserting a machine it cannot see.
function MachineNote({ environment }: { environment?: Environment }) {
  const virtual = environment?.ci === true;
  const machine = environment
    ? [
        environment.runner ?? `${environment.platform}/${environment.arch}`,
        environment.cpu,
        environment.cpuCount ? `${environment.cpuCount} cores` : null,
        environment.node,
      ]
        .filter(Boolean)
        .join(" · ")
    : "unknown";

  return (
    <div className="machine-note">
      <div className="machine-row">
        <span className={`machine-tag ${virtual ? "virtual" : "local"}`}>
          {virtual ? "virtual machine" : "local machine"}
        </span>
        <code>{machine}</code>
      </div>
      {virtual ? (
        <p>
          A GitHub-hosted runner is a virtual machine on shared infrastructure, with no guarantee
          about which physical CPU it lands on. Absolute seconds drift between runs, and every lane
          drifts together when the host is busy.
        </p>
      ) : (
        <p>
          A dedicated machine is quiet enough that the standard deviation separates differences a
          shared runner would bury in noise. It is also one machine, with one CPU and one set of
          background processes.
        </p>
      )}
      <p>
        So read the gaps, not the seconds: every cost here is reported against the control lane. A
        difference that survives both a laptop and a shared VM belongs to the library; one that
        appears in only one of them belongs to the machine.
      </p>
    </div>
  );
}

export function Notes({ data }: { data: BenchmarkData | null }) {
  const measurements = data?.build?.measurements ?? [];

  return (
    <section className="section notes" id="notes">
      <div className="section-heading">
        <div>
          <p className="eyebrow">notes</p>
          <h2>How to read this</h2>
        </div>
        <p className="section-detail">What the measurements cover, and what they do not.</p>
      </div>

      <MachineNote environment={data?.environment} />

      <div className="callout">
        <strong>One fixture, one set of versions, one machine.</strong> Your hardware, your bundler
        and the shape of your codebase can move these numbers — in places by enough to reorder the
        table. The harness is public so the result can be re-run rather than trusted:{" "}
        <code>pnpm measure</code> reproduces every table here on your own machine.
      </div>

      <Detail title="How each number is measured">
        <ul className="method">
          <li>
            <strong>Cold build.</strong> Every lane built once per round with <code>.next</code>{" "}
            deleted before each build, as many rounds as lanes plus one (twice as many with an odd
            lane count), the first discarded. Lane order follows a Williams design: every lane holds
            every position and follows every other lane exactly once, so none is systematically
            first on a cold machine or behind the same neighbour. The clock covers the lane's whole
            build script, a <code>prebuild</code> step such as <code>panda codegen</code> included.
          </li>
          <li>
            <strong>Library cost.</strong> That average minus the control's — everything adopting
            the library entails, not just time inside its compiler. Its median and 95% interval come
            from each round's difference from the control, so drift between rounds cancels.
          </li>
          <li>
            <strong>Sizes.</strong> Real file sizes, summed after each lane's final build.{" "}
            <code>.next</code> and CSS leave out <code>.next/cache</code>, which is reported on its
            own as Build cache: what Turbopack persisted while compiling the lane.
          </li>
          <li>
            <strong>Fixture identity.</strong> Right after the cold builds, every lane's rendered
            HTML is compared with the control's, ignoring <code>class</code>, <code>style</code> and{" "}
            <code>data-*</code> attributes. A lane that renders a different DOM turns the run red.
          </li>
          <li>
            <strong>Scale.</strong> The same lane rebuilt with 10 / 100 / 1,000 distinct styled
            definitions, with the rendered instance count fixed.
          </li>
          <li>
            <strong>Binding escape.</strong> One declaration written three ways — at the call site,
            behind a module-scope <code>const</code>, behind an expression that has to be evaluated
            — each built on its own and looked for in the emitted CSS.
          </li>
          <li>
            <strong>Structure.</strong> The class-name machinery in the SSR chunk — tables, baked
            strings, any resolver — separated from component code. A string counts only if every one
            of its tokens is a selector that lane's build emitted.
          </li>
          <li>
            <strong>Client chunk.</strong> The same extraction after a rebuild with the fixture
            marked <code>"use client"</code>, the normal case for variant-driven UI.
          </li>
        </ul>
      </Detail>

      <Detail title="What the mechanism labels mean">
        <p>
          “Compile-time CSS” names several different mechanisms. Each lane declares its own, and the
          binding probe checks how far it actually reaches.
        </p>
        <dl className="mechanism-list">
          {MECHANISMS.map(({ key, label, description }) => {
            const lanes = measurements
              .filter((item) => item.mechanism === key)
              .map((item) => item.label);
            return (
              <Fragment key={key}>
                <dt>
                  <span className="mechanism">{label}</span>
                </dt>
                <dd>
                  {description}
                  {lanes.length > 0 && <span className="lanes">{lanes.join(", ")}</span>}
                </dd>
              </Fragment>
            );
          })}
        </dl>
        <p>
          CSS Modules and Tailwind are controls rather than contestants: neither reads a style
          declaration and decides what class it becomes. styled-components marks the other end of
          the same line.
        </p>
      </Detail>

      <Detail title="Where a variant becomes a class name">
        <p>
          Every lane renders the same 1,000 components across five variant axes. What separates them
          in the structure table is <em>when</em> a variant becomes a class name, and what has to
          ship to make that happen.
        </p>
        <dl className="model-list">
          <dt>At build, merge included</dt>
          <dd>
            Plumeria and Devup UI inline one lookup table per axis, already reduced to the winning
            classes. Rendering is a property read; nothing ships to resolve anything.
          </dd>
          <dt>At build, selected by attribute</dt>
          <dd>
            Zyzz puts every candidate class on every element as one baked string, writes the choice
            into <code>data-*</code> attributes, and lets <code>:where([data-…])</code> rules pick
            the winner. Nothing ships to resolve anything; the markup carries the candidates
            instead, and a conflict keeps both classes and leaves it to stylesheet order.
          </dd>
          <dt>At build, merged at render</dt>
          <dd>
            StyleX keeps maps keyed by a hash of the CSS property and merges them with{" "}
            <code>styleq</code> at render. That resolver is not waste: it merges style objects
            composed across module boundaries that no build ever saw together, and makes the outcome
            independent of stylesheet order.
          </dd>
          <dt>Not resolved</dt>
          <dd>
            CSS Modules, vanilla-extract, yak and Tailwind emit every candidate class and let the
            cascade decide; none of them can detect that two of them set the same property. The{" "}
            <code>tailwind-cn</code> lane buys that resolution back with a client-side library.
          </dd>
          <dt>Not at build</dt>
          <dd>
            Panda scans source to generate the stylesheet but never rewrites the call sites it
            scanned, so the style objects survive into the bundle and <code>css()</code> turns them
            into class names on every render, with the whole property-to-abbreviation table along.
            styled-components produces no stylesheet at all: the template literal is evaluated at
            render, hashed into a class name, and the rule inserted into a{" "}
            <code>&lt;style&gt;</code> node. It pays the most and gets the most: a style can depend
            on anything a prop can hold.
          </dd>
        </dl>
        <p>
          Read down the Runtime column and it is a price list for how late a class name may be
          decided: vanilla-extract bakes the name and ships nothing, StyleX ships{" "}
          <code>styleq</code>, Panda ships a resolver, styled-components ships the whole library.
          Those last two read 0 B of Structure not because nothing ships, but because what ships is
          the resolver instead of the names it resolves to — and a resolver in the SSR chunk runs
          again on every ISR regeneration, every dynamic request and every client render.
        </p>
        <p>
          No lane defers a value to the markup, so every combination a lane can produce is in its
          stylesheet and the CSS column compares like with like. What that column cannot show is the
          conflict case: the merging lanes leave one class per property on the element, the
          unresolved ones leave both and let source order settle it.
        </p>
      </Detail>

      <Detail title="What this does not measure">
        <p>
          Not what atomic CSS is for. Atomic declarations deduplicate, so the stylesheet stops
          growing with the codebase — the property that took facebook.com from tens of megabytes of
          CSS to a couple of hundred kilobytes. This fixture has two styled components; at that size
          the CSS column is close to a fixed overhead.
        </p>
        <p>
          Not <code>next dev</code> or incremental rebuilds. Every timing is a cold production
          build, so the build cache is written but never read back.
        </p>
        <p>Not rendering, hydration or interaction. And not developer experience.</p>
      </Detail>
    </section>
  );
}
