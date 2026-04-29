import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import api from "../lib/api";

export default function SiteVisitPage() {
  const [params] = useSearchParams();
  const taskId = params.get("taskId") || "";
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    report: "",
    images: [],
    checkInTime: "",
    gps: "",
  });

  const imageNames = useMemo(() => form.images.map((file) => file.name).join(", "), [form.images]);

  const submitVisit = useMutation({
    mutationFn: async () => {
      const payload = {
        report: `${form.report}\nCheck-in: ${form.checkInTime}\nGPS: ${form.gps}\nTask: ${taskId}`,
        images: form.images.map((file) => file.name),
        visitDate: form.checkInTime || new Date().toISOString(),
        assignedTechnician: "current_user",
      };
      await api.post("/site-visits", payload);
      await api.post("/notifications/technician-complete", { taskId, ...payload }).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician-tasks"] });
      setForm({ report: "", images: [], checkInTime: "", gps: "" });
    },
  });

  const captureGeo = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setForm((prev) => ({ ...prev, gps: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` }));
      },
      () => {}
    );
  };

  const checkInNow = () => {
    const now = new Date().toISOString();
    setForm((prev) => ({ ...prev, checkInTime: now }));
    captureGeo();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Site Visit</h1>
        <p className="page-subtitle">Check in, upload notes/photos, and submit completion.</p>
      </div>

      <div className="premium-card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary btn-compact" onClick={checkInNow}>
            Check-in
          </button>
          <button type="button" className="btn-secondary btn-compact" onClick={captureGeo}>
            Refresh GPS
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={form.checkInTime} readOnly placeholder="Check-in time" />
          <input value={form.gps} readOnly placeholder="GPS coordinates" />
        </div>

        <textarea
          value={form.report}
          onChange={(event) => setForm((prev) => ({ ...prev, report: event.target.value }))}
          placeholder="Visit notes"
        />

        <div>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(event) => setForm((prev) => ({ ...prev, images: Array.from(event.target.files || []) }))}
          />
          {imageNames ? <p className="text-xs text-slate-500 mt-1 truncate">{imageNames}</p> : null}
        </div>

        <button
          type="button"
          className="btn-primary"
          disabled={submitVisit.isPending || !form.checkInTime || !form.gps}
          onClick={() => submitVisit.mutate()}
        >
          {submitVisit.isPending ? "Submitting..." : "Submit Visit"}
        </button>
      </div>
    </div>
  );
}
