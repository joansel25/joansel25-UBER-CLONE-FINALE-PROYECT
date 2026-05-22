import firestore from '@react-native-firebase/firestore'
import '@react-native-firebase/app'

// CONFIGURACIÓN DE FIREBASE
export const firebaseConfig = {
    apiKey: 'AIzaSyB1ASr2qFFADCugpo_0brWXHB5HWI3sSMU',
    authDomain: 'uberdatabase-f6b26.firebaseapp.com',
    projectId: 'uberdatabase-f6b26',
    storageBucket: 'uberdatabase-f6b26.firebasestorage.app',
    messagingSenderId: '416098896114',
    appId: '1:416098896114:android:f7b45deec600d035b7e86b',
}

// USUARIOS
export const saveUser = async (userId, userData) => {
    try {
        await firestore()
            .collection('users')
            .doc(userId)
            .set(userData, { merge: true })
        return { success: true, message: 'Usuario guardado exitosamente' }
    } catch (error) {
        console.error('Error saving user:', error)
        return { success: false, message: error.message }
    }
}

export const getUser = async (userId) => {
    try {
        const userDoc = await firestore()
            .collection('users')
            .doc(userId)
            .get()
        
        if (userDoc.exists) {
            return { success: true, data: userDoc.data() }
        } else {
            return { success: false, message: 'Usuario no encontrado' }
        }
    } catch (error) {
        console.error('Error getting user:', error)
        return { success: false, message: error.message }
    }
}

// VIAJES
export const saveTravel = async (userId, travelData) => {
    try {
        const travelId = firestore().collection('travels').doc().id
        
        await firestore()
            .collection('travels')
            .doc(travelId)
            .set({
                ...travelData,
                userId: userId,
                createdAt: firestore.FieldValue.serverTimestamp(),
                status: 'completed'
            })
        
        return { success: true, message: 'Viaje guardado exitosamente', travelId }
    } catch (error) {
        console.error('Error saving travel:', error)
        return { success: false, message: error.message }
    }
}

export const getTravelsByUser = async (userId) => {
    try {
        const snapshot = await firestore()
            .collection('travels')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get()
        
        const travels = []
        snapshot.forEach(doc => {
            travels.push({ id: doc.id, ...doc.data() })
        })
        
        return { success: true, data: travels }
    } catch (error) {
        console.error('Error getting travels:', error)
        return { success: false, message: error.message }
    }
}

export const updateTravel = async (travelId, updateData) => {
    try {
        await firestore()
            .collection('travels')
            .doc(travelId)
            .update(updateData)
        
        return { success: true, message: 'Viaje actualizado exitosamente' }
    } catch (error) {
        console.error('Error updating travel:', error)
        return { success: false, message: error.message }
    }
}
