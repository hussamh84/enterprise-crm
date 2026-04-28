import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";

const __filename = import.meta.url;
console.log("CHECK PAGE:", __filename);

const PROJECT_TYPE_CHOICES = [
  { value: "CCTV", label: "CCTV" },
  { value: "NETWORKING", label: "Networking" },
  { value: "SOLAR", label: "Solar" },
  { value: "SECURITY", label: "Security" },
  { value: "IT", label: "IT Infrastructure" },
];

export default function CreateProjectPage() {
  const [searchParams] = useSearchParams();
  const presetClientId = searchParams.get("clientId") || "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(presetClientId);
  const [projectType, setProjectType] = useState("NETWORKING");
  const [cctvType, setCctvType] = useState("");

  const projectTypeApi = useMemo(
    () => {
      if (projectType === "CCTV") {
        return cctvType === "Analog" ? "CCTV_ANALOG" : "CCTV_IP";
      }
      if (projectType === "SOLAR") return "SOLAR";
      return "NETWORK";
    },
    [projectType, cctvType]
  );

  const createProject = useMutation({
    mutationFn: async () =>
      (
        await api.post("/projects", {
          name: name.trim(),
          clientId,
          projectType: projectTypeApi,
          cctvType: projectType === "CCTV" ? cctvType : "",
        })
      ).data,
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ["/projects"] });
      if (project?._id) {
        navigate(`/quotations/new?clientId=${encodeURIComponent(clientId)}&projectId=${encodeURIComponent(project._id)}`, {
          replace: true,
        });
      }
    },
  });

  const lockedClient = Boolean(presetClientId);

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["/clients", "create-project"],
    queryFn: async () => (await api.get("/clients")).data,
  });

  const selectedClientName = useMemo(() => {
    if (!clientId) return "";
    const c = clients.find((x) => String(x._id) === String(clientId));
    return c?.name || "";
  }, [clients, clientId]);

  const canSubmit = useMemo(() => {
    if (!name.trim() || !clientId) return false;
    if (projectType === "CCTV" && !cctvType) return false;
    return true;
  }, [name, clientId, projectType, cctvType]);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0a2540]">New project</h1>
          <p className="text-gray-500 text-xs mt-1">Create a project and continue to quoting.</p>
        </div>
        <Link to={presetClientId ? `/clients/${presetClientId}` : "/projects"} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-[#425466] hover:bg-slate-50 transition">
          Cancel
        </Link>
      </div>

      <form
        className="premium-card p-4 max-w-lg space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          createProject.mutate();
        }}
      >
        <div>
          <label htmlFor="proj-name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Name
          </label>
          <input
            id="proj-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-[#0a2540] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#635bff]/25 focus:border-[#635bff]"
            placeholder="Project name"
            required
          />
        </div>

        <div>
          <label htmlFor="proj-client" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Client
          </label>
          {clientsLoading ? (
            <div className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-[#6b7c93]">Loading clients…</div>
          ) : (
            <select
              id="proj-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={lockedClient}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-[#0a2540] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#635bff]/25 focus:border-[#635bff] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-[#0a2540]"
              required
            >
              {!lockedClient ? <option value="">Select client</option> : null}
              {lockedClient && clientId && !clients.some((c) => String(c._id) === String(clientId)) ? (
                <option value={clientId}>{selectedClientName || "Selected client"}</option>
              ) : null}
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {lockedClient ? <p className="text-xs text-[#6b7c93] mt-1.5">Client was chosen from the client page. Change it from there or cancel and open this form without a preset.</p> : null}
        </div>

        <div>
          <label htmlFor="proj-type" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Project Type
          </label>
          <select
            id="proj-type"
            value={projectType}
            onChange={(e) => {
              const selected = e.target.value;
              setProjectType(selected);
              if (selected !== "CCTV") setCctvType("");
            }}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-[#0a2540] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#635bff]/25 focus:border-[#635bff]"
          >
            {PROJECT_TYPE_CHOICES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {projectType === "CCTV" ? (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              CCTV Type
            </label>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setCctvType("Analog")}
                className={`h-8 px-3 text-sm rounded-md border ${
                  cctvType === "Analog"
                    ? "bg-black text-white border-black"
                    : "border-slate-300 text-[#425466] bg-white hover:bg-slate-50"
                }`}
              >
                Analog
              </button>
              <button
                type="button"
                onClick={() => setCctvType("IP")}
                className={`h-8 px-3 text-sm rounded-md border ${
                  cctvType === "IP"
                    ? "bg-black text-white border-black"
                    : "border-slate-300 text-[#425466] bg-white hover:bg-slate-50"
                }`}
              >
                IP
              </button>
            </div>
          </div>
        ) : null}

        {createProject.isError ? <p className="text-xs text-rose-600">Could not create project.</p> : null}

        <button
          type="submit"
          disabled={createProject.isPending || !canSubmit || clientsLoading}
          className="btn-primary btn-black rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none"
        >
          {createProject.isPending ? "Saving…" : "Create project & continue to quotation"}
        </button>
      </form>
    </div>
  );
}
