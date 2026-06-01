import { useState, useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export default function useLocation() {
  const [location, setLocation] = useState(null);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let watchId;
    let cancelled = false;

    const start = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Location permission denied');
          return;
        }
      }

      // Fast fix from OS cache — centers the map and seeds drivers immediately
      // without waiting for a fresh high-accuracy GPS signal.
      Geolocation.getCurrentPosition(
        ({ coords }) => {
          if (!cancelled) setLocation({ latitude: coords.latitude, longitude: coords.longitude });
        },
        () => {}, // silent — watchPosition below provides the accurate ongoing fix
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
      );

      // Continuous high-accuracy updates once the fast fix is already shown.
      watchId = Geolocation.watchPosition(
        ({ coords }) => {
          if (!cancelled) setLocation({ latitude: coords.latitude, longitude: coords.longitude });
        },
        (err) => { if (!cancelled) setError(err.message); },
        { enableHighAccuracy: true, distanceFilter: 10 },
      );
    };

    start();
    return () => {
      cancelled = true;
      if (watchId !== undefined) Geolocation.clearWatch(watchId);
    };
  }, []);

  return { location, error };
}
