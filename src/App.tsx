import { NavBar } from "./components/NavBar";
import { useRoute } from "./router";
import { StoreProvider } from "./store";
import { Binder } from "./pages/Binder";
import { Home } from "./pages/Home";
import { IdolDetail } from "./pages/IdolDetail";
import { IdolForm } from "./pages/IdolForm";
import { Login } from "./pages/Login";
import { ScoutingTable } from "./pages/ScoutingTable";
import { Settings } from "./pages/Settings";

function Screen() {
  const route = useRoute();
  return (
    <div className="min-h-screen bg-sleeve text-ink">
      <NavBar route={route} />
      <main>
        {route.name === "home" && <Home />}
        {route.name === "table" && <ScoutingTable />}
        {route.name === "binder" && <Binder />}
        {route.name === "idol" && <IdolDetail id={Number(route.id)} />}
        {route.name === "add" && <IdolForm key="add" />}
        {route.name === "edit" && <IdolForm key={route.id} editId={Number(route.id)} />}
        {route.name === "login" && <Login />}
        {route.name === "settings" && <Settings />}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6">
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
