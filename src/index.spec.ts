import { createCookieContext } from "./drivers";
import { __private__, persistedSignal } from "./persistedSignal";

describe("persistedSignal", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "theme=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    __private__.globalRegistry.clear();
  });

  it("hydrates from localStorage and writes updates back", () => {
    localStorage.setItem("theme", JSON.stringify("dark"));

    const theme = persistedSignal("theme", "light", { storage: "local" });
    expect(theme.value).toBe("dark");

    theme.value = "solarized";
    expect(JSON.parse(localStorage.getItem("theme") ?? "null")).toBe("solarized");
  });

  it("syncs independent controllers through memory storage", () => {
    const first = __private__.createController("shared-memory", 1, { storage: "memory" });
    const second = __private__.createController("shared-memory", 0, { storage: "memory" });

    first.signal.value = 5;
    expect(second.signal.value).toBe(5);

    first.dispose();
    second.dispose();
  });

  it("supports cookie storage", () => {
    const token = persistedSignal("theme", "light", {
      storage: "cookie",
      cookie: { path: "/" },
    });

    token.value = "dark";
    expect(document.cookie).toContain("theme=%22dark%22");
  });

  it("clear removes persisted state and restores the initial value", () => {
    const theme = persistedSignal("theme", "light", { storage: "local" });

    theme.value = "dark";
    theme.clear();

    expect(theme.value).toBe("light");
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("keeps undefined when removeOnUndefined is false", () => {
    const value = persistedSignal<string | undefined>("optional", "fallback", {
      storage: "local",
      removeOnUndefined: false,
    });

    value.value = undefined;

    expect(value.value).toBeUndefined();
    expect(localStorage.getItem("optional")).toBeTruthy();
  });

  it("hydrates and writes through an SSR cookie context", () => {
    const cookieContext = createCookieContext({ cookie: 'theme=%22dark%22' });
    const theme = persistedSignal("theme", "light", {
      storage: "cookie",
      cookieContext,
      cookie: { path: "/", sameSite: "Lax" },
    });

    expect(theme.value).toBe("dark");

    theme.value = "solarized";

    expect(cookieContext.get("theme")).toBe('"solarized"');
    expect(cookieContext.toSetCookieHeaders?.().some((header) => header.includes('theme=%22dark%22'))).toBe(true);
    expect(cookieContext.toSetCookieHeaders?.().some((header) => header.includes('theme=%22solarized%22'))).toBe(true);
  });

  it("isolates global cookie signals by cookie context", () => {
    const firstContext = createCookieContext({ cookie: 'theme=%22dark%22' });
    const secondContext = createCookieContext({ cookie: 'theme=%22light%22' });

    const first = persistedSignal("theme", "fallback", {
      storage: "cookie",
      cookieContext: firstContext,
    });
    const second = persistedSignal("theme", "fallback", {
      storage: "cookie",
      cookieContext: secondContext,
    });

    expect(first.value).toBe("dark");
    expect(second.value).toBe("light");
  });
});
