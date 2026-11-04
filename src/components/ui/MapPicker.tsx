// Pin picker for an organization's exact location (A-05, PH-07). Lazy: loads Leaflet only when opened.
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export default function MapPicker({
  center,
  value,
  onChange,
  label,
}: {
  center: { lat: number; lng: number };
  value: { lat: number; lng: number } | null;
  onChange: (p: { lat: number; lng: number }) => void;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const start = useRef(value ?? center);

  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false }).setView([start.current.lat, start.current.lng], 15);
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const color = token('--color-primary');
    let marker: L.CircleMarker | null = null;
    const place = (lat: number, lng: number) => {
      if (marker) marker.setLatLng([lat, lng]);
      else marker = L.circleMarker([lat, lng], { radius: 10, color, fillColor: color, fillOpacity: 0.9, weight: 2 }).addTo(map);
    };
    if (start.current !== center) place(start.current.lat, start.current.lng);
    map.on('click', (e: L.LeafletMouseEvent) => {
      place(e.latlng.lat, e.latlng.lng);
      onChangeRef.current({ lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) });
    });
    return () => void map.remove();
  }, [center]);

  return <div ref={el} dir="ltr" role="application" aria-label={label} className="h-64 w-full rounded-card border border-border" />;
}
