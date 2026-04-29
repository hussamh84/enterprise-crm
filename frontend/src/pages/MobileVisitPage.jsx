import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import api from "../lib/api";
import { getTaskCoords } from "../utils/mobileTasks";

export default function MobileVisitPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [images, setImages] = useState([]);
  const [notes, setNotes] = useState("");
  const [materials, setMaterials] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [technicianCoords, setTechnicianCoords] = useState(null);

  const imageNames = useMemo(() => images.map((file) => file.name).join(", "), [images]);
  const { data: tickets = [] } = useQuery({
    queryKey: ["mobile-technician-tasks"],
    queryFn: async () => (await api.get("/tickets")).data,
  });
  const selectedTask = useMemo(
    () => (Array.isArray(tickets) ? tickets.find((task) => String(task?._id) === String(id)) : null),
    [tickets, id]
  );
  const projectCoords = useMemo(() => getTaskCoords(selectedTask || {}, 0), [selectedTask]);
  const mapCenter = technicianCoords || projectCoords;

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setTechnicianCoords([position.coords.latitude, position.coords.longitude]);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const submitVisit = useMutation({
    mutationFn: async () => {
      const payload = {
        report: `${notes}\nMaterials: ${materials}\nTotal Cost: ${totalCost}`,
        images: images.map((file) => file.name),
        visitDate: new Date().toISOString(),
        assignedTechnician: "current_user",
        taskId: id,
      };
      await api.post("/site-visits", payload);
      await api.post("/notifications/technician-complete", payload).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-technician-tasks"] });
      navigate("/mobile/tasks");
    },
  });

  return (
    <div className="space-y-3">
      <h1 className="text-base font-semibold text-gray-900">Work Order</h1>

      <div className="bg-white rounded-xl p-4 shadow-sm border space-y-4">
        <div className="rounded-xl overflow-hidden border border-gray-200">
          <div className="h-56 w-full">
            <MapContainer center={mapCenter} zoom={13} className="h-full w-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {technicianCoords ? (
                <Marker position={technicianCoords}>
                  <Popup>Technician (current)</Popup>
                </Marker>
              ) : null}
              <Marker position={projectCoords}>
                <Popup>Client location</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Upload Image</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setImages(Array.from(event.target.files || []))}
            className="w-full text-sm"
          />
          {imageNames ? <p className="text-xs text-gray-400 mt-1">{imageNames}</p> : null}
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Notes</label>
          <textarea
            className="w-full border rounded p-2 min-h-28"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Visit notes"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Materials</label>
          <input
            className="w-full border rounded p-2"
            value={materials}
            onChange={(event) => setMaterials(event.target.value)}
            placeholder="Materials used"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Total Cost</label>
          <input
            type="number"
            min="0"
            className="w-full border rounded p-2"
            value={totalCost}
            onChange={(event) => setTotalCost(event.target.value)}
            placeholder="0.00"
          />
          <p className="mt-2 text-sm font-semibold text-gray-800">Total: {Number(totalCost || 0).toFixed(2)}</p>
        </div>

        <button
          type="button"
          className="w-full bg-black text-white py-3 rounded-lg text-base font-semibold"
          disabled={submitVisit.isPending}
          onClick={() => submitVisit.mutate()}
        >
          {submitVisit.isPending ? "Submitting..." : "Submit Visit"}
        </button>
      </div>
    </div>
  );
}
