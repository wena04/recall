import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ConnectSources from "@/pages/ConnectSources";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/connect" element={<ConnectSources />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}
