import { useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "table" }
  | { name: "binder" }
  | { name: "idol"; id: string }
  | { name: "add" }
  | { name: "edit"; id: string }
  | { name: "login" }
  | { name: "settings" };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  switch (parts[0]) {
    case "table":
      return { name: "table" };
    case "binder":
      return { name: "binder" };
    case "idol":
      return parts[1] ? { name: "idol", id: parts[1] } : { name: "binder" };
    case "add":
      return { name: "add" };
    case "edit":
      return parts[1] ? { name: "edit", id: parts[1] } : { name: "add" };
    case "login":
      return { name: "login" };
    case "settings":
      return { name: "settings" };
    default:
      return { name: "home" };
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

export function navigate(path: string) {
  location.hash = path;
}
