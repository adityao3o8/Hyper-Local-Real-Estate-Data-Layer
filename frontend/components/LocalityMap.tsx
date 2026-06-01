"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchAmenities } from "@/lib/api";
import type { MapAmenity, ReportResponse } from "@/lib/types";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const CATEGORY_COLOR: Record<MapAmenity["category"], string> = {
  hospital: "#EF4444",
  school: "#3B82F6",
  park: "#16C784",
  metro: "#F59E0B",
};

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

export function LocalityMap({ data }: { data: ReportResponse }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const layerReadyRef = useRef(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [amenityCount, setAmenityCount] = useState<number | null>(null);
  const [comingSoon, setComingSoon] = useState<{ x: number; y: number } | null>(
    null
  );

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
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 13, 7, 16, 9],
          "circle-color": [
            "match",
            ["get", "category"],
            "hospital",
            CATEGORY_COLOR.hospital,
            "school",
            CATEGORY_COLOR.school,
            "park",
            CATEGORY_COLOR.park,
            "metro",
            CATEGORY_COLOR.metro,
            "#888888",
          ],
          "circle-opacity": 0.92,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#F5F5F5",
        },
      });

      layerReadyRef.current = true;

      map.flyTo({
        center: [lon, lat],
        zoom: 13,
        duration: 2000,
        essential: true,
      });

      map.on("click", "amenities-layer", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [
          number,
          number,
        ];
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
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["amenities-layer"],
      });
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
          setMapError(
            "Could not load amenity pins. Restart the API server (uvicorn api.main:app --reload --port 8000)."
          );
        }
      }
    };

    if (layerReadyRef.current && map.isStyleLoaded()) {
      load();
    } else {
      map.once("load", () => load());
    }

    return () => {
      disposed = true;
    };
  }, [data.amenities, data.centre.lat, data.centre.lon, data.locality]);

  return (
    <div className="no-print relative mt-12 w-full border border-[#1A1A1A] bg-[#0F0F0F]/90">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1A1A1A] px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#666666]">
          Amenity map · 3km radius
          {amenityCount !== null && (
            <span className="ml-2 text-[#A3A3A3]">({amenityCount} pins)</span>
          )}
        </p>
        <div className="flex flex-wrap gap-4 text-[10px] text-[#666666]">
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
            Hospitals
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
            Schools
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#16C784]" />
            Parks
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
            Metro
          </span>
          <span className="text-[#444444]">·</span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#16C784] shadow-[0_0_8px_#16C784]" />
            Locality centre
          </span>
        </div>
      </div>
      <div ref={containerRef} className="h-[420px] w-full" />
      {mapError && (
        <p className="border-t border-[#1A1A1A] px-4 py-2 text-center text-[12px] text-[#F59E0B]">
          {mapError}
        </p>
      )}
      {comingSoon && (
        <div
          className="pointer-events-none absolute z-20 rounded border border-[#1A1A1A] bg-[#0F0F0F] px-3 py-2 text-[11px] text-[#F5F5F5]"
          style={{ left: comingSoon.x, top: comingSoon.y, transform: "translate(-50%, -120%)" }}
        >
          Coming soon for this area
        </div>
      )}
    </div>
  );
}
