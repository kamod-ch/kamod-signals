export const pretty = (value: unknown) => {
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
};

export default function DemoCard(props: {
  title: string;
  storage: string;
  description: string;
  value: unknown;
  actions: Array<{ text: string; onClick: () => void; secondary?: boolean }>;
  accent?: string;
  compact?: boolean;
}) {
  return (
    <article class={`signals-demo-card${props.accent ? ` signals-demo-card-${props.accent}` : ""}${props.compact ? " signals-demo-card-compact" : ""}`}>
      <div class="signals-demo-head">
        <h3>{props.title}</h3>
        <span class="signals-kbd">{props.storage}</span>
      </div>
      <p>{props.description}</p>
      <pre class="signals-demo-value">
        <span class="signals-demo-value-label">value </span>
        {pretty(props.value)}
      </pre>
      <div class="signals-demo-actions">
        {props.actions.map((action) => (
          <button
            class={action.secondary ? "secondary" : undefined}
            onClick={action.onClick}
            type="button"
            style={action.secondary
              ? { color: "var(--pp-c-text-1, #0f172a)", WebkitTextFillColor: "var(--pp-c-text-1, #0f172a)" }
              : { color: "#ffffff", WebkitTextFillColor: "#ffffff", background: "#1d4ed8" }}
          >
            {action.text}
          </button>
        ))}
      </div>
    </article>
  );
}
