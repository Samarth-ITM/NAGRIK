"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { DemoSpot } from "@/lib/demo/demo-issues";

interface MapViewProps {
  spots: DemoSpot[];
  selectedSpotId?: string;
  onSelectSpot?: (spotId: string) => void;
}

export default function MapView({ spots, selectedSpotId, onSelectSpot }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.CircleMarker }>({});

  const PILOT_ANCHOR_LAT = 19.0475;
  const PILOT_ANCHOR_LON = 73.0699;
  const PILOT_RADIUS_METRES = 500;

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      center: [PILOT_ANCHOR_LAT, PILOT_ANCHOR_LON],
      zoom: 16,
      minZoom: 14,
      maxZoom: 18,
      scrollWheelZoom: false,
    });

    // OpenStreetMap standard tile layer
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Pilot 500m Reference Radius Circle (Explicitly approximate reference circle per TRD 4.1 & Audit Item 12)
    const geofenceCircle = L.circle([PILOT_ANCHOR_LAT, PILOT_ANCHOR_LON], {
      radius: PILOT_RADIUS_METRES,
      color: "#2563eb",
      weight: 2,
      dashArray: "6, 6",
      fillColor: "#3b82f6",
      fillOpacity: 0.08,
    }).addTo(map);

    geofenceCircle.bindTooltip(
      "Illustrative 500m Reference Radius (Approximate pilot perimeter around ITM entrance; not an officially surveyed municipal boundary)",
      { permanent: false, direction: "top" }
    );

    geofenceCircle.bindPopup(`
      <div style="font-family: inherit; font-size: 11px; line-height: 1.4; max-width: 200px;">
        <strong style="color: #1e40af;">Illustrative Reference Perimeter</strong><br/>
        500m straight-line radius from ITM public entrance.<br/>
        <span style="color: #64748b; font-size: 10px;">Demonstration boundary; not an officially surveyed municipal ward boundary.</span>
      </div>
    `);

    // Pilot Center Anchor Marker
    const anchorMarker = L.circleMarker([PILOT_ANCHOR_LAT, PILOT_ANCHOR_LON], {
      radius: 7,
      fillColor: "#1d4ed8",
      color: "#ffffff",
      weight: 2,
      opacity: 1,
      fillOpacity: 1,
    }).addTo(map);

    anchorMarker.bindPopup(`
      <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
        <strong style="color: #1e3a8a;">Pilot Reference Anchor</strong><br/>
        ITM Skills University Public Entrance<br/>
        Sector 4, Kharghar (Immutable Benchmark)
      </div>
    `);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update spot markers whenever spots change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    spots.forEach((spot) => {
      // Color-code by spot status
      let markerColor = "#64748b";
      if (spot.status === "RESOLVED") markerColor = "#10b981";
      else if (spot.status === "IN_PROGRESS") markerColor = "#8b5cf6";
      else if (spot.status === "RESOLUTION_SUBMITTED") markerColor = "#f97316";
      else if (spot.status === "VERIFIED") markerColor = "#3b82f6";
      else if (spot.status === "UNDER_REVIEW") markerColor = "#f59e0b";

      const marker = L.circleMarker([spot.canonical_latitude, spot.canonical_longitude], {
        radius: spot.id === selectedSpotId ? 9 : 6,
        fillColor: markerColor,
        color: spot.id === selectedSpotId ? "#0f172a" : "#ffffff",
        weight: spot.id === selectedSpotId ? 3 : 1.5,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(map);

      const popupHtml = `
        <div style="font-family: inherit; font-size: 12px; max-width: 220px; line-height: 1.4;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: 700; color: #0f172a;">${spot.spot_code}</span>
            <span style="font-size: 10px; padding: 1px 5px; border-radius: 4px; background: #f1f5f9; font-weight: 600;">${spot.status.replace(/_/g, " ")}</span>
          </div>
          <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${spot.title}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">${spot.category_name}</div>
          <div style="font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 4px;">
            ${spot.report_count} citizen report${spot.report_count > 1 ? "s" : ""} &middot; Sample Data
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on("click", () => {
        if (onSelectSpot) onSelectSpot(spot.id);
      });

      markersRef.current[spot.id] = marker;
    });
  }, [spots, selectedSpotId, onSelectSpot]);

  // Center on selected spot
  useEffect(() => {
    if (!selectedSpotId || !mapInstanceRef.current) return;
    const target = spots.find((s) => s.id === selectedSpotId);
    if (target) {
      mapInstanceRef.current.panTo([target.canonical_latitude, target.canonical_longitude], {
        animate: true,
        duration: 0.5,
      });
      const marker = markersRef.current[selectedSpotId];
      if (marker && !marker.isPopupOpen()) {
        marker.openPopup();
      }
    }
  }, [selectedSpotId, spots]);

  return <div ref={mapContainerRef} className="w-full h-full min-h-[380px] z-10" />;
}
