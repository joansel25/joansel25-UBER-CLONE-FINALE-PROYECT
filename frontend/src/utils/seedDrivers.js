import firestore from '@react-native-firebase/firestore';

// Simulated drivers positioned around Bogotá city centre (4.7110, -74.0721)
const SIMULATED_DRIVERS = [
  {
    id: 'sim_driver_001',
    fullName: 'Carlos Rodríguez',
    email: 'carlos.r@sim.co',
    lat: 4.7183, lng: -74.0652,
    vehicle: { make: 'Toyota', model: 'Corolla', year: 2020, color: 'Blanco', plate: 'ABC-123' },
    licenseNumber: 'LIC-001',
    rating: 4.9,
  },
  {
    id: 'sim_driver_002',
    fullName: 'María González',
    email: 'maria.g@sim.co',
    lat: 4.7047, lng: -74.0828,
    vehicle: { make: 'Renault', model: 'Logan', year: 2019, color: 'Gris', plate: 'DEF-456' },
    licenseNumber: 'LIC-002',
    rating: 4.7,
  },
  {
    id: 'sim_driver_003',
    fullName: 'Andrés Martínez',
    email: 'andres.m@sim.co',
    lat: 4.7235, lng: -74.0795,
    vehicle: { make: 'Chevrolet', model: 'Spark GT', year: 2021, color: 'Rojo', plate: 'GHI-789' },
    licenseNumber: 'LIC-003',
    rating: 4.8,
  },
  {
    id: 'sim_driver_004',
    fullName: 'Luis Pérez',
    email: 'luis.p@sim.co',
    lat: 4.6975, lng: -74.0695,
    vehicle: { make: 'Mazda', model: '2', year: 2022, color: 'Azul', plate: 'JKL-012' },
    licenseNumber: 'LIC-004',
    rating: 4.6,
  },
  {
    id: 'sim_driver_005',
    fullName: 'Ana Torres',
    email: 'ana.t@sim.co',
    lat: 4.7115, lng: -74.0905,
    vehicle: { make: 'Kia', model: 'Picanto', year: 2020, color: 'Negro', plate: 'MNO-345' },
    licenseNumber: 'LIC-005',
    rating: 4.8,
  },
  {
    id: 'sim_driver_006',
    fullName: 'Pedro Vargas',
    email: 'pedro.v@sim.co',
    lat: 4.7298, lng: -74.0738,
    vehicle: { make: 'Nissan', model: 'March', year: 2018, color: 'Plateado', plate: 'PQR-678' },
    licenseNumber: 'LIC-006',
    rating: 4.5,
  },
];

export async function seedSimulatedDrivers() {
  const batch = firestore().batch();

  for (const d of SIMULATED_DRIVERS) {
    const driverRef = firestore().collection('drivers').doc(d.id);
    const userRef   = firestore().collection('users').doc(d.id);

    batch.set(driverRef, {
      userId:          d.id,
      vehicleInfo:     d.vehicle,
      licenseNumber:   d.licenseNumber,
      isVerified:      true,
      isSimulated:     true,
      status:          'available',
      currentLocation: { lat: d.lat, lng: d.lng },
      rating:          d.rating,
      createdAt:       firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    batch.set(userRef, {
      fullName:   d.fullName,
      email:      d.email,
      phone:      `+5730000000${d.id.slice(-1)}`,
      role:       'driver',
      rating:     d.rating,
      language:   'ES',
      isOnline:   true,
      isSimulated: true,
      profilePic: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      createdAt:  firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();
}
