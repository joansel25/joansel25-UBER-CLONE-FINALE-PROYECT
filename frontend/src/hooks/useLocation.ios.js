import { useState, useEffect } from 'react';
import Geolocation from '@react-native-community/geolocation';

export default function useLocation() {
  const [location, setLocation] = useState(null);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let watchId;

    watchId = Geolocation.watchPosition(
      ({ coords }) =>
        setLocation({ latitude: coords.latitude, longitude: coords.longitude }),
      (err) => setError(err.message),
      { enableHighAccuracy: true, distanceFilter: 10 },
    );

    return () => { if (watchId !== undefined) Geolocation.clearWatch(watchId); };
  }, []);

  return { location, error };
}
