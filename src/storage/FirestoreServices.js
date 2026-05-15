import firestore from '@react-native-firebase/firestore'

const collection = firestore().collection('users')
const document = collection.doc('user_001')
document.set({
    name: 'Carlos',
    lastName: 'Torres',
    phone: 3002843029,
    email: [EMAIL_ADDRESS],
    password: [PASSWORD],
})
