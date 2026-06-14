"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";

const THEME_KEY = "tb-theme";
const DENSITY_KEY = "tb-density";

/**
 * Pre-paint script. Runs from the server-rendered HTML before first paint, so a
 * hard load of an app route gets `tb-app` + the persisted theme/density on
 * <html> with no flash. `tb-app` on <html> also reaches Radix/Base-UI portals
 * (dialogs/menus mount at <body>), which sit outside the React app subtree.
 */
const initScript = `(function(){try{var d=document.documentElement;d.classList.add('tb-app');var t=localStorage.getItem('${THEME_KEY}')||'light';var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);d.classList.toggle('dark',dark);d.setAttribute('data-density',localStorage.getItem('${DENSITY_KEY}')||'comfortable');}catch(e){}})();`;

type AppThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  density: Density;
  setDensity: (density: Density) => void;
  toggleDensity: () => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function readStored<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Track the OS dark-mode preference without setState-in-effect. */
function usePrefersDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializers read persisted values on the client only (the init script
  // already applied the matching classes), so there is no setState-in-effect.
  const [theme, setThemeState] = useState<Theme>(() =>
    readStored<Theme>(THEME_KEY, "light"),
  );
  const [density, setDensityState] = useState<Density>(() =>
    readStored<Density>(DENSITY_KEY, "comfortable"),
  );

  const prefersDark = usePrefersDark();
  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (prefersDark ? "dark" : "light") : theme;

  // Scope the app token layer to the app segment; restore on leave so the
  // marketing landing keeps its own :root palette. (Class side-effects only —
  // no setState, so this is lint-clean.)
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add("tb-app");
    return () => {
      el.classList.remove("tb-app", "dark");
      el.removeAttribute("data-density");
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable — in-memory only */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    try {
      localStorage.setItem(DENSITY_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleDensity = useCallback(() => {
    setDensityState((prev) => {
      const next = prev === "compact" ? "comfortable" : "compact";
      try {
        localStorage.setItem(DENSITY_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <AppThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
        density,
        setDensity,
        toggleDensity,
      }}
    >
      <script dangerouslySetInnerHTML={{ __html: initScript }} />
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within <AppThemeProvider>");
  }
  return ctx;
}

/** Convenience hook for the global density default. Tables may still override
 *  locally via their own state, but read this as the initial value. */
export function useDensity() {
  const { density, setDensity, toggleDensity } = useAppTheme();
  return { density, setDensity, toggleDensity };
}
