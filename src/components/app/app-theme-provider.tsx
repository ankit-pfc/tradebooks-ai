"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Density = "comfortable" | "compact";

const DENSITY_KEY = "tb-density";

/**
 * Pre-paint script. Runs from the server-rendered HTML before first paint, so a
 * hard load of an app route gets `tb-app` + the persisted density on <html> with
 * no flash. `tb-app` on <html> also reaches Radix/Base-UI portals (dialogs/menus
 * mount at <body>), which sit outside the React app subtree.
 *
 * The app is light-only (no dark mode), so this never touches the `dark` class.
 */
const initScript = `(function(){try{var d=document.documentElement;d.classList.add('tb-app');d.setAttribute('data-density',localStorage.getItem('${DENSITY_KEY}')||'comfortable');}catch(e){}})();`;

type AppThemeContextValue = {
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

export function AppThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads the persisted value on the client only (the init
  // script already applied the matching attribute), so no setState-in-effect.
  const [density, setDensityState] = useState<Density>(() =>
    readStored<Density>(DENSITY_KEY, "comfortable"),
  );

  // Scope the app token layer to the app segment; restore on leave so the
  // marketing landing keeps its own :root palette. (Class side-effects only.)
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add("tb-app");
    return () => {
      el.classList.remove("tb-app");
      el.removeAttribute("data-density");
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    try {
      localStorage.setItem(DENSITY_KEY, next);
    } catch {
      /* storage unavailable — in-memory only */
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
    <AppThemeContext.Provider value={{ density, setDensity, toggleDensity }}>
      <script dangerouslySetInnerHTML={{ __html: initScript }} />
      {children}
    </AppThemeContext.Provider>
  );
}

/** Global density default. Tables may still override locally via their own
 *  state, but read this as the initial value. */
export function useDensity(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useDensity must be used within <AppThemeProvider>");
  }
  return ctx;
}
