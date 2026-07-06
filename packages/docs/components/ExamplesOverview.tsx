const items = [
  {
    eyebrow: "Persistence",
    title: "Simple persistence",
    text: "Start with a single signal and persist it into localStorage, sessionStorage, cookie, memory, or IndexedDB.",
  },
  {
    eyebrow: "DX",
    title: "Framework friendly",
    text: "Use persistedSignal() for globals or usePersistedSignal() inside components.",
  },
  {
    eyebrow: "SSR",
    title: "SSR-aware cookies",
    text: "Read and write cookies through createCookieContext() on the server without touching browser APIs.",
  },
  {
    eyebrow: "Sync",
    title: "Cross-controller sync",
    text: "Signals stay in sync when multiple controllers point to the same storage/key pair.",
  },
];

export default function ExamplesOverview() {
  return (
    <div class="signals-grid signals-feature-grid">
      {items.map((item) => (
        <article class="signals-card signals-feature-card">
          <span class="signals-card-eyebrow">{item.eyebrow}</span>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </article>
      ))}
    </div>
  );
}
