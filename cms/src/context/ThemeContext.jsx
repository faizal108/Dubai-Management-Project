import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "ui-theme";

export const THEME_MODES = ["light", "dark", "system"];
export const ACCENTS = ["indigo", "emerald", "rose", "amber", "slate"];

const DEFAULTS = { mode: "system", accent: "indigo" };

function readStored() {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      mode: THEME_MODES.includes(parsed.mode) ? parsed.mode : DEFAULTS.mode,
      accent: ACCENTS.includes(parsed.accent) ? parsed.accent : DEFAULTS.accent,
    };
  } catch {
    return DEFAULTS;
  }
}

function resolveMode(mode) {
  if (mode === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

function applyToDocument({ resolvedMode, accent }) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolvedMode === "dark");
  root.setAttribute("data-accent", accent);
  root.style.colorScheme = resolvedMode;
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [state, setState] = useState(readStored);
  const [resolvedMode, setResolvedMode] = useState(() =>
    resolveMode(state.mode)
  );

  // Apply to <html> on every change
  useEffect(() => {
    const next = resolveMode(state.mode);
    setResolvedMode(next);
    applyToDocument({ resolvedMode: next, accent: state.accent });
  }, [state.mode, state.accent]);

  // Persist
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / privacy errors */
    }
  }, [state]);

  // Follow OS when mode = system
  useEffect(() => {
    if (state.mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = mq.matches ? "dark" : "light";
      setResolvedMode(next);
      applyToDocument({ resolvedMode: next, accent: state.accent });
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [state.mode, state.accent]);

  const setMode = useCallback(
    (mode) => setState((s) => ({ ...s, mode })),
    []
  );
  const setAccent = useCallback(
    (accent) => setState((s) => ({ ...s, accent })),
    []
  );
  const toggleMode = useCallback(() => {
    setState((s) => ({
      ...s,
      mode: resolveMode(s.mode) === "dark" ? "light" : "dark",
    }));
  }, []);

  const value = useMemo(
    () => ({
      mode: state.mode,
      accent: state.accent,
      resolvedMode,
      setMode,
      setAccent,
      toggleMode,
    }),
    [state.mode, state.accent, resolvedMode, setMode, setAccent, toggleMode]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
