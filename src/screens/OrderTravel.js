import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import React, { useState } from 'react'
import MapView from 'react-native-maps'
import Icon from 'react-native-vector-icons/Ionicons'
import { saveTravel } from '../storage/FirestoreServices'

const OrderTravel = () => {
    const [origin, setOrigin] = useState('')
    const [destination, setDestination] = useState('')
    const [vehicleType, setVehicleType] = useState('economico')
    const [estimatedPrice, setEstimatedPrice] = useState(0)
    const [loading, setLoading] = useState(false)

    const vehicleTypes = [
        { id: 'economico', label: 'Económico', basePrice: 5000 },
        { id: 'xl', label: 'XL', basePrice: 8000 },
        { id: 'premium', label: 'Premium', basePrice: 12000 },
    ]

    const calculatePrice = () => {
        // Cálculo simple: precio base + distancia estimada
        // En la vida real, usarías la Google Distance Matrix API
        const baseVehicle = vehicleTypes.find(v => v.id === vehicleType)
        const estimatedDistance = Math.random() * 20 + 2 // 2-22 km
        const pricePerKm = 1500
        const price = baseVehicle.basePrice + (estimatedDistance * pricePerKm)
        setEstimatedPrice(Math.round(price))
    }

    const handleRequestTravel = async () => {
        if (!origin || !destination) {
            Alert.alert('Error', 'Por favor completa origen y destino')
            return
        }

        setLoading(true)
        try {
            calculatePrice()
            
            const travelData = {
                origin: origin,
                destination: destination,
                vehicleType: vehicleType,
                estimatedPrice: estimatedPrice,
                distance: Math.random() * 20 + 2,
                estimatedTime: Math.round((Math.random() * 30 + 5)),
                date: new Date().toISOString().split('T')[0],
                time: new Date().toTimeString().slice(0, 5),
                status: 'completed',
            }

            const result = await saveTravel('user_001', travelData)

            if (result.success) {
                Alert.alert('Éxito', `Viaje guardado. Precio estimado: $${estimatedPrice}`)
                setOrigin('')
                setDestination('')
                setEstimatedPrice(0)
            } else {
                Alert.alert('Error', result.message)
            }
        } catch (error) {
            Alert.alert('Error', 'Error al solicitar viaje: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Solicitar Viaje</Text>
            </View>

            <View style={styles.formContainer}>
                {/* Origen */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Origen *</Text>
                    <View style={styles.inputWrapper}>
                        <Icon name="location" size={20} color="#007AFF" />
                        <TextInput
                            style={styles.input}
                            placeholder="Ingresa tu ubicación actual"
                            value={origin}
                            onChangeText={setOrigin}
                        />
                    </View>
                </View>

                {/* Destino */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Destino *</Text>
                    <View style={styles.inputWrapper}>
                        <Icon name="location" size={20} color="#FF3B30" />
                        <TextInput
                            style={styles.input}
                            placeholder="Ingresa tu destino"
                            value={destination}
                            onChangeText={setDestination}
                        />
                    </View>
                </View>

                {/* Mapa */}
                <View style={styles.mapContainer}>
                    <MapView style={styles.map} />
                </View>

                {/* Tipo de Vehículo */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Tipo de Vehículo</Text>
                    <View style={styles.vehicleContainer}>
                        {vehicleTypes.map(vehicle => (
                            <TouchableOpacity
                                key={vehicle.id}
                                style={[
                                    styles.vehicleButton,
                                    vehicleType === vehicle.id && styles.vehicleButtonActive
                                ]}
                                onPress={() => setVehicleType(vehicle.id)}
                            >
                                <Text style={[
                                    styles.vehicleButtonText,
                                    vehicleType === vehicle.id && styles.vehicleButtonTextActive
                                ]}>
                                    {vehicle.label}
                                </Text>
                                <Text style={[
                                    styles.vehiclePrice,
                                    vehicleType === vehicle.id && styles.vehiclePriceActive
                                ]}>
                                    ${vehicle.basePrice}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Precio Estimado */}
                {estimatedPrice > 0 && (
                    <View style={styles.priceContainer}>
                        <Text style={styles.priceLabel}>Precio Estimado</Text>
                        <Text style={styles.priceValue}>${estimatedPrice}</Text>
                    </View>
                )}

                {/* Botón de solicitud */}
                <TouchableOpacity
                    style={[styles.requestButton, loading && styles.requestButtonDisabled]}
                    onPress={handleRequestTravel}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.requestButtonText}>Solicitar Viaje</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8f8',
    },
    header: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    formContainer: {
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        marginLeft: 10,
        fontSize: 14,
        color: '#1a1a1a',
    },
    mapContainer: {
        width: '100%',
        height: 250,
        marginBottom: 20,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#e0e0e0',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    vehicleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    vehicleButton: {
        flex: 1,
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#e0e0e0',
        alignItems: 'center',
    },
    vehicleButtonActive: {
        borderColor: '#007AFF',
        backgroundColor: '#f0f7ff',
    },
    vehicleButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
    },
    vehicleButtonTextActive: {
        color: '#007AFF',
    },
    vehiclePrice: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    vehiclePriceActive: {
        color: '#007AFF',
        fontWeight: '700',
    },
    priceContainer: {
        backgroundColor: '#fff',
        paddingHorizontal: 15,
        paddingVertical: 15,
        borderRadius: 10,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    priceValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#007AFF',
    },
    requestButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    requestButtonDisabled: {
        opacity: 0.6,
    },
    requestButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
})

export default OrderTravel
