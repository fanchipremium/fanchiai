import "@/App.css";
import { Toaster } from "sonner";
import Studio from "@/components/Studio";

function App() {
  return (
    <div className="App grain">
      <Toaster theme="dark" position="top-center" richColors />
      <Studio />
    </div>
  );
}

export default App;
