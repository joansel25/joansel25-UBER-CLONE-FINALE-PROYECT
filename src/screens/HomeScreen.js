import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MapPlaceholder from '../components/MapPlaceholder';

const HomeScreen = () => {
    return (
        <View style={styles.container}>
            { }
            <MapPlaceholder style={styles.mapPlaceholder} />

            { }
            <View style={styles.searchContainer}>
                <TouchableOpacity style={styles.searchBar}>
                    <Icon name="search" size={20} color="#000" style={styles.searchIcon} />
                    <Text style={styles.searchText}>¿A dónde vas?</Text>
                    <View style={styles.nowBadge}>
                        <Icon name="time" size={16} color="#000" />
                        <Text style={styles.nowText}>Ahora</Text>
                        <Icon name="chevron-down" size={16} color="#000" />
                    </View>
                </TouchableOpacity>

             
                <View style={styles.favoritesContainer}>
                    <TouchableOpacity style={styles.favoriteItem}>
                        <View style={[styles.iconCircle, { backgroundColor: '#eeeeee' }]}>
                            <Icon name="star" size={20} color="#000" />
                        </View>
                        <Text style={styles.favoriteText}>Favoritos</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.favoriteItem}>
                        <View style={[styles.iconCircle, { backgroundColor: '#eeeeee' }]}>
                            <Icon name="home" size={20} color="#000" />
                        </View>
                        <Text style={styles.favoriteText}>Casa</Text>
                    </TouchableOpacity>
                </View>
            </View>

           
            <View style={styles.servicesSection}>
                <Text style={styles.sectionTitle}>Sugerencias</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.servicesScroll}>
                   
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    mapPlaceholder: {
        flex: 1,
        backgroundColor: '#e0e0e0', 
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapText: {
        color: '#757575',
        fontWeight: 'bold',
    },
    searchContainer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: -20, 
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 5,
    },
    searchBar: {
        backgroundColor: '#f3f3f3',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 30,
    },
    searchIcon: { marginRight: 10 },
    searchText: { flex: 1, fontSize: 18, fontWeight: '500', color: '#000' },
    nowBadge: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        alignItems: 'center',
    },
    nowText: { marginHorizontal: 5, fontWeight: '600' },
    favoritesContainer: {
        flexDirection: 'row',
        marginTop: 20,
    },
    favoriteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    iconCircle: {
        padding: 8,
        borderRadius: 20,
        marginRight: 8,
    },
    favoriteText: { fontWeight: '600' },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', paddingHorizontal: 20, marginTop: 10 }
});

export default HomeScreen;
