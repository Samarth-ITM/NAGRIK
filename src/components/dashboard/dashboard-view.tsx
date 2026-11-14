"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import type { SpotStatus } from "@/types";
import {
  createSpotAction,
  linkReportAction,
  transitionSpotStatusAction,
  recordHandoffAction,
  submitResolutionAction,
  reviewResolutionAction,
  createChallengeAction,
} from "@/lib/workflow/actions";

export type SimulatedRole =
  | "super_admin"
  | "authority_water"
  | "authority_roads"
  | "demo_viewer";

export interface DashboardSpot {
  id: string;
  spot_code: string;
  category_id: string;
  category_name: string;
  issue_type_id: string;
  status: SpotStatus;
  severity_label?: string | null;
  canonical_latitude: number;
  canonical_longitude: number;
  assigned_organisation_id?: string | null;
  assigned_organisation_name?: string | null;
  public_approved: boolean;
  is_demo: boolean;
  public_summary?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  reports?: Array<{
    id: string;
    ticket_code: string;
    description: string;
    latitude: number;
    longitude: number;
    match_distance_m?: number;
    created_at: string;
  }>;
  evidence?: Array<{
    id: string;
    evidence_stage: string;
    storage_path: string;
    public_approved: boolean;
  }>;
  status_history?: Array<{
    previous_status: string | null;
    new_status: string;
    actor_type: string;
    note: string;
    created_at: string;
  }>;
  resolution_submission?: {
    id: string;
    completion_note: string;
    work_order_reference?: string;
    after_photo_url: string;
    review_status: string;
    submitted_at: string;
  } | null;
  challenges?: Array<{
    id: string;
    challenge_type: string;
    note: string;
    created_at: string;
  }>;
}

export interface DashboardReport {
  id: string;
  ticket_code: string;
  category_id: string;
  category_name: string;
  description_private: string;
  latitude: number;
  longitude: number;
  created_at: string;
  candidate_spots?: Array<{
    spot_id: string;
    spot_code: string;
    distance_m: number;
    candidate_band: "STRONG_CANDIDATE" | "POSSIBLE_CANDIDATE" | "NOT_A_CANDIDATE";
  }>;
}

interface DashboardViewProps {
  initialSpots: DashboardSpot[];
  initialUnlinkedReports: DashboardReport[];
}

