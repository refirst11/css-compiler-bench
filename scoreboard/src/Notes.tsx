import type { BenchmarkData, Environment } from "./types";

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="note">
      <summary>{title}</summary>
      <div className="note-body">{children}</div>
    </details>
  );
}

// The page describes whichever machine produced the JSON it is showing, rather
// than asserting a machine it cannot see.
export function MachineNote({ environment }: { environment?: Environment }) {
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
          drifts together when the host is busy. The same suite on an Apple M1 finishes in roughly
          two thirds of this time with the lanes in the same order.
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
        appears in only one of them belongs to the machine. <code>pnpm measure</code> reproduces
        this table on your own hardware.
      </p>
    </div>
  );
}

export function Notes({ data }: { data: BenchmarkData | null }) {
  const environment = data?.environment;

  return (
    <section className="section notes">
      <div className="section-heading">
        <div>
          <p className="eyebrow">notes</p>
          <h2>How to read this</h2>
        </div>
        <p className="section-detail">What the measurements cover, and what they do not.</p>
      </div>

      <MachineNote environment={environment} />

      <div className="callout">
        <strong>These are measurements, not verdicts.</strong> One fixture, one set of versions.
        Your hardware, your bundler and the shape of your codebase can move these numbers — in
        places by enough to reorder the table. The harness is public so the result can be re-run
        rather than trusted.
      </div>

      <Detail title="Where a lane resolves a variant">
        <p>
          Every lane renders the same 1,000 components across five variant axes. What separates them
          is <em>when</em> a variant becomes a class name.
        </p>
        <dl className="model-list">
          <dt>At build, merge included</dt>
          <dd>
            Plumeria and Devup UI inline one lookup table per axis, already reduced to the winning
            classes. Rendering is a property read; nothing ships to resolve anything.
          </dd>
          <dt>At build, merged at render</dt>
          <dd>
            StyleX keeps maps keyed by a hash of the CSS property and merges them with{" "}
            <code>styleq</code> at render — the same merge, kept alive at the cost of a resolver in
            the bundle.
          </dd>
          <dt>Not resolved</dt>
          <dd>
            CSS Modules, vanilla-extract, next-yak and Tailwind emit every candidate class and let
            the cascade decide; none of them can detect that two of them set the same property. The{" "}
            <code>tailwind-cn</code> lane buys that resolution back with a client-side library.
          </dd>
          <dt>Not at build</dt>
          <dd>
            Panda scans source to generate the stylesheet but never rewrites the call sites it
            scanned — there is no bundler plugin to do it — so the style objects survive into the
            bundle and <code>css()</code> turns them into class names on every render.
            styled-components goes further and produces no stylesheet at all: the template literal
            is evaluated at render, hashed into a class name, and the rule written into a{" "}
            <code>&lt;style&gt;</code> node inserted beside the component. Both read 0 B of
            Structure, and not because nothing ships — what ships is the resolver instead of the
            names it resolves to.
          </dd>
        </dl>
        <p>
          No lane defers a value to the markup any more, so every combination a lane can produce is
          in its stylesheet and the CSS column compares like with like. What the column cannot show
          is the conflict case: the merging lanes leave one class per property on the element, the
          unresolved ones leave both and let source order settle it.
        </p>
      </Detail>

      <Detail title="What a runtime buys">
        <p>
          Every lane executes code during <code>next build</code>. The distinction that reaches
          users is not whether something runs, but whether anything is left when it stops. A scanner
          emits CSS and is gone; a resolver in the SSR chunk runs again on every ISR regeneration,
          every dynamic request, and every client render.
        </p>
        <p>
          That resolver is not always waste. StyleX's merges style objects the compiler never saw —
          composed across module boundaries by callers no build ever observed together — and makes
          the outcome independent of stylesheet order. A compiler can only bake the combinations it
          can enumerate, and the Runtime column is the price of the ones it cannot.
        </p>
        <p>
          Panda's is there for a different reason. It buys no late composition the others lack; it
          is what a library needs when it declines to touch the call site at all, and the whole
          property-to-abbreviation table travels with it. styled-components pays the most and gets
          the most for it: a style can depend on anything a prop can hold, because nothing had to be
          decided early enough to constrain it.
        </p>
        <p>
          Read down the Runtime column and it is a price list for how late a class name is allowed
          to be decided: vanilla-extract bakes the name and ships nothing, StyleX ships{" "}
          <code>styleq</code> to merge, Panda ships a resolver, styled-components ships the whole
          library. The CSS column tells the same story from the other side — styled-components
          produces no stylesheet for it to measure.
        </p>
      </Detail>

      <Detail title="How conflicts are decided">
        <p>
          With one declaration per class, rule order cannot decide which atom wins, so specificity
          has to. Both atomic lanes stack <code>:not(#\#)</code> onto selectors — a no-op match that
          adds an id's worth of specificity — so a longhand outranks the shorthand it descends from.
          They differ in how many: StyleX assigns properties to fixed priority tiers, Plumeria walks
          the shorthand graph and uses the actual depth.
        </p>
        <p>
          Tailwind sidesteps the question with native cascade layers. It can afford to, because it
          never merges: there is no contest to arbitrate when the final class list is written by
          hand.
        </p>
      </Detail>

      <Detail title="How each number is measured">
        <ul className="method">
          <li>
            <strong>Cold build.</strong> Ten builds per lane with <code>.next</code> deleted before
            each, the first discarded. Lanes are shuffled deterministically per round, so none is
            systematically first on a cold machine.
          </li>
          <li>
            <strong>Library cost.</strong> That average minus the control's — everything adopting
            the library entails, not just time inside its compiler.
          </li>
          <li>
            <strong>Scale.</strong> The same lane rebuilt with 10 / 100 / 1,000 distinct styled
            definitions, with the rendered instance count fixed.
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

      <Detail title="What this does not measure">
        <p>
          Not what atomic CSS is for. Atomic declarations deduplicate, so the stylesheet stops
          growing with the codebase — the property that took facebook.com from tens of megabytes of
          CSS to a couple of hundred kilobytes. This fixture has two styled components; at that size
          the CSS column is close to a fixed overhead.
        </p>
        <p>Not rendering, hydration or interaction. And not developer experience.</p>
      </Detail>

      {environment && (
        <Detail title="This result's environment">
          <dl className="env-list">
            {[
              ["Measured", data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"],
              ["Machine", environment.ci ? (environment.runner ?? "CI runner") : "local"],
              [
                "CPU",
                environment.cpu
                  ? `${environment.cpu}${environment.cpuCount ? ` · ${environment.cpuCount} cores` : ""}`
                  : "—",
              ],
              ["Memory", environment.memoryGb ? `${environment.memoryGb} GB` : "—"],
              ["Node", environment.node ?? "—"],
              ["Commit", environment.commit ? environment.commit.slice(0, 12) : "—"],
              [
                "Rounds",
                data?.build
                  ? `${data.build.iterations} per lane, ${data.build.warmupIterations} discarded`
                  : "—",
              ],
              ["Lane order", "rotates one place per round"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Detail>
      )}
    </section>
  );
}
