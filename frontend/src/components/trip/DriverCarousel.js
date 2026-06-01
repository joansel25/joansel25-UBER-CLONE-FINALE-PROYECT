import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { haversineKm } from '../../hooks/useDriverSimulation';

export default function DriverCarousel({
  drivers,
  driverPositions,
  selectedDriverId,
  setSelectedDriverId,
  carouselRef,
  carouselIndex,
  setCarouselIndex,
  nearestDriver,
  originPlace,
  userLocRef,
  t,
  cardWidth,
}) {
  return (
    <View style={styles.driversSection}>
      <View style={styles.driversRow}>
        <View style={styles.driversAvailableChip}>
          <View style={styles.driversDot} />
          <Text style={styles.driversAvailableText}>
            {t('home_drivers_available', drivers.length)}
          </Text>
        </View>
        <Text style={styles.tapHintText}>{t('home_tap_driver_hint')}</Text>
      </View>

      <FlatList
        ref={carouselRef}
        data={drivers}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item._id}
        getItemLayout={(_, index) => ({
          length: cardWidth, offset: cardWidth * index, index,
        })}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
          setCarouselIndex(idx);
        }}
        renderItem={({ item: driver }) => {
          const pos       = driverPositions[driver._id];
          const isNearest = nearestDriver?._id === driver._id;
          const isSelected = selectedDriverId === driver._id;
          const ref = originPlace ?? (userLocRef.current
            ? { lat: userLocRef.current.latitude, lng: userLocRef.current.longitude }
            : null);
          const dist = pos && ref
            ? haversineKm(ref.lat, ref.lng, pos.lat, pos.lng).toFixed(1)
            : null;

          return (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.driverCard,
                { width: cardWidth },
                isNearest && !isSelected && styles.driverCardNearest,
                isSelected && styles.driverCardSelected,
              ]}
              onPress={() => setSelectedDriverId(prev =>
                prev === driver._id ? null : driver._id,
              )}
            >
              <View style={[
                styles.driverCardAvatar,
                isSelected && { backgroundColor: COLORS.success },
                isNearest && !isSelected && { backgroundColor: COLORS.primary },
              ]}>
                <Icon name="person" size={18} color={COLORS.white} />
              </View>

              <View style={styles.driverCardBody}>
                <Text style={styles.driverCardName}>{driver.fullName}</Text>
                <Text style={styles.driverCardCar}>
                  {driver.vehicleInfo?.make} {driver.vehicleInfo?.model} {driver.vehicleInfo?.year}
                </Text>
                <Text style={styles.driverCardPlate}>
                  {driver.vehicleInfo?.color} · {driver.vehicleInfo?.plate}
                </Text>
              </View>

              <View style={styles.driverCardRight}>
                <View style={styles.driverCardRatingRow}>
                  <Icon name="star" size={11} color="#FF9500" />
                  <Text style={styles.driverCardRating}>{driver.rating}</Text>
                </View>
                {dist != null && (
                  <>
                    <Text style={styles.driverCardDist}>{dist} km</Text>
                    <Text style={styles.driverCardEta}>
                      {t('home_driver_eta', Math.max(1, Math.round(Number(dist) * 3)))}
                    </Text>
                  </>
                )}
                {isSelected ? (
                  <View style={[styles.driverBadge, styles.driverBadgeSelected]}>
                    <Text style={styles.driverBadgeText}>{t('home_driver_selected')}</Text>
                  </View>
                ) : isNearest ? (
                  <View style={[styles.driverBadge, styles.driverBadgeNearest]}>
                    <Text style={styles.driverBadgeText}>{t('home_nearest_driver')}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.dotsRow}>
        {drivers.map((_, i) => (
          <View key={i} style={[styles.dot, i === carouselIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  driversSection: { marginBottom: SPACING.sm },
  driversRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 8, flexWrap: 'wrap',
  },
  driversAvailableChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F0FFF4', borderRadius: 20,
    paddingVertical: 4, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#A8E6CF',
  },
  driversDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success },
  driversAvailableText: { fontSize: 11, color: '#2d7a44', fontWeight: '600' },
  tapHintText: { fontSize: 11, color: COLORS.gray, flex: 1 },

  driverCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFF', borderRadius: RADIUS.md,
    padding: 10, borderWidth: 1.5, borderColor: '#D0E4FF',
    gap: 10, ...SHADOW.card,
  },
  driverCardNearest:  { borderColor: COLORS.primary,  backgroundColor: '#EEF6FF' },
  driverCardSelected: { borderColor: COLORS.success, backgroundColor: '#F0FFF4' },

  driverCardAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  driverCardBody:  { flex: 1 },
  driverCardName:  { fontSize: FONT.base, fontWeight: '700', color: COLORS.dark },
  driverCardCar:   { fontSize: FONT.sm, color: COLORS.gray, marginTop: 1 },
  driverCardPlate: { fontSize: FONT.sm, color: COLORS.gray },

  driverCardRight:     { alignItems: 'flex-end', gap: 3 },
  driverCardRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  driverCardRating:    { fontSize: FONT.sm, fontWeight: '700', color: COLORS.dark },
  driverCardDist:      { fontSize: FONT.sm, color: COLORS.primary, fontWeight: '600' },
  driverCardEta:       { fontSize: 11, color: COLORS.gray },

  driverBadge:         { borderRadius: 10, paddingVertical: 2, paddingHorizontal: 7 },
  driverBadgeNearest:  { backgroundColor: '#EEF5FF' },
  driverBadgeSelected: { backgroundColor: '#E8F8EE' },
  driverBadgeText:     { fontSize: 10, fontWeight: '700', color: COLORS.primary },

  dotsRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 7, gap: 5,
  },
  dot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D0D5DD' },
  dotActive:{ width: 18, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
});
