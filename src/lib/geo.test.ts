import { describe, expect, it } from 'vitest';
import { directionsUrl, directionsUrlForAddress, distanceKm } from './geo';

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm({ lat: 31.34, lng: 34.3 }, { lat: 31.34, lng: 34.3 })).toBe(0);
  });

  it('matches a known distance within 1%', () => {
    // ~11.1 km per 0.1° of latitude
    const d = distanceKm({ lat: 31.3, lng: 34.3 }, { lat: 31.4, lng: 34.3 });
    expect(d).toBeGreaterThan(11.0);
    expect(d).toBeLessThan(11.25);
  });
});

describe('directions links', () => {
  it('builds a keyless Google Maps link from coordinates', () => {
    expect(directionsUrl({ lat: 31.34, lng: 34.3 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=31.34,34.3',
    );
  });

  it('encodes a text address', () => {
    expect(directionsUrlForAddress('خان يونس، وسط المدينة')).toContain(encodeURIComponent('خان يونس'));
  });
});
