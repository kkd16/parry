import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type QuickFilter =
  | { kind: "action"; value: "allow" | "block" | "observe" | "confirm" }
  | { kind: "tool"; value: "shell" | "file_edit" | "file_read" }
  | { kind: "time"; value: "5m" | "15m" | "1h" | "6h" | "24h" | "7d" | "30d" };

export interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  keywords?: string[];
  perform: () => void;
}

interface RegistryValue {
  commands: Command[];
  register: (cmds: Command[]) => () => void;
}

const CommandsContext = createContext<RegistryValue | null>(null);

export function CommandsProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const sources = useRef<Map<symbol, Command[]>>(new Map());

  const register = useCallback((cmds: Command[]) => {
    const key = Symbol();
    sources.current.set(key, cmds);
    setVersion((v) => v + 1);
    return () => {
      sources.current.delete(key);
      setVersion((v) => v + 1);
    };
  }, []);

  const commands = useMemo(() => {
    const all: Command[] = [];
    const seen = new Set<string>();
    for (const list of sources.current.values()) {
      for (const c of list) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        all.push(c);
      }
    }
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const value = useMemo(() => ({ commands, register }), [commands, register]);

  return <CommandsContext.Provider value={value}>{children}</CommandsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCommands(): RegistryValue {
  const ctx = useContext(CommandsContext);
  if (!ctx) throw new Error("useCommands must be used inside CommandsProvider");
  return ctx;
}

/**
 * Register commands for the lifetime of a component. Pass a stable
 * dependency list — the commands re-register whenever deps change.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useRegisterCommands(commands: Command[], deps: React.DependencyList) {
  const { register } = useCommands();
  useEffect(() => {
    return register(commands);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
