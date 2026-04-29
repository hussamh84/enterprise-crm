import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import api from "../lib/api";
import { getTaskCoords, getTaskLocation, getTaskTitle, normalizeTasks } from "../utils/mobileTasks";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function MobileMapPage() {
  const { data: tickets = [] } = useQuery({
    queryKey: ["mobile-technician-map"],
    queryFn: async () => (await api.get("/tickets")).data,
  });

  const tasks = useMemo(() => normalizeTasks(tickets), [tickets]);
  const markers = useMemo(() => tasks.map((task, index) => ({ task, coords: getTaskCoords(task, index) })), [tasks]);
  const defaultCenter = markers[0]?.coords || [25.2854, 51.531];

  return (
    <div className="space-y-3">
      <h1 className="text-base font-semibold text-gray-900">Assigned Locations</h1>
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
        <div className="h-[calc(100vh-160px)] min-h-[420px]">
          <MapContainer center={defaultCenter} zoom={12} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markers.map(({ task, coords }, index) => (
              <Marker key={task?._id || index} position={coords}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{getTaskTitle(task)}</p>
                    <p className="text-xs text-gray-500">{getTaskLocation(task)}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
