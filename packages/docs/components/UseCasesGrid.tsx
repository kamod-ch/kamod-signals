const items = [
  ["Theme & preferences", "Persist color mode, density, dismissed banners, and dashboard layout choices."],
  ["Per-tab UI state", "Keep sidebars, filters, and temporary flows only for the current browser tab."],
  ["SSR-visible values", "Store locale or similar hints in cookies so the server can read them too."],
  ["Drafts & cached data", "Move larger client-side payloads into IndexedDB with async hydration."],
];

export default function UseCasesGrid() {
  return (
    <div class="signals-grid signals-usecases-grid">
      {items.map(([title, text]) => (
        <article class="signals-card signals-card-strong signals-usecase-card">
          <span class="signals-card-eyebrow">Use case</span>
          <h3>{title}</h3>
          <p>{text}</p>
        </article>
      ))}
    </div>
  );
}
