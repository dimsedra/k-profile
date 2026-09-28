import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_CONFIG, type EngineConfig, type Idol } from "./engine/ovr";
import { SEED_IDOLS } from "./data/seed";

const IDOLS_KEY = "kprofile.idols.v1";
const CONFIG_KEY = "kprofile.config.v1";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface Store {
  idols: Idol[];
  config: EngineConfig;
  addIdol: (idol: Idol) => void;
  updateIdol: (idol: Idol) => void;
  deleteIdol: (id: string) => void;
  setConfig: (cfg: EngineConfig) => void;
  resetConfig: () => void;
  restoreSamples: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [idols, setIdols] = useState<Idol[]>(() => load(IDOLS_KEY, SEED_IDOLS));
  const [config, setConfigState] = useState<EngineConfig>(() => {
    const saved = load(CONFIG_KEY, DEFAULT_CONFIG);
    // merge so new engine fields survive old saves
    return {
      ...DEFAULT_CONFIG,
      ...saved,
      subWeights: { ...DEFAULT_CONFIG.subWeights, ...saved.subWeights },
      roleMatrix: { ...DEFAULT_CONFIG.roleMatrix, ...saved.roleMatrix },
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(IDOLS_KEY, JSON.stringify(idols));
    } catch {
      /* storage full (large photos) — keep session state only */
    }
  }, [idols]);

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  const addIdol = useCallback((idol: Idol) => setIdols((s) => [...s, idol]), []);
  const updateIdol = useCallback(
    (idol: Idol) => setIdols((s) => s.map((i) => (i.id === idol.id ? idol : i))),
    []
  );
  const deleteIdol = useCallback(
    (id: string) => setIdols((s) => s.filter((i) => i.id !== id)),
    []
  );
  const setConfig = useCallback((cfg: EngineConfig) => setConfigState(cfg), []);
  const resetConfig = useCallback(() => setConfigState(DEFAULT_CONFIG), []);
  const restoreSamples = useCallback(() => setIdols(SEED_IDOLS), []);

  const value = useMemo(
    () => ({ idols, config, addIdol, updateIdol, deleteIdol, setConfig, resetConfig, restoreSamples }),
    [idols, config, addIdol, updateIdol, deleteIdol, setConfig, resetConfig, restoreSamples]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
