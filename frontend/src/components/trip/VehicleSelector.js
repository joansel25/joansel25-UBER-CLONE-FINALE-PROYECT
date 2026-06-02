import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatCOP } from '../../utils/formatters';
import { useTheme }  from '../../context/ThemeContext';
import { COLORS, RADIUS, FONT, SHADOW } from '../../constants/theme';

const MAX_FARE = 50000;

const VEHICLES = [
  { id: 'economy', label: 'Economy', icon: 'car-outline',       capacity: '4', desc: 'Económico' },
  { id: 'xl',      label: 'XL',      icon: 'car-sport-outline', capacity: '6', desc: 'Espacioso' },
  { id: 'premium', label: 'Premium', icon: 'diamond-outline',   capacity: '4', desc: 'Confort'   },
];

export default function VehicleSelector({ fares = {}, selected, onSelect }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {VEHICLES.map(v => {
        const fareData  = fares[v.id];
        const fare      = fareData?.fare ?? null;
        const isActive  = selected === v.id;
        const overLimit = fare !== null && fare > MAX_FARE;

        return (
          <TouchableOpacity
            key={v.id}
            style={[
              styles.card,
              isActive    && styles.cardActive,
              overLimit   && styles.cardDisabled,
            ]}
            onPress={() => !overLimit && onSelect(v.id)}
            activeOpacity={overLimit ? 1 : 0.8}
          >
            <Icon
              name={v.icon}
              size={28}
              color={isActive ? '#fff' : overLimit ? colors.border : colors.textPrimary}
            />

            <Text style={[styles.name, isActive && styles.nameActive, overLimit && styles.textMuted]}>
              {v.label}
            </Text>
            <View style={styles.capacityRow}>
              <Icon name="people-outline" size={11} color={isActive ? 'rgba(255,255,255,0.8)' : colors.textSecondary} />
              <Text style={[styles.capacity, isActive && styles.capacityActive]}>{v.capacity}</Text>
            </View>

            {fare !== null ? (
              <>
                <Text style={[styles.fare, isActive && styles.fareActive, overLimit && styles.fareOver]}>
                  {formatCOP(fare)}
                </Text>
                {overLimit && (
                  <Text style={styles.limitLabel}>Límite 50k</Text>
                )}
              </>
            ) : (
              <Text style={styles.fareLoading}>—</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    row: { paddingHorizontal: 4, gap: 10, paddingVertical: 4 },

    card: {
      width: 100,
      paddingVertical: 14,
      paddingHorizontal: 10,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surface,
      alignItems: 'center',
      gap: 4,
      borderWidth: 2,
      borderColor: colors.border,
      ...SHADOW.card,
    },
    cardActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
    cardDisabled: { backgroundColor: colors.inputBg, borderColor: colors.border, opacity: 0.6 },

    name:         { fontSize: FONT.base, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
    nameActive:   { color: '#fff' },
    textMuted:    { color: colors.textSecondary },

    capacityRow:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
    capacity:       { fontSize: 11, color: colors.textSecondary },
    capacityActive: { color: 'rgba(255,255,255,0.8)' },

    fare:        { fontSize: FONT.sm, fontWeight: '700', color: colors.textPrimary, marginTop: 6 },
    fareActive:  { color: '#fff' },
    fareOver:    { color: colors.textSecondary },
    fareLoading: { fontSize: FONT.sm, color: colors.textSecondary, marginTop: 6 },
    limitLabel:  { fontSize: 10, color: colors.danger, fontWeight: '600' },
  });
}
