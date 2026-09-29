import { useEffect } from "react";
import { NavBar } from "./components/NavBar";
import { useRoute } from "./router";
import { StoreProvider, useStore } from "./store";
import { Binder } from "./pages/Binder";
import { Home } from "./pages/Home";
import { IdolDetail } from "./pages/IdolDetail";
import { IdolForm } from "./pages/IdolForm";
import { GroupDetail } from "./pages/GroupDetail";
import { GroupForm } from "./pages/GroupForm";
import { Login } from "./pages/Login";
import { ScoutingTable } from "./pages/ScoutingTable";
import { Settings } from "./pages/Settings";

function Screen() {
  const route = useRoute();
  const { refresh } = useStore();
  // Re-sync on every navigation so no page ever renders stale data
  // (e.g. a group created in another tab, or just before navigating here).
  useEffect(() => {
    void refresh();
  }, [route, refresh]);
  return (
    <div className="min-h-screen bg-sleeve text-ink">
      <NavBar route={route} />
      <main>
        {route.name === "home" && <Home />}
        {route.name === "table" && <ScoutingTable />}
        {route.name === "binder" && <Binder />}
        {route.name === "idol" && <IdolDetail id={Number(route.id)} />}
        {route.name === "group" && <GroupDetail id={Number(route.id)} />}
        {route.name === "add" && <IdolForm key="add" />}
        {route.name === "addGroup" && <GroupForm key="add-group" />}
        {route.name === "edit" && <IdolForm key={route.id} editId={Number(route.id)} />}
        {route.name === "login" && <Login />}
        {route.name === "settings" && <Settings />}
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6">
        <p className="text-[12px] text-mist">
          K-Profile — a scouting database for the idol age. All idols in the
          sample database are fictional.
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Screen />
    </StoreProvider>
  );
}
