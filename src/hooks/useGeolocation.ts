// Location is asked for only on an explicit tap and stays in memory; it is never sent anywhere (SPEC §11).
import { useCallback, useState } from 'react';
import type { LatLng } from '../lib/geo';

type GeoState = { status: 'idle' | 'asking' | 'denied' | 'unavailable' } | { status: 'ready'; position: LatLng };

let cached: LatLng | null = null;

export function useGeolocation() {
  const [state, setState] = useState<GeoState>(cached ? { status: 'ready', position: cached } : { status: 'idle' });

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) return setState({ status: 'unavailable' });
    setState({ status: 'asking' });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        cached = { lat: p.coords.latitude, lng: p.coords.longitude };
        setState({ status: 'ready', position: cached });
      },
      (err) => setState({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  return { ...state, position: state.status === 'ready' ? state.position : null, request };
}
