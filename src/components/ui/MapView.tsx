// Leaflet + OpenStreetMap tiles, loaded only when the user switches to the map (SPEC §11–12).
// Tiles are never cached for offline use; attribution stays visible.
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  href?: string;
}

const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export default function MapView({
  markers,
  center,
  zoom = 13,
  className,
  label,
}: {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer(TILE_URL, {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const color = token('--color-primary');
    const group = L.featureGroup(
      markers.map((m) => {
        const marker = L.circleMarker([m.lat, m.lng], { radius: 9, color, fillColor: color, fillOpacity: 0.85, weight: 2 });
        const link = document.createElement(m.href ? 'a' : 'span');
        link.textContent = m.label;
        if (m.href && link instanceof HTMLAnchorElement) link.href = m.href;
        return marker.bindPopup(link);
      }),
    ).addTo(map);

    if (markers.length > 1) map.fitBounds(group.getBounds(), { padding: [32, 32], maxZoom: 15 });
    else if (markers[0]) map.setView([markers[0].lat, markers[0].lng], zoom);
    else if (center) map.setView([center.lat, center.lng], zoom - 2);

    return () => void map.remove();
  }, [markers, center, zoom]);

  // Leaflet lays out in LTR; the page around it stays RTL.
  return <div ref={el} dir="ltr" role="region" aria-label={label} className={className ?? 'h-96 w-full rounded-card border border-border'} />;
}
