// src/components/AdminRouteGuard.jsx
import { useLocation } from "react-router-dom";

export default function AdminRouteGuard() {
  const location = useLocation();

  if (location.pathname.startsWith("/admin")) {
    // Let Django handle it
    return null;
  }

  return null;
}
