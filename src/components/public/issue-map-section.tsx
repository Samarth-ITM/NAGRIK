"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { DEMO_SPOTS, type DemoSpot } from "@/lib/demo/demo-issues";
import { StatusBadge } from "@/components/shared/status-badge";
import { MapPin, Search, Filter, AlertTriangle, Users, Layers, ExternalLink } from "lucide-react";

// Dynamic import for Leaflet map component with ssr disabled
const DynamicMapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[380px] flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl p-6 text-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
      <span className="text-xs font-medium">Loading Kharghar Sector 4 Map Tiles...</span>
      <span className="text-[11px] text-slate-400 mt-1">OpenStreetMap &middot; 500m ITM Geofence</span>
    </div>
  ),
});

export function IssueMapSection() {
  const [selectedSpotId, setSelectedSpotId] = useState<string>(DEMO_SPOTS[0].id);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredSpots = useMemo(() => {
    return DEMO_SPOTS.filter((spot) => {
      // Status filter
      if (statusFilter === "IN_PROGRESS" && spot.status !== "IN_PROGRESS") return false;
      if (statusFilter === "RESOLVED" && spot.status !== "RESOLVED") return false;
      if (
        statusFilter === "PENDING" &&
        spot.status !== "NEW" &&
        spot.status !== "UNDER_REVIEW" &&
        spot.status !== "VERIFIED" &&
        spot.status !== "ASSIGNED" &&
        spot.status !== "RESOLUTION_SUBMITTED"
      ) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          spot.title.toLowerCase().includes(query) ||
          spot.spot_code.toLowerCase().includes(query) ||
          spot.category_name.toLowerCase().includes(query) ||
          spot.location_name.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [statusFilter, searchQuery]);

  const selectedSpot = useMemo(() => {
    return DEMO_SPOTS.find((s) => s.id === selectedSpotId) || DEMO_SPOTS[0];
  }, [selectedSpotId]);

  return (
    <section id="issues" className="py-16 md:py-24 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[11px] font-semibold mb-2 border border-amber-300 dark:border-amber-800">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>ILLUSTRATIVE EXPERIENCE — DEMONSTRATION DATA</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Public Issue Transparency Layer
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Sanitised public records showing defect locations, verified status, and collective citizen engagement.
            </p>
          </div>

          <div className="text-xs text-slate-500 shrink-0">
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredSpots.length}</strong> of {DEMO_SPOTS.length} sample issues
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs font-medium pb-1 sm:pb-0">
            {[
              { id: "ALL", label: `All (${DEMO_SPOTS.length})` },
              { id: "IN_PROGRESS", label: "In Progress" },
              { id: "PENDING", label: "Under Review / Assigned" },
              { id: "RESOLVED", label: "Resolved" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  statusFilter === tab.id
                    ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 font-semibold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search category, code, street..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Interactive Map & List Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Map Column (7 Cols) */}
          <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900 flex flex-col">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-600" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Sector 4, Kharghar &middot; 500m ITM Radius
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                Leaflet / OpenStreetMap
              </span>
            </div>

            <div className="h-[380px] sm:h-[440px] w-full relative">
              <DynamicMapView
                spots={filteredSpots}
                selectedSpotId={selectedSpotId}
                onSelectSpot={(id) => setSelectedSpotId(id)}
              />
            </div>

            <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Verified
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> In Progress
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> Verification Req.
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Resolved
                </span>
              </div>
              <span className="text-slate-400">Click marker to inspect details</span>
            </div>
          </div>

          {/* Issue Cards Column (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Selected Spot Detail Header Card */}
            {selectedSpot && (
              <div className="p-5 rounded-2xl border-2 border-brand-500/40 bg-brand-50/30 dark:bg-brand-950/20 shadow-xs">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-brand-700 dark:text-brand-300">
                      {selectedSpot.spot_code}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      Sample Data
                    </span>
                  </div>
                  <StatusBadge status={selectedSpot.status} />
                </div>

                <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                  {selectedSpot.title}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                  {selectedSpot.public_summary}
                </p>

                {selectedSpot.resolution_note && (
                  <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200">
                    <strong>Resolution Note:</strong> {selectedSpot.resolution_note}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-brand-200/50 dark:border-brand-800/50 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                    <Users className="w-3.5 h-3.5 text-brand-600" />
                    {selectedSpot.report_count} citizen report{selectedSpot.report_count > 1 ? "s" : ""} linked
                  </span>
                  <span>{selectedSpot.category_name}</span>
                </div>
              </div>
            )}

            {/* Scrollable list of all matching spots */}
            <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
              {filteredSpots.map((spot) => {
                const isSelected = spot.id === selectedSpotId;
                return (
                  <button
                    key={spot.id}
                    onClick={() => setSelectedSpotId(spot.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition flex flex-col gap-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      isSelected
                        ? "bg-slate-100 dark:bg-slate-800 border-brand-500 shadow-xs"
                        : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                        {spot.spot_code}
                      </span>
                      <StatusBadge status={spot.status} />
                    </div>

                    <div className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-1">
                      {spot.title}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 w-full pt-1">
                      <span className="truncate max-w-[180px]">{spot.location_name}</span>
                      <span className="font-medium text-slate-600 dark:text-slate-300 shrink-0">
                        {spot.report_count} report{spot.report_count > 1 ? "s" : ""}
                      </span>
                    </div>
                  </button>
                );
              })}

              {filteredSpots.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  No demonstration issues match your filter criteria.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
