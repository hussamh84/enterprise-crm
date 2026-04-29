import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../lib/api";

export default function TechnicianTasksPage() {
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["technician-tasks"],
    queryFn: async () => (await api.get("/tickets")).data,
  });

  const tasks = useMemo(() => (Array.isArray(tickets) ? tickets : []), [tickets]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">My Tasks</h1>
        <p className="page-subtitle">Assigned field tasks and site visits.</p>
      </div>

      {isLoading ? <div className="premium-card p-4 text-sm text-slate-500">Loading tasks...</div> : null}

      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task._id} className="premium-card p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[#0a2540]">{task?.subject || task?.title || "Task"}</p>
              <p className="text-xs text-slate-500">{task?.status || "open"}</p>
            </div>
            <Link to={`/site-visit?taskId=${encodeURIComponent(task._id)}`} className="btn-primary btn-compact">
              Check-in
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
