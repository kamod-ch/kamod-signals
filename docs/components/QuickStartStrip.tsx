export default function QuickStartStrip() {
  return (
    <section class="signals-strip">
      <div>
        <p class="signals-strip-label">Quick start</p>
        <pre class="signals-strip-code">pnpm add @kamod-ch/signals @preact/signals preact</pre>
      </div>
      <div class="signals-strip-side">
        <div class="signals-strip-note">
          Install in one command, then choose the right storage strategy for preferences, drafts, SSR hints, or fallback state.
        </div>
        <div class="signals-strip-actions">
          <a class="signals-btn signals-btn-brand" href="/guide/getting-started">Open setup guide</a>
          <a class="signals-btn signals-btn-quiet" href="/guide/api">Read API</a>
        </div>
      </div>
    </section>
  );
}
