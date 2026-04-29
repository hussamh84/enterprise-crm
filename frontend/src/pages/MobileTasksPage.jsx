import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { getDistanceMeters, getTaskCoordsStrict, getTaskLocation, getTaskTitle, normalizeTasks } from "../utils/mobileTasks";

export default function MobileTasksPage() {
  const navigate = useNavigate();
  const [activeCheckInId, setActiveCheckInId] = useState("");
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["mobile-technician-tasks"],
    queryFn: async () => (await api.get("/tickets")).data,
  });

  const tasks = useMemo(() => normalizeTasks(tickets), [tickets]);

  const handleCheckIn = async (task) => {
    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported on this device.");
      return;
    }
    if (!window.isSecureContext) {
      alert("GPS check-in requires HTTPS.");
      return;
    }

    const taskId = String(task?._id || "");
    setActiveCheckInId(taskId);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const projectCoords = getTaskCoordsStrict(task);
          if (!projectCoords) {
            alert("Project location is missing. Please contact admin.");
            return;
          }

          const [projectLat, projectLng] = projectCoords;
          const techLat = position.coords.latitude;
          const techLng = position.coords.longitude;
          const distance = getDistanceMeters(techLat, techLng, projectLat, projectLng);
          if (distance > 100) {
            alert("You are too far from the site ❌");
            return;
          }

          const data = {
            latitude: techLat,
            longitude: techLng,
            time: new Date().toISOString(),
            taskId,
            projectLatitude: projectLat,
            projectLongitude: projectLng,
          };

          await api.post("/visit/checkin", data);
          navigate(`/mobile/visit/${encodeURIComponent(taskId)}`);
        } catch (error) {
          console.error(error);
          alert("Unable to save check-in. Please try again.");
        } finally {
          setActiveCheckInId("");
        }
      },
      (error) => {
        console.error(error);
        alert("Location permission required");
        setActiveCheckInId("");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="space-y-3">
      <h1 className="text-base font-semibold text-gray-900">Task List</h1>
      {isLoading ? <div className="text-sm text-gray-500">Loading tasks...</div> : null}

      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task._id} className="bg-white rounded-xl p-3 shadow-sm border">
            <div className="font-semibold text-sm">{getTaskTitle(task)}</div>
            <div className="text-xs text-gray-400">{getTaskLocation(task)}</div>

            <button
              type="button"
              onClick={() => handleCheckIn(task)}
              disabled={activeCheckInId === String(task._id)}
              className="inline-flex mt-2 bg-orange-500 text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
            >
              {activeCheckInId === String(task._id) ? "Checking in..." : "Start Visit"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
