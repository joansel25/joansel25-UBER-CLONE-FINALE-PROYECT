// On iOS, Geolocation triggers the system permission dialog automatically
// the first time getCurrentPosition / watchPosition is called.
// The dialog text is taken from NSLocationWhenInUseUsageDescription in Info.plist.
// No explicit permission request is needed in JS code.
export async function requestLocationPermission() {
  return true;
}
