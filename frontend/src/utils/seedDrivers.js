import firestore from '@react-native-firebase/firestore';

export const DRIVER_PROFILES = [
  { id: 'sim_driver_001', fullName: 'Carlos Rodríguez', email: 'carlos.r@sim.co',
    vehicle: { make: 'Toyota',    model: 'Corolla',  year: 2020, color: 'Blanco',   plate: 'ABC-123' },
    licenseNumber: 'LIC-001', rating: 4.9 },
  { id: 'sim_driver_002', fullName: 'María González',   email: 'maria.g@sim.co',
    vehicle: { make: 'Renault',   model: 'Logan',    year: 2019, color: 'Gris',     plate: 'DEF-456' },
    licenseNumber: 'LIC-002', rating: 4.7 },
  { id: 'sim_driver_003', fullName: 'Andrés Martínez',  email: 'andres.m@sim.co',
    vehicle: { make: 'Chevrolet', model: 'Spark GT', year: 2021, color: 'Rojo',     plate: 'GHI-789' },
    licenseNumber: 'LIC-003', rating: 4.8 },
  { id: 'sim_driver_004', fullName: 'Luis Pérez',        email: 'luis.p@sim.co',
    vehicle: { make: 'Mazda',     model: '2',        year: 2022, color: 'Azul',     plate: 'JKL-012' },
    licenseNumber: 'LIC-004', rating: 4.6 },
  { id: 'sim_driver_005', fullName: 'Ana Torres',        email: 'ana.t@sim.co',
    vehicle: { make: 'Kia',       model: 'Picanto',  year: 2020, color: 'Negro',    plate: 'MNO-345' },
    licenseNumber: 'LIC-005', rating: 4.8 },
  { id: 'sim_driver_006', fullName: 'Pedro Vargas',      email: 'pedro.v@sim.co',
    vehicle: { make: 'Nissan',    model: 'March',    year: 2018, color: 'Plateado', plate: 'PQR-678' },
    licenseNumber: 'LIC-006', rating: 4.5 },
];

// All drivers within 300 m – 1.2 km so they are visible on the initial map view.
// Spread in different compass directions to enable realistic nearest-driver dynamics.
export const OFFSETS = [
  { dlat:  0.003, dlng:  0.002 },  // ~350 m  NE — very close
  { dlat: -0.005, dlng:  0.003 },  // ~580 m  SE
  { dlat:  0.006, dlng: -0.004 },  // ~720 m  NW
  { dlat: -0.004, dlng: -0.006 },  // ~720 m  SW
  { dlat:  0.007, dlng:  0.005 },  // ~860 m  ENE
  { dlat: -0.006, dlng:  0.007 },  // ~920 m  ESE
];

export async function seedSimulatedDrivers(centerLat, centerLng) {
  const batch = firestore().batch();

  DRIVER_PROFILES.forEach((d, i) => {
    const lat = centerLat + OFFSETS[i].dlat;
    const lng = centerLng + OFFSETS[i].dlng;

    batch.set(firestore().collection('drivers').doc(d.id), {
      userId:          d.id,
      fullName:        d.fullName,
      vehicleInfo:     d.vehicle,
      licenseNumber:   d.licenseNumber,
      isVerified:      true,
      isSimulated:     true,
      status:          'available',
      currentLocation: { lat, lng },
      rating:          d.rating,
      createdAt:       firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    batch.set(firestore().collection('users').doc(d.id), {
      fullName:    d.fullName,
      email:       d.email,
      phone:       `+5730000000${i + 1}`,
      role:        'driver',
      rating:      d.rating,
      language:    'ES',
      isOnline:    true,
      isSimulated: true,
      profilePic:  'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      createdAt:   firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  await batch.commit();
}
