"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getAuthHeaders } from "@/lib/client-auth";

type ApprovalRequest = {
  id: string;
  requestNo: string;
  project: string;
  applicant: string;
  material: string;
  quantity: string;
  purpose: string;
  expected: string;
  status: "PENDING_APPROVAL" | "REJECTED" | "APPROVED" | "ORDERED" | "PARTIAL_RECEIVED" | "COMPLETED";
  statusText: string;
  rejectedReason?: string | null;
};

export function ApprovalClient() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("全部状态");
  const [keyword, setKeyword] = useState("");

  async function loadRequests() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/approvals", { headers: await getAuthHeaders(), cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "审批列表加载失败。");
      setLoading(false);
      return;
    }
    setRequests(payload.requests);
    setLoading(false);
  }

  async function submitApproval(id: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("请输入拒绝原因", "库存或规格需重新确认") : undefined;
    if (action === "reject" && reason === null) return;

    setActingId(id);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ id, action, reason })
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error || "审批失败。");
      setActingId(null);
      return;
    }

    setMessage(payload.message || "审批成功。");
    await loadRequests();
    setActingId(null);
  }

  useEffect(() => {
    // The approval list must be fetched once when this client view mounts.
    void loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesStatus = statusFilter === "全部状态" || request.statusText === statusFilter;
      const haystack = [request.requestNo, request.project, request.applicant, request.material, request.purpose]
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!normalizedKeyword || haystack.includes(normalizedKeyword));
    });
  }, [keyword, requests, statusFilter]);

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            className="field md:col-span-2"
            placeholder="搜索申请单、工程、材料"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option>全部状态</option>
            <option>待审批</option>
            <option>已审批</option>
            <option>已拒绝</option>
          </select>
          <button className="btn-primary" onClick={() => void loadRequests()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
            刷新
          </button>
        </div>
      </div>

      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead className="bg-field">
            <tr>
              {["申请单", "工程", "申请人", "材料", "数量", "用途", "期望到货", "状态", "操作"].map((column) => (
                <th key={column} className="px-4 py-3 text-sm font-black text-ink">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-ink/60">
                  正在加载审批列表...
                </td>
              </tr>
            ) : null}
            {!loading && filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-ink/60">
                  暂无采购申请。
                </td>
              </tr>
            ) : null}
            {filteredRequests.map((request) => {
              const disabled = actingId === request.id || request.status !== "PENDING_APPROVAL";
              return (
                <tr key={request.id} className="hover:bg-field/55">
                  <td className="px-4 py-3 text-sm font-semibold text-ink">{request.requestNo}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{request.project}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{request.applicant}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{request.material}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{request.quantity}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{request.purpose}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{request.expected}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">
                    <StatusBadge status={request.statusText} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        className="btn-primary min-h-10 px-3 disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={disabled}
                        onClick={() => void submitApproval(request.id, "approve")}
                      >
                        {actingId === request.id ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                        同意
                      </button>
                      <button
                        className="btn-secondary min-h-10 px-3 disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={disabled}
                        onClick={() => void submitApproval(request.id, "reject")}
                      >
                        <X size={16} />
                        拒绝
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
