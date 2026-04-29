import { ListChecks, MapPinned, Wrench } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/mobile/map", label: "Map", icon: MapPinned },
  { to: "/mobile/tasks", label: "Tasks", icon: ListChecks },
  { to: "/mobile/visit/new", label: "Work Order", icon: Wrench },
];

export default function MobileTechnicianLayout() {
  return (
    <div className="min-h-screen bg-gray-100 w-full max-w-full">
      <main className="px-3 pt-3 pb-24">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-3 py-2 pb-4">
        <div className="grid grid-cols-3 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-xl py-3 text-xs font-semibold flex flex-col items-center justify-center gap-1 ${
                    isActive ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700"
                  }`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
