import { useState, useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export default function useLocation() {
  const [location, setLocation] = useState(null);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let watchId;

    const start = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Location permission denied');
          return;
        }
      }

      watchId = Geolocation.watchPosition(
        ({ coords }) =>
          setLocation({ latitude: coords.latitude, longitude: coords.longitude }),
        (err) => setError(err.message),
        { enableHighAccuracy: true, distanceFilter: 10 }
      );
    };

    start();
    return () => { if (watchId !== undefined) Geolocation.clearWatch(watchId); };
  }, []);

  return { location, error };
}