export function DashboardView({ initialSpots, initialUnlinkedReports }: DashboardViewProps) {
  const [role, setRole] = useState<SimulatedRole>("super_admin");
  const [workspace, setWorkspace] = useState<"live" | "demo">("live");
  const [spots, setSpots] = useState<DashboardSpot[]>(initialSpots);
  const [unlinkedReports, setUnlinkedReports] = useState<DashboardReport[]>(initialUnlinkedReports);
  const [selectedSpot, setSelectedSpot] = useState<DashboardSpot | null>(initialSpots[0] || null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form states for modals/drawers
  const [newHandoffDest, setNewHandoffDest] = useState("");
  const [newHandoffMethod, setNewHandoffMethod] = useState("official_email");
  const [newHandoffNote, setNewHandoffNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [challengeNote, setChallengeNote] = useState("");

  const isDemo = workspace === "demo" || role === "demo_viewer";

  // Filter spots by role, workspace, and status
  const filteredSpots = spots.filter((spot) => {
    if (isDemo && !spot.is_demo) return false;
    if (!isDemo && spot.is_demo) return false;

    if (role === "authority_water") {
      if (spot.assigned_organisation_name !== "Water Supply Department") return false;
    } else if (role === "authority_roads") {
      if (spot.assigned_organisation_name !== "Roads & Works Department") return false;
    }

    if (statusFilter !== "ALL" && spot.status !== statusFilter) return false;
    return true;
  });

  // Action handlers calling Server Actions
  const handleTransition = async (spotId: string, newStatus: string, defaultNote: string) => {
    setActionNotice(null);
    if (isDemo) {
      setActionNotice({
        type: "error",
        message: "Forbidden: Demonstration workspace is strictly read-only.",
      });
      return;
    }

    const note = prompt(`Enter progress or review note for transition to ${newStatus}:`, defaultNote) || defaultNote;
    const res = await transitionSpotStatusAction({ spotId, newStatus, note });

    if (res.success) {
      setSpots((prev) =>
        prev.map((s) =>
          s.id === spotId
            ? {
                ...s,
                status: newStatus as SpotStatus,
                updated_at: new Date().toISOString(),
                status_history: [
                  ...(s.status_history || []),
                  {
                    previous_status: s.status,
                    new_status: newStatus,
                    actor_type: role === "super_admin" ? "super_admin" : "authority_user",
                    note,
                    created_at: new Date().toISOString(),
                  },
                ],
              }
            : s
        )
      );
      if (selectedSpot?.id === spotId) {
        setSelectedSpot((curr) => (curr ? { ...curr, status: newStatus as SpotStatus } : null));
      }
      setActionNotice({ type: "success", message: `Status updated to ${newStatus}.` });
    } else {
      setActionNotice({ type: "error", message: res.error });
    }
  };

  const handleCreateSpot = async (reportId: string) => {
    setActionNotice(null);
    if (isDemo) {
      setActionNotice({ type: "error", message: "Forbidden: Cannot create live spot in demo workspace." });
      return;
    }

    const res = await createSpotAction({ reportId, severityLabel: "medium" });
    if (res.success) {
      const data = res.data as { spot_id: string; spot_code: string; status: SpotStatus };
      const report = unlinkedReports.find((r) => r.id === reportId);
      if (report) {
        const newSpot: DashboardSpot = {
          id: data.spot_id,
          spot_code: data.spot_code,
          category_id: report.category_id,
          category_name: report.category_name,
          issue_type_id: "civic_issue",
          status: data.status,
          canonical_latitude: report.latitude,
          canonical_longitude: report.longitude,
          public_approved: false,
          is_demo: false,
          public_summary: report.description_private,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          reports: [
            {
              id: report.id,
              ticket_code: report.ticket_code,
              description: report.description_private,
              latitude: report.latitude,
              longitude: report.longitude,
              match_distance_m: 0,
              created_at: report.created_at,
            },
          ],
        };
        setSpots((prev) => [newSpot, ...prev]);
        setUnlinkedReports((prev) => prev.filter((r) => r.id !== reportId));
        setSelectedSpot(newSpot);
        setActionNotice({ type: "success", message: `New physical spot ${data.spot_code} created.` });
      }
    } else {
      setActionNotice({ type: "error", message: res.error });
    }
  };

  const handleLinkReport = async (reportId: string, targetSpotId: string, distM: number) => {
    setActionNotice(null);
    if (isDemo) {
      setActionNotice({ type: "error", message: "Forbidden: Cannot link in demo workspace." });
      return;
    }

    const res = await linkReportAction({
      reportId,
      spotId: targetSpotId,
      matchDistanceM: distM,
      matchNote: "Manual linking verified by super-admin.",
    });

    if (res.success) {
      setUnlinkedReports((prev) => prev.filter((r) => r.id !== reportId));
      setActionNotice({ type: "success", message: `Report linked to spot successfully.` });
    } else {
      setActionNotice({ type: "error", message: res.error });
    }
  };

  const handleHandoff = async () => {
    if (!selectedSpot) return;
    setActionNotice(null);
    if (!newHandoffDest || !newHandoffNote) {
      setActionNotice({ type: "error", message: "Destination and handoff note are mandatory." });
      return;
    }

    const res = await recordHandoffAction({
      spotId: selectedSpot.id,
      destinationName: newHandoffDest,
      handoffMethod: newHandoffMethod,
      note: newHandoffNote,
    });

    if (res.success) {
      setSpots((prev) =>
        prev.map((s) =>
          s.id === selectedSpot.id
            ? { ...s, status: "HANDED_OFF" as SpotStatus, updated_at: new Date().toISOString() }
            : s
        )
      );
      setSelectedSpot((curr) => (curr ? { ...curr, status: "HANDED_OFF" } : null));
      setNewHandoffDest("");
      setNewHandoffNote("");
      setActionNotice({ type: "success", message: `Authority handoff recorded to ${newHandoffDest}.` });
    } else {
      setActionNotice({ type: "error", message: res.error });
    }
  };

  const handleSubmitResolution = async () => {
    if (!selectedSpot) return;
    setActionNotice(null);
    if (!resolutionNote) {
      setActionNotice({ type: "error", message: "Completion note is mandatory." });
      return;
    }

    const res = await submitResolutionAction({
      spotId: selectedSpot.id,
      completionNote: resolutionNote,
      afterPhotoEvidenceId: selectedSpot.evidence?.[0]?.id || "e1000000-0000-0000-0000-000000000020",
      workOrderReference: "WO-" + Math.floor(1000 + Math.random() * 9000),
    });

    if (res.success) {
      setSpots((prev) =>
        prev.map((s) =>
          s.id === selectedSpot.id
            ? { ...s, status: "RESOLUTION_SUBMITTED" as SpotStatus, updated_at: new Date().toISOString() }
            : s
        )
      );
      setSelectedSpot((curr) => (curr ? { ...curr, status: "RESOLUTION_SUBMITTED" } : null));
      setResolutionNote("");
      setActionNotice({ type: "success", message: "Resolution request submitted with mandatory after-photo." });
    } else {
      setActionNotice({ type: "error", message: res.error });
    }
  };

  const handleReviewResolution = async (decision: "approved" | "rejected") => {
    if (!selectedSpot) return;
    setActionNotice(null);
    if (decision === "rejected" && !reviewNote) {
      setActionNotice({ type: "error", message: "Review note is required when rejecting resolution." });
      return;
    }

    const res = await reviewResolutionAction({
      submissionId: selectedSpot.resolution_submission?.id || "sub-default-id",
      decision,
      reviewNote: reviewNote || (decision === "approved" ? "Approved on visual inspection" : "Rejected"),
    });

    if (res.success) {
      const nextStatus = decision === "approved" ? "RESOLVED" : "IN_PROGRESS";
      setSpots((prev) =>
        prev.map((s) =>
          s.id === selectedSpot.id
            ? {
                ...s,
                status: nextStatus as SpotStatus,
                resolved_at: decision === "approved" ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              }
            : s
        )
      );
      setSelectedSpot((curr) =>
        curr
          ? {
              ...curr,
              status: nextStatus as SpotStatus,
              resolved_at: decision === "approved" ? new Date().toISOString() : null,
            }
          : null
      );
      setReviewNote("");
      setActionNotice({
        type: "success",
        message: decision === "approved" ? "Resolution APPROVED. Spot marked RESOLVED." : "Resolution REJECTED. Returned to IN_PROGRESS.",
      });
    } else {
      setActionNotice({ type: "error", message: res.error });
    }
  };

  const handleCitizenChallenge = async () => {
    if (!selectedSpot) return;
    setActionNotice(null);
    if (!challengeNote) {
      setActionNotice({ type: "error", message: "Challenge note is required." });
      return;
    }

    const res = await createChallengeAction({
      spotId: selectedSpot.id,
      citizenContactId: "f0000000-0000-0000-0000-000000000001",
      challengeType: "still_not_fixed",
      note: challengeNote,
    });

    if (res.success) {
      setChallengeNote("");
      setActionNotice({ type: "success", message: "Citizen challenge ('Still not fixed') recorded for super-admin review." });
    } else {
      setActionNotice({ type: "error", message: res.error });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP CONTROL BAR & SIMULATOR */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Active Role Simulator (Governance & Tenant Scope)
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setRole("super_admin");
                setWorkspace("live");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                role === "super_admin" && workspace === "live"
                  ? "bg-brand-600 text-white font-bold ring-2 ring-brand-400"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Super-Admin (Full Authority)
            </button>
            <button
              onClick={() => {
                setRole("authority_water");
                setWorkspace("live");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                role === "authority_water"
                  ? "bg-blue-600 text-white font-bold ring-2 ring-blue-400"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Water Supply Dept (Assigned Org)
            </button>
            <button
              onClick={() => {
                setRole("authority_roads");
                setWorkspace("live");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                role === "authority_roads"
                  ? "bg-purple-600 text-white font-bold ring-2 ring-purple-400"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Roads & Works (Assigned Org)
            </button>
            <button
              onClick={() => {
                setRole("demo_viewer");
                setWorkspace("demo");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                isDemo
                  ? "bg-amber-600 text-white font-bold ring-2 ring-amber-400"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              CIDCO Demo Viewer (Read-Only)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Workspace:</span>
          <span
            className={`px-2.5 py-1 rounded text-xs font-bold tracking-wide ${
              isDemo
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            }`}
          >
            {isDemo ? "DEMO (SYNTHETIC)" : "LIVE (PRODUCTION PILOT)"}
          </span>
        </div>
      </div>

      {/* 2. DEMO WATERMARK (When viewing demo records) */}
      {isDemo && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-xl p-3 text-center text-amber-800 dark:text-amber-300 font-bold text-xs tracking-wider">
          DEMONSTRATION ENVIRONMENT — SAMPLE DATA — NOT CONNECTED TO CIDCO OR REAL CITIZENS
        </div>
      )}

      {/* 3. ACTION NOTICE ALERT */}
      {actionNotice && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            actionNotice.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <span>{actionNotice.message}</span>
          <button onClick={() => setActionNotice(null)} className="text-xs font-bold px-2">
            &times;
          </button>
        </div>
      )}

      {/* 4. MAIN WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: SPOTS & UNLINKED REPORTS (8 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* UNLINKED CITIZEN REPORTS (SUPER ADMIN ONLY) */}
          {role === "super_admin" && !isDemo && unlinkedReports.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Unlinked Citizen Reports ({unlinkedReports.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verified citizen tickets requiring physical spot anchoring or duplicate candidate review.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-semibold">
                  Intake Queue
                </span>
              </div>

              <div className="space-y-3">
                {unlinkedReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">
                          {report.ticket_code}
                        </span>
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {report.category_name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {report.description_private}
                    </p>

                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleCreateSpot(report.id)}
                        className="text-xs h-7 px-3 bg-brand-600 hover:bg-brand-700 text-white"
                      >
                        Create New Physical Spot
                      </Button>

                      {filteredSpots.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-400">or link to:</span>
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleLinkReport(report.id, e.target.value, 2.5);
                              }
                            }}
                            defaultValue=""
                            className="text-xs h-7 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-slate-700 dark:text-slate-200"
                          >
                            <option value="" disabled>
                              Select existing spot...
                            </option>
                            {filteredSpots
                              .filter((s) => s.category_id === report.category_id)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.spot_code} — {s.category_name} ({s.status})
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SPOTS LIST TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Physical Spots Registry ({filteredSpots.length})
                </h3>
                <p className="text-xs text-slate-500">
                  {role === "super_admin"
                    ? "Complete civic issues registry across Kharghar pilot."
                    : `Issues scoped exclusively to ${
                        role === "authority_water"
                          ? "Water Supply Department"
                          : role === "authority_roads"
                          ? "Roads & Works Department"
                          : "CIDCO Sample Data"
                      }.`}
                </p>
              </div>

              {/* Status filter dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Filter:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="RESOLUTION_SUBMITTED">RESOLUTION_SUBMITTED</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="HANDED_OFF">HANDED_OFF</option>
                  <option value="REOPENED">REOPENED</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Spot Code</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Assignment</th>
                    <th className="py-2.5 px-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSpots.map((spot) => (
                    <tr
                      key={spot.id}
                      onClick={() => setSelectedSpot(spot)}
                      className={`cursor-pointer transition ${
                        selectedSpot?.id === spot.id
                          ? "bg-brand-50/50 dark:bg-brand-950/20 font-medium"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-brand-600 dark:text-brand-400">
                        {spot.spot_code}
                      </td>
                      <td className="py-3 px-3 text-slate-900 dark:text-slate-100">
                        {spot.category_name}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={spot.status} />
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {spot.assigned_organisation_name || (
                          <span className="italic text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                        {new Date(spot.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {filteredSpots.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                        No physical spots match the selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SPOT DETAIL & WORKFLOW ACTIONS (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {selectedSpot ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold font-mono text-slate-900 dark:text-white">
                      {selectedSpot.spot_code}
                    </h2>
                    {selectedSpot.is_demo && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold">
                        DEMO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedSpot.category_name}</p>
                </div>
                <StatusBadge status={selectedSpot.status} />
              </div>

              {/* Coordinates and Assignment Info */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Canonical Anchor
                  </span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {selectedSpot.canonical_latitude.toFixed(4)},{" "}
                    {selectedSpot.canonical_longitude.toFixed(4)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Assigned Authority
                  </span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    {selectedSpot.assigned_organisation_name || "Unassigned"}
                  </span>
                </div>
              </div>

              {/* Public Summary */}
              {selectedSpot.public_summary && (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">
                    Public Transparency Summary
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-100 dark:border-slate-800">
                    {selectedSpot.public_summary}
                  </p>
                </div>
              )}

              {/* WORKFLOW ACTIONS BASED ON ROLE & STATUS */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Permitted Workflow Actions
                </h4>

                {/* SUPER ADMIN WORKFLOW ACTIONS */}
                {role === "super_admin" && !isDemo && (
                  <div className="space-y-2">
                    {selectedSpot.status === "VERIFIED" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleTransition(selectedSpot.id, "ASSIGNED", "Assigned to department")}
                          className="flex-1 text-xs bg-brand-600 hover:bg-brand-700 text-white"
                        >
                          Assign to Department
                        </Button>
                      </div>
                    )}

                    {selectedSpot.status === "ASSIGNED" && (
                      <Button
                        size="sm"
                        onClick={() => handleTransition(selectedSpot.id, "IN_PROGRESS", "Work initiated")}
                        className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Start Progress (In Progress)
                      </Button>
                    )}

                    {/* Handoff Trigger */}
                    {["VERIFIED", "ASSIGNED", "IN_PROGRESS"].includes(selectedSpot.status) && (
                      <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800 space-y-2">
                        <span className="text-xs font-bold text-purple-900 dark:text-purple-300 block">
                          Record Official Handoff
                        </span>
                        <input
                          type="text"
                          placeholder="Destination (e.g. CIDCO Engineering Sub-Division)"
                          value={newHandoffDest}
                          onChange={(e) => setNewHandoffDest(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900"
                        />
                        <textarea
                          placeholder="Handoff details and submission proof reference"
                          value={newHandoffNote}
                          onChange={(e) => setNewHandoffNote(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 h-14"
                        />
                        <Button
                          size="sm"
                          onClick={handleHandoff}
                          className="w-full text-xs bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          Execute Official Handoff
                        </Button>
                      </div>
                    )}

                    {/* Resolution Review (Approve/Reject) */}
                    {selectedSpot.status === "RESOLUTION_SUBMITTED" && (
                      <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800 space-y-2">
                        <span className="text-xs font-bold text-orange-900 dark:text-orange-300 block">
                          Review Authority Repair Submission
                        </span>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          Inspect mandatory after-repair photo evidence. Only super-admin approval can mark an issue RESOLVED.
                        </p>
                        <input
                          type="text"
                          placeholder="Review verification note"
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-orange-200 dark:border-orange-800 bg-white dark:bg-slate-900"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleReviewResolution("approved")}
                            className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          >
                            Approve (Mark RESOLVED)
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleReviewResolution("rejected")}
                            variant="outline"
                            className="flex-1 text-xs text-rose-600 border-rose-300 hover:bg-rose-50"
                          >
                            Reject & Request Proof
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Reopening resolved issue */}
                    {selectedSpot.status === "RESOLVED" && (
                      <Button
                        size="sm"
                        onClick={() => handleTransition(selectedSpot.id, "REOPENED", "Reopened after verification")}
                        variant="outline"
                        className="w-full text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                      >
                        Reopen Issue (Authorized Review)
                      </Button>
                    )}
                  </div>
                )}

                {/* AUTHORITY WORKFLOW ACTIONS */}
                {(role === "authority_water" || role === "authority_roads") && !isDemo && (
                  <div className="space-y-3">
                    {selectedSpot.status === "ASSIGNED" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleTransition(selectedSpot.id, "AUTHORITY_ACKNOWLEDGED", "Authority acknowledged assignment")}
                          className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          Acknowledge Issue
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleTransition(selectedSpot.id, "IN_PROGRESS", "Repair crew mobilized on site")}
                          className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Start Work (In Progress)
                        </Button>
                      </div>
                    )}

                    {selectedSpot.status === "AUTHORITY_ACKNOWLEDGED" && (
                      <Button
                        size="sm"
                        onClick={() => handleTransition(selectedSpot.id, "IN_PROGRESS", "Maintenance team on site")}
                        className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Begin Physical Work
                      </Button>
                    )}

                    {selectedSpot.status === "IN_PROGRESS" && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
                        <span className="text-xs font-bold text-blue-900 dark:text-blue-300 block">
                          Submit Repair Completion (Mandatory After-Photo)
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Authorities cannot resolve issues directly. You must attach an after-repair photo and note for super-admin verification.
                        </p>
                        <textarea
                          placeholder="Detailed repair note (e.g. pipe replaced, pressure tested)"
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 h-16"
                        />
                        <Button
                          size="sm"
                          onClick={handleSubmitResolution}
                          className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Submit Resolution Request
                        </Button>
                      </div>
                    )}

                    {selectedSpot.status === "RESOLUTION_SUBMITTED" && (
                      <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs italic">
                        Resolution submitted. Awaiting super-admin verification. Authorities cannot mark issues resolved.
                      </div>
                    )}
                  </div>
                )}

                {/* DEMO VIEWER RESTRICTION */}
                {isDemo && (
                  <div className="p-3 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs italic text-center">
                    All workflow action buttons are disabled in Demonstration Mode.
                  </div>
                )}
              </div>

              {/* CITIZEN CHALLENGE SIMULATOR (TESTING "STILL NOT FIXED") */}
              {selectedSpot.status === "RESOLVED" && !isDemo && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Citizen Feedback / Challenge
                  </span>
                  <input
                    type="text"
                    placeholder="Citizen report: 'Still leaking around curb...'"
                    value={challengeNote}
                    onChange={(e) => setChallengeNote(e.target.value)}
                    className="w-full text-xs p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCitizenChallenge}
                    className="w-full text-xs text-rose-600 border-rose-300 hover:bg-rose-50"
                  >
                    Simulate Citizen Challenge (&quot;Still not fixed&quot;)
                  </Button>
                </div>
              )}

              {/* STATUS HISTORY TIMELINE */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Audit History & Transitions
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedSpot.status_history && selectedSpot.status_history.length > 0 ? (
                    selectedSpot.status_history.map((h, i) => (
                      <div
                        key={i}
                        className="text-xs p-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-0.5"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>
                            {h.previous_status || "INITIAL"} &rarr; {h.new_status}
                          </span>
                          <span>{new Date(h.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 text-xs">{h.note}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 italic">No previous transitions recorded.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs italic">
              Select a physical spot to view details and available workflow actions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
