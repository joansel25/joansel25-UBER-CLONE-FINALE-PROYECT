import { View, Text, StyleSheet, ScrollView, ActivityIndicator, FlatList, TouchableOpacity, Alert } from 'react-native'
import React, { useState, useEffect } from 'react'
import Icon from 'react-native-vector-icons/Ionicons'
import { getTravelsByUser } from '../storage/FirestoreServices'

const TravelHistory = () => {
    const [travels, setTravels] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        loadTravels()
    }, [])

    const loadTravels = async () => {
        try {
            setLoading(true)
            const result = await getTravelsByUser('user_001')
            
            if (result.success) {
                setTravels(result.data)
                setError(null)
            } else {
                setError(result.message)
            }
        } catch (err) {
            setError('Error al cargar viajes: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = () => {
        loadTravels()
    }

    const TravelCard = ({ travel }) => {
        const formatPrice = (price) => {
            return `$${price?.toLocaleString('es-CO') || 0}`
        }

        const formatDate = (dateString) => {
            if (!dateString) return 'N/A'
            const date = new Date(dateString)
            return date.toLocaleDateString('es-CO')
        }

        return (
            <View style={styles.travelCard}>
                <View style={styles.travelHeader}>
                    <View style={styles.travelInfo}>
                        <View style={styles.locationRow}>
                            <Icon name="location" size={16} color="#007AFF" />
                            <Text style={styles.location}>{travel.origin}</Text>
                        </View>
                        <View style={styles.arrowContainer}>
                            <Icon name="arrow-down" size={14} color="#999" />
                        </View>
                        <View style={styles.locationRow}>
                            <Icon name="location" size={16} color="#FF3B30" />
                            <Text style={styles.location}>{travel.destination}</Text>
                        </View>
                    </View>
                    <View style={styles.priceContainer}>
                        <Text style={styles.price}>{formatPrice(travel.estimatedPrice)}</Text>
                        <View style={[styles.statusBadge, styles.completedBadge]}>
                            <Text style={styles.statusText}>{travel.status}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.travelDetails}>
                    <View style={styles.detailItem}>
                        <Icon name="calendar" size={14} color="#666" />
                        <Text style={styles.detailText}>{formatDate(travel.date)}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Icon name="time" size={14} color="#666" />
                        <Text style={styles.detailText}>{travel.time || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Icon name="road" size={14} color="#666" />
                        <Text style={styles.detailText}>{Math.round(travel.distance || 0)} km</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Icon name="car" size={14} color="#666" />
                        <Text style={styles.detailText}>{travel.vehicleType || 'N/A'}</Text>
                    </View>
                </View>
            </View>
        )
    }

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Cargando viajes...</Text>
            </View>
        )
    }

    if (error) {
        return (
            <View style={styles.centerContainer}>
                <Icon name="alert-circle" size={48} color="#FF3B30" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                    <Text style={styles.retryButtonText}>Reintentar</Text>
                </TouchableOpacity>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Historial de Viajes</Text>
                <TouchableOpacity onPress={handleRefresh}>
                    <Icon name="refresh" size={24} color="#007AFF" />
                </TouchableOpacity>
            </View>

            {travels.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Icon name="car" size={64} color="#ccc" />
                    <Text style={styles.emptyText}>No hay viajes registrados</Text>
                    <Text style={styles.emptySubText}>Solicita un viaje para verlo aquí</Text>
                </View>
            ) : (
                <FlatList
                    data={travels}
                    renderItem={({ item }) => <TravelCard travel={item} />}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContainer}
                    refreshing={loading}
                    onRefresh={handleRefresh}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8f8',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f8f8',
    },
    header: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
    errorText: {
        marginTop: 10,
        fontSize: 16,
        color: '#FF3B30',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 20,
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#999',
    },
    emptySubText: {
        marginTop: 8,
        fontSize: 14,
        color: '#bbb',
    },
    listContainer: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    travelCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    travelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    travelInfo: {
        flex: 1,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    location: {
        marginLeft: 8,
        fontSize: 13,
        color: '#1a1a1a',
        fontWeight: '500',
        flex: 1,
    },
    arrowContainer: {
        paddingVertical: 4,
        marginLeft: 8,
    },
    priceContainer: {
        alignItems: 'flex-end',
    },
    price: {
        fontSize: 18,
        fontWeight: '700',
        color: '#007AFF',
        marginBottom: 4,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    completedBadge: {
        backgroundColor: '#E8F5E9',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#4CAF50',
        textTransform: 'capitalize',
    },
    travelDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#f5f5f5',
        borderRadius: 6,
    },
    detailText: {
        marginLeft: 4,
        fontSize: 12,
        color: '#666',
    },
})

export default TravelHistory
