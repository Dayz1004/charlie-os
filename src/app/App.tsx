import { TodayView } from "../features/today/TodayView";
import { AppShell } from "./AppShell";

export function App() {
  return (
    <AppShell>
      <TodayView />
    </AppShell>
  );
}
