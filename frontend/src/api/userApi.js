import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';

const usersCol = () => firestore().collection('users');

function withTimeout(promise, ms = 12000) {
  const timer = new Promise((_, reject) =>
    setTimeout(
      () => reject(
        Object.assign(
          new Error('Sin respuesta de Firestore. Verifica tu conexión y que la base de datos esté creada en Firebase Console.'),
          { statusCode: 408 },
        ),
      ),
      ms,
    ),
  );
  return Promise.race([promise, timer]);
}

// Normalizes Firestore errors into statusCode-tagged errors
function normalizeFirestoreError(e) {
  if (e.code === 'permission-denied' || e.code === 'firestore/permission-denied') {
    return Object.assign(
      new Error(
        'Las reglas de Firestore bloquean el acceso. ' +
        'Ve a Firebase Console → Firestore → Reglas y publica: allow read, write: if request.auth != null;'
      ),
      { statusCode: 403, isPermissionError: true },
    );
  }
  return e;
}

function docToUser(doc) {
  if (!doc.exists) return null;
  const data = doc.data();
  return { _id: doc.id, id: doc.id, ...data };
}

const userApi = {
  register: async (data) => {
    const uid = data.firebaseUid;
    if (!uid) throw Object.assign(new Error('firebaseUid requerido'), { statusCode: 400 });

    const userData = {
      fullName:         data.fullName,
      email:            (data.email ?? '').toLowerCase().trim(),
      phone:            data.phone,
      gender:           data.gender,
      language:         data.language || 'ES',
      role:             data.role     || 'passenger',
      firebaseUid:      uid,
      rating:           5.0,
      isOnline:         false,
      stripeCustomerId: null,
      profilePic:       'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      createdAt:        firestore.FieldValue.serverTimestamp(),
    };

    try {
      await withTimeout(usersCol().doc(uid).set(userData, { merge: true }));
    } catch (e) {
      throw normalizeFirestoreError(e);
    }
    return { data: { _id: uid, id: uid, ...userData, createdAt: new Date().toISOString() } };
  },

  getMe: async () => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw Object.assign(new Error('No autenticado'), { statusCode: 401 });

    let doc;
    try {
      doc = await withTimeout(usersCol().doc(uid).get());
    } catch (e) {
      throw normalizeFirestoreError(e);
    }

    if (!doc.exists) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    return { data: docToUser(doc) };
  },

  updateProfile: async (updates) => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw Object.assign(new Error('No autenticado'), { statusCode: 401 });

    const allowed = ['fullName', 'phone', 'language', 'profilePic'];
    const safe    = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) safe[key] = updates[key];
    }
    if (Object.keys(safe).length === 0) {
      throw Object.assign(new Error('No valid fields provided'), { statusCode: 400 });
    }

    try {
      await withTimeout(usersCol().doc(uid).update(safe));
    } catch (e) {
      throw normalizeFirestoreError(e);
    }
    return { data: { _id: uid, id: uid, ...safe } };
  },
};

export default userApi;
