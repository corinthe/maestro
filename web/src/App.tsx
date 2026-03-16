import { Routes, Route, NavLink } from "react-router-dom";
import { TaskListPage } from "./pages/task-list-page";
import { TaskDetailPage } from "./pages/task-detail-page";
import { useWebSocket } from "./hooks/use-websocket";

export function App(): React.JSX.Element {
  const { status } = useWebSocket();

  return (
    <div className="app">
      <header className="app-header">
        <nav className="app-nav">
          <NavLink to="/" className="app-logo">
            Maestro
          </NavLink>
          <div className="nav-links">
            <NavLink to="/" end>
              Tâches
            </NavLink>
          </div>
          <div className="ws-status">
            <span
              className={`ws-dot ${status}`}
              title={`WebSocket: ${status}`}
            />
          </div>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<TaskListPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
