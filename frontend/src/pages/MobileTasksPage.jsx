import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { getTaskLocation, getTaskTitle, normalizeTasks } from "../utils/mobileTasks";

export default function MobileTasksPage() {
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["mobile-technician-tasks"],
    queryFn: async () => (await api.get("/tickets")).data,
  });

  const tasks = useMemo(() => normalizeTasks(tickets), [tickets]);

  return (
    <div className="space-y-3">
      <h1 className="text-base font-semibold text-gray-900">Task List</h1>
      {isLoading ? <div className="text-sm text-gray-500">Loading tasks...</div> : null}

      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task._id} className="bg-white rounded-xl p-3 shadow-sm border">
            <div className="font-semibold text-sm">{getTaskTitle(task)}</div>
            <div className="text-xs text-gray-400">{getTaskLocation(task)}</div>

            <Link
              to={`/mobile/visit/${encodeURIComponent(task._id)}`}
              className="inline-flex mt-2 bg-orange-500 text-white px-3 py-2 rounded-lg text-sm font-semibold"
            >
              Start Visit
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
