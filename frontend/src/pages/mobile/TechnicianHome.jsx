import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { getTaskCoordsStrict, getTaskLocation, getTaskTitle, normalizeTasks } from "../../utils/mobileTasks";

export default function TechnicianHome() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [activeCheckInId, setActiveCheckInId] = useState("");
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["mobile-technician-tasks"],
    queryFn: async () => (await api.get("/tickets")).data,
  });
  const tasks = useMemo(() => normalizeTasks(tickets), [tickets]);

  const handleCheckIn = (task) => {
    const taskId = String(task?._id || "");
    if (!taskId) return;
    setActiveCheckInId(taskId);
    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported.");
      setActiveCheckInId("");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const coords = getTaskCoordsStrict(task);
          if (!coords) {
            alert("Project location is missing.");
            return;
          }
          const [projectLat, projectLng] = coords;
          const payload = {
            technicianId: String(user?._id || user?.id || ""),
            projectId: taskId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy ?? null,
            projectLatitude: projectLat,
            projectLongitude: projectLng,
            time: new Date().toISOString(),
            taskId,
          };
          const response = await api.post("/visit/checkin", payload);
          if (response?.data?.status === "OUTSIDE") {
            alert("You are too far from the site ❌");
            return;
          }
          navigate(`/mobile/visit/${encodeURIComponent(taskId)}`);
        } catch (_error) {
          alert("Check-in failed. Please retry.");
        } finally {
          setActiveCheckInId("");
        }
      },
      () => {
        alert("Location permission required");
        setActiveCheckInId("");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-3">
      <h1 className="text-lg font-semibold mb-3">My Tasks</h1>
      {isLoading ? <p className="text-sm text-gray-500">Loading tasks...</p> : null}
      <div className="space-y-3 pb-6">
        {tasks.map((task) => (
          <div key={task._id} className="bg-white rounded-xl p-3 shadow-sm border">
            <div className="font-semibold text-sm">{getTaskTitle(task)}</div>
            <div className="text-xs text-gray-400">{getTaskLocation(task)}</div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => handleCheckIn(task)}
                disabled={activeCheckInId === String(task._id)}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {activeCheckInId === String(task._id) ? "Checking..." : "Start Visit"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/mobile/map")}
                className="bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Open Map
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
