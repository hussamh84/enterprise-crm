import { Outlet } from "react-router-dom";

export default function MobileLayout() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Outlet />
    </div>
  );
}
