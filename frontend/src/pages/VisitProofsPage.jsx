import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import api from "../lib/api";

export default function VisitProofsPage() {
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["visit-proofs"],
    queryFn: async () => (await api.get("/visit")).data,
  });
  const safeVisits = useMemo(() => (Array.isArray(visits) ? visits : []), [visits]);
  const [selectedId, setSelectedId] = useState("");
  const selectedVisit = useMemo(
    () => safeVisits.find((visit) => String(visit._id) === String(selectedId)) || safeVisits[0] || null,
    [safeVisits, selectedId]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Visit Proofs</h1>
        <p className="page-subtitle">Verified technician check-ins with GPS proof.</p>
      </div>

      {isLoading ? <div className="premium-card p-4 text-sm text-slate-500">Loading visit proofs...</div> : null}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="premium-card p-3 space-y-2 lg:col-span-2 max-h-[520px] overflow-auto">
          {safeVisits.map((visit) => {
            const active = String(selectedVisit?._id) === String(visit._id);
            const onSite = visit.status === "ON_SITE";
            return (
              <button
                type="button"
                key={visit._id}
                onClick={() => setSelectedId(String(visit._id))}
                className={`w-full text-left rounded-lg border p-3 ${active ? "border-slate-400 bg-slate-50" : "border-slate-200"}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm text-slate-800">Project: {visit.projectId}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${onSite ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {visit.status || "OUTSIDE"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{new Date(visit.time).toLocaleString()}</p>
                <p className="text-xs text-slate-500">Distance: {Number(visit.distance || 0).toFixed(2)} m</p>
              </button>
            );
          })}
        </div>

        <div className="premium-card p-3 lg:col-span-3">
          {selectedVisit ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 items-center">
                <span className="text-sm text-slate-600">Time: {new Date(selectedVisit.time).toLocaleString()}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    selectedVisit.status === "ON_SITE" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {selectedVisit.status}
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-200">
                <div className="h-[380px]">
                  <MapContainer center={[selectedVisit.latitude, selectedVisit.longitude]} zoom={15} className="h-full w-full">
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[selectedVisit.latitude, selectedVisit.longitude]}>
                      <Popup>
                        {selectedVisit.status} at {new Date(selectedVisit.time).toLocaleTimeString()}
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No visit proofs found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
