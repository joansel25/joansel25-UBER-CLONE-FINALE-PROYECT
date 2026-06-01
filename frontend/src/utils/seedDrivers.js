import firestore from '@react-native-firebase/firestore';

// category: economy (compact sedans), XL (SUVs/vans), premium (high-end sedans)
export const DRIVER_PROFILES = [
  { id: 'sim_driver_001', fullName: 'Carlos Rodríguez', email: 'carlos.r@sim.co',
    vehicle: { make: 'Toyota',    model: 'Corolla',      year: 2020, color: 'Blanco',   plate: 'ABC-123' },
    category: 'economy',
    licenseNumber: 'LIC-001', rating: 4.9, ratingCount: 312,
    profilePic: 'https://randomuser.me/api/portraits/men/32.jpg' },
  { id: 'sim_driver_002', fullName: 'María González',   email: 'maria.g@sim.co',
    vehicle: { make: 'Renault',   model: 'Duster',       year: 2021, color: 'Gris',     plate: 'DEF-456' },
    category: 'XL',
    licenseNumber: 'LIC-002', rating: 4.7, ratingCount: 198,
    profilePic: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { id: 'sim_driver_003', fullName: 'Andrés Martínez',  email: 'andres.m@sim.co',
    vehicle: { make: 'Chevrolet', model: 'Spark GT',     year: 2021, color: 'Rojo',     plate: 'GHI-789' },
    category: 'economy',
    licenseNumber: 'LIC-003', rating: 4.8, ratingCount: 245,
    profilePic: 'https://randomuser.me/api/portraits/men/15.jpg' },
  { id: 'sim_driver_004', fullName: 'Luis Pérez',        email: 'luis.p@sim.co',
    vehicle: { make: 'Toyota',    model: 'Fortuner',     year: 2022, color: 'Azul',     plate: 'JKL-012' },
    category: 'XL',
    licenseNumber: 'LIC-004', rating: 4.6, ratingCount: 156,
    profilePic: 'https://randomuser.me/api/portraits/men/68.jpg' },
  { id: 'sim_driver_005', fullName: 'Ana Torres',        email: 'ana.t@sim.co',
    vehicle: { make: 'Kia',       model: 'Picanto',      year: 2020, color: 'Negro',    plate: 'MNO-345' },
    category: 'economy',
    licenseNumber: 'LIC-005', rating: 4.8, ratingCount: 287,
    profilePic: 'https://randomuser.me/api/portraits/women/26.jpg' },
  { id: 'sim_driver_006', fullName: 'Pedro Vargas',      email: 'pedro.v@sim.co',
    vehicle: { make: 'BMW',       model: '320i',         year: 2023, color: 'Plateado', plate: 'PQR-678' },
    category: 'premium',
    licenseNumber: 'LIC-006', rating: 4.5, ratingCount: 89,
    profilePic: 'https://randomuser.me/api/portraits/men/91.jpg' },
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
      category:        d.category,
      licenseNumber:   d.licenseNumber,
      isVerified:      true,
      isSimulated:     true,
      status:          'available',
      currentLocation: { lat, lng },
      rating:          d.rating,
      ratingCount:     d.ratingCount,
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
      profilePic:  d.profilePic,
      createdAt:   firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  await batch.commit();
}
