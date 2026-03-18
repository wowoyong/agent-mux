import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// No StrictMode — it double-fires useEffect which causes PTY double-spawn
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />,
);
