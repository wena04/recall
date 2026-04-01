import { useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';

const PING_INTERVAL_MS = 5 * 60 * 1000; // re-ping every 5 minutes even if stationary

export default function LocationTracker({ userId }: { userId: string }) {
  const coordsRef = useRef<GeolocationCoordinates | null>(null);

  const sendLocation = (coords: GeolocationCoordinates) => {
    void apiFetch('/api/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
    }).catch(() => {});
  };

  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    // Watch for movement
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        coordsRef.current = pos.coords;
        sendLocation(pos.coords);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 10000 },
    );

    // Also ping on a fixed interval so stationary devices still trigger notifications
    const intervalId = setInterval(() => {
      if (coordsRef.current) {
        sendLocation(coordsRef.current);
      } else {
        // Haven't gotten a position yet — request one now
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            coordsRef.current = pos.coords;
            sendLocation(pos.coords);
          },
          () => {},
        );
      }
    }, PING_INTERVAL_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return null;
}
