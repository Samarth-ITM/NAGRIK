"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { DEMO_SPOTS, type DemoSpot } from "@/lib/demo/demo-issues";
import { StatusBadge } from "@/components/shared/status-badge";
import { MapPin, Search, Filter, AlertTriangle, Users, Layers, ExternalLink, Radio, Copy, Check } from "lucide-react";

// Dynamic import for Leaflet map component with ssr disabled
const DynamicMapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[380px] flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl p-6 text-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
      <span className="text-xs font-medium">Loading Kharghar City Map Tiles...</span>
      <span className="text-xs text-slate-400 mt-1">OpenStreetMap &middot; 6 km Kharghar City Geofence</span>
    </div>
  ),
});

export function IssueMapSection() {
  const [spots, setSpots] = useState<DemoSpot[]>(DEMO_SPOTS);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [selectedSpotId, setSelectedSpotId] = useState<string>(DEMO_SPOTS[0].id);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [ngoPartner, setNgoPartner] = useState<{ name: string; logoUrl?: string } | null>(null);

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  useEffect(() => {
    fetch("/api/ngo/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.profile) {
          setNgoPartner(data.profile);
        }
      })
      .catch(() => {});

    fetch("/api/public/issues")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.spots && data.spots.length > 0) {
          const mapped: DemoSpot[] = data.spots.map((s: any) => ({
            id: s.id,
            spot_code: s.spot_code,
            title: s.title || `${s.category_name} Issue`,
            group_id: s.group_id || "roads_mobility",
            category_id: s.category_id,
            issue_type_id: s.issue_type_id || "other",
            category_name: s.category_name,
            group_name: s.group_name || "Civic Infrastructure",
            canonical_latitude: s.canonical_latitude || s.latitude,
            canonical_longitude: s.canonical_longitude || s.longitude,
            status: s.status,
            severity_label: s.severity_label || "medium",
            report_count: s.report_count || 1,
            location_name: s.location_name || "Sector 4, Kharghar",
            public_summary: s.public_summary || s.title || "Civic Defect",
            created_at: s.created_at,
            updated_at: s.updated_at,
            resolved_at: s.resolved_at,
            is_demo: s.is_demo ?? false,
          }));
          setSpots(mapped);
          if (data.source === "database") {
            setIsLive(true);
            setSelectedSpotId(mapped[0].id);
          }
        }
      })
      .catch((err) => console.log("[Public issues fetch fallback]", err));
  }, []);

  const filteredSpots = useMemo(() => {
    return spots.filter((spot) => {
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
  }, [spots, statusFilter, searchQuery]);

  const selectedSpot = useMemo(() => {
    return spots.find((s) => s.id === selectedSpotId) || spots[0] || DEMO_SPOTS[0];
  }, [spots, selectedSpotId]);

  return (
    <section id="issues" className="py-16 md:py-24 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            {isLive ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-2 border border-emerald-300 dark:border-emerald-800">
                <Radio className="w-3.5 h-3.5 text-emerald-600 " />
                <span>LIVE CIVIC DATA &middot; 25-50M PRIVACY DISCRETIZATION</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-xs font-semibold mb-2 border border-amber-300 dark:border-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Sample data for illustration</span>
              </div>
            )}
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Every reported issue, on the map
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Locations are rounded to protect reporters&apos; privacy. Filter by status to see what is open and what has been fixed.
            </p>
          </div>

          <div className="text-xs text-slate-500 shrink-0">
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredSpots.length}</strong> of {spots.length} issues
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs font-medium pb-1 sm:pb-0">
            {[
              { id: "ALL", label: `All (${spots.length})` },
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
              <span className="text-xs text-slate-400">
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

            <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
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
              <div className="p-5 rounded-2xl border-2 border-brand-500/40 bg-brand-50/30 dark:bg-brand-950/20 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(selectedSpot.spot_code)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 hover:border-brand-500 transition focus:outline-none focus:ring-2 focus:ring-brand-500"
                      title="Click to copy reference code"
                    >
                      {copiedCode === selectedSpot.spot_code ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{selectedSpot.spot_code}</span>
                      {copiedCode === selectedSpot.spot_code && (
                        <span className="text-xs text-emerald-600 font-sans font-semibold">Copied!</span>
                      )}
                    </button>
                    {selectedSpot.is_demo && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        Sample Data
                      </span>
                    )}
                  </div>
                  <StatusBadge status={selectedSpot.status} />
                </div>

                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                  {selectedSpot.title}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {selectedSpot.public_summary}
                </p>

                {/* Handed off to Official Portal Link */}
                {selectedSpot.status === "HANDED_OFF" && (
                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between font-bold text-purple-900 dark:text-purple-200">
                      <span>Official Municipal Escalation</span>
                      <span className="text-xs bg-purple-200 dark:bg-purple-800 px-2 py-0.5 rounded">CIDCO / PMC</span>
                    </div>
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      This issue was officially transmitted to the competent municipal authority with recorded dispatch proof.
                    </p>
                    <a
                      href="https://cidco.maharashtra.gov.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-800 dark:text-purple-300 hover:underline pt-0.5"
                    >
                      <span>Open Official Portal</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {(selectedSpot.status === "RESOLUTION_SUBMITTED" ||
                  selectedSpot.status === "RESOLVED" ||
                  selectedSpot.resolution_note) && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {ngoPartner?.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ngoPartner.logoUrl}
                            alt={ngoPartner.name}
                            className="w-5 h-5 rounded-md object-cover border border-emerald-500/40"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-md bg-brand-500 text-white flex items-center justify-center font-bold text-xs">
                            
                          </div>
                        )}
                        <div>
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block ">
                            Verified Defect Repair
                          </span>
                          <span className="font-extrabold text-emerald-900 dark:text-emerald-100">
                            Repaired &amp; Verified by {ngoPartner?.name || "Kharghar Citizens Welfare Forum"}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 px-2 py-0.5 rounded font-bold">
                        FIXED
                      </span>
                    </div>
                    {selectedSpot.resolution_note && (
                      <p className="text-xs text-emerald-800 dark:text-emerald-300 italic pt-0.5">
                        &ldquo;{selectedSpot.resolution_note}&rdquo;
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-brand-200/50 dark:border-brand-800/50 flex items-center justify-between text-xs text-slate-500">
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
                      <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                        {spot.spot_code}
                      </span>
                      <StatusBadge status={spot.status} />
                    </div>

                    <div className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-1">
                      {spot.title}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 w-full pt-1">
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
