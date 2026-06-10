"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchAmenities, getApiBase } from "@/lib/api";
import type { MapAmenity, ReportResponse } from "@/lib/types";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const CATEGORY_COLOR: Record<MapAmenity["category"], string> = {
  hospital: "#EF4444",
  school: "#3B82F6",
  park: "#16C784",
  metro: "#F59E0B",
};

const LEGEND = [
  { label: "Hospitals", color: "#EF4444", key: "hospital" },
  { label: "Schools", color: "#3B82F6", key: "school" },
  { label: "Parks", color: "#16C784", key: "park" },
  { label: "Metro", color: "#F59E0B", key: "metro" },
] as const;

function amenitiesToGeoJSON(amenities: MapAmenity[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: amenities.map((a) => ({
      type: "Feature",
      properties: { name: a.name, category: a.category },
      geometry: { type: "Point", coordinates: [a.lon, a.lat] },
    })),
  };
}

export default function Map({ data }: { data: ReportResponse }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const layerReadyRef = useRef(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [amenityCount, setAmenityCount] = useState<number | null>(null);
  const [comingSoon, setComingSoon] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const { lat, lon } = data.centre;
    let disposed = false;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [lon, lat],
      zoom: 12,
      attributionControl: false,
      fadeDuration: 200,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    const pinEl = document.createElement("div");
    pinEl.className = "locality-pin";
    pinEl.innerHTML = `<div class="pin-core"></div><div class="pin-pulse"></div>`;
    markerRef.current = new maplibregl.Marker({ element: pinEl })
      .setLngLat([lon, lat])
      .addTo(map);

    map.on("load", () => {
      if (disposed) return;

      map.addSource("amenities", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "amenities-layer",
        type: "circle",
        source: "amenities",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 13, 6.5, 16, 9],
          "circle-color": [
            "match",
            ["get", "category"],
            "hospital", CATEGORY_COLOR.hospital,
            "school", CATEGORY_COLOR.school,
            "park", CATEGORY_COLOR.park,
            "metro", CATEGORY_COLOR.metro,
            "#888",
          ],
          "circle-opacity": 0.88,
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(255,255,255,0.15)",
          "circle-blur": 0.1,
        },
      });

      layerReadyRef.current = true;

      map.flyTo({ center: [lon, lat], zoom: 13.2, duration: 1600, essential: true });

      map.on("click", "amenities-layer", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        const name = feature.properties?.name || "Amenity";
        new maplibregl.Popup({ closeButton: true, className: "map-popup" })
          .setLngLat(coords)
          .setHTML(`<p class="popup-name">${name}</p>`)
          .addTo(map);
      });

      map.on("mouseenter", "amenities-layer", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "amenities-layer", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    map.on("click", (e) => {
      if (!map.getLayer("amenities-layer")) return;
      const features = map.queryRenderedFeatures(e.point, { layers: ["amenities-layer"] });
      if (features.length > 0) return;
      setComingSoon({ x: e.point.x, y: e.point.y });
      setTimeout(() => setComingSoon(null), 2200);
    });

    return () => {
      disposed = true;
      layerReadyRef.current = false;
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [data.centre.lat, data.centre.lon, data.locality]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let disposed = false;

    const applyAmenities = (amenities: MapAmenity[]) => {
      if (disposed) return;

      const setData = () => {
        const source = map.getSource("amenities") as GeoJSONSource | undefined;
        if (!source) return false;
        source.setData(amenitiesToGeoJSON(amenities));
        setAmenityCount(amenities.length);
        setMapError(amenities.length === 0 ? "No amenities found in this radius." : null);
        return true;
      };

      if (setData()) return;
      map.once("load", setData);
    };

    const load = async () => {
      if (data.amenities && data.amenities.length > 0) {
        applyAmenities(data.amenities);
        return;
      }
      try {
        const { amenities } = await fetchAmenities(data.centre.lat, data.centre.lon);
        applyAmenities(amenities);
      } catch (err) {
        console.error("[Map] amenities load failed:", err);
        if (!disposed) {
          setMapError(`Could not load amenity pins. Check the API at ${getApiBase()}.`);
        }
      }
    };

    if (layerReadyRef.current && map.isStyleLoaded()) {
      load();
    } else {
      map.once("load", () => load());
    }

    return () => { disposed = true; };
  }, [data.amenities, data.centre.lat, data.centre.lon, data.locality]);

  return (
    <div
      className="no-print relative mt-16 w-full overflow-hidden rounded-2xl"
      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(13,13,16,0.9)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#16C784", boxShadow: "0 0 8px rgba(22,199,132,0.8)" }}
          />
          <p
            className="uppercase tracking-[0.22em]"
            style={{
              fontFamily: "var(--font-space-mono), monospace",
              fontSize: "9px",
              color: "#3a3a48",
            }}
          >
            Amenity map · 3 km radius
            {amenityCount !== null && (
              <span style={{ color: "#52525e", marginLeft: "8px" }}>{amenityCount} pins</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          {LEGEND.map((item) => (
            <span
              key={item.key}
              className="flex items-center gap-1.5 uppercase tracking-[0.12em]"
              style={{
                fontFamily: "var(--font-space-mono), monospace",
                fontSize: "9px",
                color: "#52525e",
              }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: item.color, boxShadow: `0 0 5px ${item.color}60` }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Map canvas */}
      <div ref={containerRef} style={{ height: "460px", width: "100%" }} />

      {/* Gradient top edge */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-[57px] h-12 z-10"
        style={{ background: "linear-gradient(to bottom, rgba(7,7,9,0.5), transparent)" }}
      />

      {mapError && (
        <p
          className="px-5 py-3 text-center"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            fontFamily: "var(--font-space-mono), monospace",
            fontSize: "11px",
            color: "#F59E0B",
          }}
        >
          {mapError}
        </p>
      )}

      {comingSoon && (
        <div
          className="pointer-events-none absolute z-20 rounded-xl px-3 py-2"
          style={{
            left: comingSoon.x,
            top: comingSoon.y,
            transform: "translate(-50%, -120%)",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(13,13,16,0.95)",
            fontFamily: "var(--font-space-mono), monospace",
            fontSize: "11px",
            color: "#efefef",
            backdropFilter: "blur(8px)",
          }}
        >
          Coming soon for this area
        </div>
      )}
    </div>
  );
}
