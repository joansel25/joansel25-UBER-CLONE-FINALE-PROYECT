import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import { DRIVER_PROFILES } from '../../utils/seedDrivers';

// Subset of drivers shown "reviewing" the request before accepting
const REVIEWING_DRIVERS = DRIVER_PROFILES.slice(0, 3);
const TICK_MS = 900;

const STATUS_REVIEWING  = 'reviewing';
const STATUS_DECLINED   = 'declined';
const STATUS_ACCEPTED   = 'accepted';

const STATUS_LABEL = {
  [STATUS_REVIEWING]: 'Revisando tu solicitud...',
  [STATUS_DECLINED]:  'No disponible',
  [STATUS_ACCEPTED]:  '¡Aceptó tu viaje!',
};

const STATUS_COLOR = {
  [STATUS_REVIEWING]: COLORS.primary,
  [STATUS_DECLINED]:  COLORS.danger,
  [STATUS_ACCEPTED]:  COLORS.success,
};

const STATUS_ICON = {
  [STATUS_REVIEWING]: 'time-outline',
  [STATUS_DECLINED]:  'close-circle-outline',
  [STATUS_ACCEPTED]:  'checkmark-circle-outline',
};

export default function SearchingDriversCard({ tripStatus }) {
  const [driverStates, setDriverStates] = useState(
    REVIEWING_DRIVERS.map(() => STATUS_REVIEWING),
  );
  const tickRef = useRef(0);
  const fadeAnims = useRef(REVIEWING_DRIVERS.map(() => new Animated.Value(0))).current;

  // Fade each driver card in on mount
  useEffect(() => {
    REVIEWING_DRIVERS.forEach((_, i) => {
      Animated.timing(fadeAnims[i], {
        toValue: 1, duration: 350,
        delay: i * 120,
        useNativeDriver: true,
      }).start();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cycle through drivers: first two "decline", last one "accepts"
  useEffect(() => {
    if (tripStatus !== 'requested') return;

    const interval = setInterval(() => {
      tickRef.current += 1;
      const tick = tickRef.current;

      setDriverStates(prev => {
        const next = [...prev];
        // After 1 tick: first driver declines
        if (tick === 1) next[0] = STATUS_DECLINED;
        // After 2 ticks: second driver declines
        if (tick === 2) next[1] = STATUS_DECLINED;
        // After 3 ticks: third driver accepts
        if (tick === 3) next[2] = STATUS_ACCEPTED;
        return next;
      });

      if (tick >= 3) clearInterval(interval);
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [tripStatus]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buscando conductor cercano</Text>

      <View style={styles.driversRow}>
        {REVIEWING_DRIVERS.map((driver, i) => {
          const driverStatus = driverStates[i];
          return (
            <Animated.View key={driver.id} style={[styles.driverCard, { opacity: fadeAnims[i] }]}>
              <View style={[
                styles.avatarCircle,
                driverStatus === STATUS_ACCEPTED && styles.avatarAccepted,
                driverStatus === STATUS_DECLINED && styles.avatarDeclined,
              ]}>
                <Icon name="person" size={18} color={COLORS.white} />
              </View>

              <Text style={styles.driverName} numberOfLines={1}>
                {driver.fullName.split(' ')[0]}
              </Text>

              <View style={styles.statusRow}>
                <Icon
                  name={STATUS_ICON[driverStatus]}
                  size={11}
                  color={STATUS_COLOR[driverStatus]}
                />
                <Text style={[styles.statusText, { color: STATUS_COLOR[driverStatus] }]}>
                  {STATUS_LABEL[driverStatus]}
                </Text>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F7FF',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginVertical: SPACING.sm,
    borderWidth: 1, borderColor: '#C8DCFF',
    ...SHADOW.card,
  },
  title: {
    fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary,
    marginBottom: SPACING.sm, textAlign: 'center',
  },
  driversRow: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start',
  },
  driverCard: {
    alignItems: 'center', gap: 4, flex: 1,
  },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  avatarAccepted: { backgroundColor: COLORS.success },
  avatarDeclined: { backgroundColor: COLORS.gray },

  driverName: { fontSize: 11, fontWeight: '700', color: COLORS.dark, textAlign: 'center' },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statusText: { fontSize: 9, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
});
