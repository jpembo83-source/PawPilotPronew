/**
 * Non-interactive Leaflet preview map.
 *
 * Used inside the PetDetail Whereabouts card so the user sees their dog's
 * trail and last-seen pin without leaving the screen.  Disables every
 * gesture (drag / zoom / scroll / double-click) so the parent tap can pass
 * through and open the full Whereabouts screen.
 *
 * Kept deliberately lightweight — single OSM raster layer, no markers
 * beyond the last-seen pin + trail polyline.  The full map experience
 * lives at /pets/:id/whereabouts.
 */
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MiniMapProps {
  lastSeen: { lat: number; lng: number } | null;
  positions: Array<{ lat: number; lng: number; ts?: string }>;
  /** css height — keep small enough that the parent card stays compact */
  heightPx?: number;
  /** small rounded corners; the parent decides outer radius */
  className?: string;
}

export function MiniMap({ lastSeen, positions, heightPx = 160, className = "" }: MiniMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Stable chronological order so the polyline draws correctly.
  const trail = useMemo(() => {
    if (!positions.length) return [] as Array<{ lat: number; lng: number }>;
    const sorted = [...positions].sort((a, b) =>
      (a.ts && b.ts) ? new Date(a.ts).getTime() - new Date(b.ts).getTime() : 0,
    );
    return sorted;
  }, [positions]);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    if (!lastSeen && trail.length === 0) return;

    // Fully locked down — this is decoration, not a control surface.
    const map = L.map(elRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      preferCanvas: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    if (trail.length > 1) {
      L.polyline(trail.map((p) => [p.lat, p.lng] as [number, number]), {
        color: "rgb(220 38 67)",
        weight: 2.2,
        opacity: 0.78,
        smoothFactor: 1.2,
      }).addTo(map);
    }

    if (lastSeen) {
      L.circleMarker([lastSeen.lat, lastSeen.lng], {
        radius: 8,
        color: "#FFFFFF",
        weight: 3,
        fillColor: "rgb(220 38 67)",
        fillOpacity: 0.95,
      }).addTo(map);
    }

    // Frame everything we drew.
    const pts: Array<[number, number]> = [];
    if (lastSeen) pts.push([lastSeen.lat, lastSeen.lng]);
    for (const p of trail) pts.push([p.lat, p.lng]);
    if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts), { padding: [18, 18] });
    } else if (pts.length === 1) {
      map.setView(pts[0]!, 14);
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lastSeen, trail]);

  if (!lastSeen && trail.length === 0) return null;

  return (
    <div
      ref={elRef}
      className={`w-full bg-muted ${className}`}
      style={{ height: heightPx, pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}
