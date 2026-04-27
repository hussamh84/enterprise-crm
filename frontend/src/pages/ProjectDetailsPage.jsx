import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";

const __filename = import.meta.url;
console.log("CHECK PAGE:", __filename);

const dateValue = (value) => (value ? new Date(value).toLocaleDateString() : "-");

export default function ProjectDetailsPage() {
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", date: "" });
  const [editingExpenseId, setEditingExpenseId] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["project-details", projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/details`)).data,
    enabled: Boolean(projectId),
  });

  const project = data?.project;
  const client = data?.client;
  const primaryContact = client?.contacts?.[0];
  const quotations = data?.quotations ?? [];
  const expenses = data?.expenses ?? [];
  const quotationSummary = data?.quotationSummary;
  const profitability = data?.profitability;
  const progress = data?.progress ?? Number(project?.progress || 0);

  const progressClamped = useMemo(() => Math.max(0, Math.min(100, Number(progress || 0))), [progress]);
  const totalRevenue = Number(profitability?.totalRevenue ?? quotationSummary?.totalQuoted ?? 0);
  const totalExpenses = Number(profitability?.totalExpenses ?? 0);
  const netProfit = Number(profitability?.calculatedProfit ?? totalRevenue - totalExpenses);

  const expenseMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        projectId,
        description: expenseForm.description.trim(),
        amount: Number(expenseForm.amount || 0),
        date: expenseForm.date || new Date().toISOString(),
      };
      if (editingExpenseId) {
        return api.put(`/expenses/${editingExpenseId}`, payload);
      }
      return api.post("/expenses", payload);
    },
    onSuccess: () => {
      setExpenseForm({ description: "", amount: "", date: "" });
      setEditingExpenseId("");
      queryClient.invalidateQueries({ queryKey: ["project-details", projectId] });
      queryClient.invalidateQueries({ queryKey: ["monthly-report"] });
      queryClient.invalidateQueries({ queryKey: ["yearly-report"] });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId) => api.delete(`/expenses/${expenseId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-details", projectId] });
      queryClient.invalidateQueries({ queryKey: ["monthly-report"] });
      queryClient.invalidateQueries({ queryKey: ["yearly-report"] });
    },
  });

  if (!projectId) return null;

  if (isLoading) {
    return <div className="premium-card p-8 text-center text-slate-500">Loading project details...</div>;
  }

  if (isError || !project) {
    return <div className="premium-card p-8 text-center text-rose-600">Unable to load project details.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">{project.name}</h1>
          <p className="text-[#6b7c93] mt-1">Project-level financial and delivery visibility.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/quotations/new?clientId=${encodeURIComponent(client?._id || project.clientId || "")}&projectId=${encodeURIComponent(project._id)}`}
            className="rounded-lg bg-[#635bff] text-white px-3 py-2 text-sm font-medium hover:bg-[#5849ff]"
          >
            Create Quotation
          </Link>
          <Link to="/projects" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#425466] hover:bg-slate-50">
            Back to Projects
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm border ${activeTab === "overview" ? "bg-[#eef4ff] border-[#d6e4ff] text-[#1f3d7a]" : "border-slate-200 text-[#425466] hover:bg-slate-50"}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm border ${activeTab === "expenses" ? "bg-[#eef4ff] border-[#d6e4ff] text-[#1f3d7a]" : "border-slate-200 text-[#425466] hover:bg-slate-50"}`}
          onClick={() => setActiveTab("expenses")}
        >
          Expenses
        </button>
      </div>

      {activeTab === "overview" && (
        <>
          <div className="premium-card p-5">
            <h2 className="font-semibold text-[#0a2540] mb-4">Project Overview</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <Field label="Project Name" value={project.name} />
              <Field label="Project Type" value={project.projectType || "-"} />
              <Field
                label="Client Name"
                value={
                  client ? (
                    <Link to={`/clients/${client._id}`} className="text-[#635bff] hover:underline">
                      {client.name}
                    </Link>
                  ) : (
                    "-"
                  )
                }
              />
              <Field
                label="Status"
                value={
                  project.status === "completed" ? (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                      Completed
                    </span>
                  ) : (
                    project.status || "-"
                  )
                }
              />
              <Field label="Budget" value={<span className="currency numeric">{formatCurrency(project.budget)}</span>} />
              <Field label="Total Revenue" value={<span className="currency numeric">{formatCurrency(totalRevenue)}</span>} />
              <Field label="Total Expenses" value={<span className="currency numeric">{formatCurrency(totalExpenses)}</span>} />
              <Field
                label="Net Profit"
                value={
                  <span className={`currency numeric ${netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(netProfit)}</span>
                }
              />
              <Field label="Start Date" value={dateValue(project.startDate)} />
              <Field label="End Date" value={dateValue(project.endDate)} />
            </div>
          </div>

          <div className="premium-card p-5">
            <h2 className="font-semibold text-[#0a2540] mb-4">Client Details</h2>
            {client ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <Field label="Client Name" value={client.name} />
                <Field label="Client Status" value={client.status || "-"} />
                <Field label="Primary Contact" value={primaryContact?.name || "-"} />
                <Field label="Primary Email" value={primaryContact?.email || "-"} />
              </div>
            ) : (
              <p className="text-sm text-rose-600">Client details not found for this project.</p>
            )}
          </div>
        </>
      )}

      {activeTab === "expenses" && (
        <div className="space-y-4">
          <div className="premium-card p-5">
            <h2 className="font-semibold text-[#0a2540] mb-4">Project Expenses</h2>
            <form
              className="grid md:grid-cols-4 gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!expenseForm.description.trim() || !expenseForm.amount) return;
                expenseMutation.mutate();
              }}
            >
              <input
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[#d6e4ff] md:col-span-2"
                placeholder="Expense description"
                value={expenseForm.description}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[#d6e4ff]"
                placeholder="Amount"
                value={expenseForm.amount}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
              <input
                type="date"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[#d6e4ff]"
                value={expenseForm.date}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, date: event.target.value }))}
              />
              <div className="md:col-span-4 flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#635bff] text-white px-4 py-2 text-sm font-medium hover:bg-[#5849ff] disabled:opacity-60"
                  disabled={expenseMutation.isPending}
                >
                  {editingExpenseId ? "Update Expense" : "Add Expense"}
                </button>
                {editingExpenseId && (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-[#425466] hover:bg-slate-50"
                    onClick={() => {
                      setEditingExpenseId("");
                      setExpenseForm({ description: "", amount: "", date: "" });
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="premium-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#0a2540]">Expenses List</h3>
              <span className="text-sm text-[#6b7c93]">
                Total expenses: <span className="currency numeric inline-block">{formatCurrency(totalExpenses)}</span>
              </span>
            </div>
            {expenses.length === 0 ? (
              <p className="text-sm text-[#6b7c93]">No expenses recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {expenses.map((expense) => (
                  <div key={expense._id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[#0a2540]">{expense.description}</p>
                      <p className="text-xs text-[#6b7c93] mt-1">{dateValue(expense.date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-[#0a2540]">
                        <span className="currency numeric">{formatCurrency(expense.amount)}</span>
                      </p>
                      <button
                        type="button"
                        className="text-[#635bff] font-medium hover:underline"
                        onClick={() => {
                          setEditingExpenseId(expense._id);
                          setExpenseForm({
                            description: expense.description || "",
                            amount: String(expense.amount ?? ""),
                            date: expense.date ? new Date(expense.date).toISOString().slice(0, 10) : "",
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-rose-600 font-medium hover:underline disabled:opacity-60"
                        disabled={deleteExpenseMutation.isPending}
                        onClick={() => deleteExpenseMutation.mutate(expense._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="premium-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#0a2540]">Related Quotations</h2>
            <span className="text-xs text-[#6b7c93]">{quotations.length} total</span>
          </div>
          {quotations.length === 0 ? (
            <p className="text-sm text-[#6b7c93]">No quotations linked to this project yet.</p>
          ) : (
            <div className="space-y-2">
              {quotations.map((quotation) => (
                <div key={quotation._id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm flex items-center justify-between">
                  <div>
                    <Link to={`/quotations/${quotation._id}`} className="font-medium text-[#635bff] hover:underline">
                      {quotation.quotationNo || quotation.name || "Quotation"}
                    </Link>
                    <p className="text-xs text-[#6b7c93] mt-1">{new Date(quotation.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#0a2540]">
                      <span className="currency numeric">{formatCurrency(quotation.grandTotal ?? quotation.subtotal)}</span>
                    </p>
                    <p className="text-xs text-[#6b7c93]">{quotation.status || "draft"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="premium-card p-5">
            <h2 className="font-semibold text-[#0a2540] mb-4">Quotation Summary</h2>
            <div className="space-y-2 text-sm">
              <SummaryRow label="Total Revenue" value={<span className="currency numeric">{formatCurrency(totalRevenue)}</span>} />
              <SummaryRow label="Total Expenses" value={<span className="currency numeric">{formatCurrency(totalExpenses)}</span>} />
              <SummaryRow
                label="Net Profit"
                value={<span className={`currency numeric ${netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(netProfit)}</span>}
              />
              <SummaryRow label="Total Quoted" value={<span className="currency numeric">{formatCurrency(quotationSummary?.totalQuoted)}</span>} />
              <SummaryRow label="Quotation Count" value={<span className="numeric">{String(quotationSummary?.quotationCount || 0)}</span>} />
            </div>
          </div>

          <div className="premium-card p-5">
            <h2 className="font-semibold text-[#0a2540] mb-4">Project Progress</h2>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[#6b7c93]">Completion</span>
              <span className="font-semibold text-[#0a2540] numeric">{progressClamped}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-[#635bff]" style={{ width: `${progressClamped}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <p className="text-xs text-[#6b7c93] uppercase tracking-[0.08em]">{label}</p>
      <p className="text-sm font-medium text-[#0a2540] mt-1">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, valueClassName = "" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#6b7c93]">{label}</span>
      <span className={`font-medium text-[#0a2540] ${valueClassName}`}>{value}</span>
    </div>
  );
}
