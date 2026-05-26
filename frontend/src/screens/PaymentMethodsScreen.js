import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import paymentApi   from '../api/paymentApi';
import ErrorBanner  from '../components/common/ErrorBanner';
import { useTranslation } from '../hooks/useTranslation';
import { COLORS, SPACING, FONT, RADIUS, SHADOW } from '../constants/theme';

// Brand icon names (Ionicons doesn't have card brand icons, use generic card icon)
const BRAND_LABELS = {
  visa:       'Visa',
  mastercard: 'Mastercard',
  amex:       'American Express',
  discover:   'Discover',
};

export default function PaymentMethodsScreen({ navigation }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { t } = useTranslation();

  const [cards,      setCards]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [adding,     setAdding]     = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error,      setError]      = useState('');

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await paymentApi.listCards();
      setCards(res.data ?? []);
    } catch {
      setError(t('pay_methods_load_err'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Reload every time the screen comes into focus
  // Wrapped in useCallback so useFocusEffect receives a non-async callback (no Promise returned)
  useFocusEffect(
    useCallback(() => { loadCards(); }, [loadCards])
  );

  const handleAddCard = async () => {
    setAdding(true);
    setError('');
    try {
      // 1. Get SetupIntent client secret from backend
      const res = await paymentApi.setupCard();
      const { clientSecret } = res.data;

      // 2. Initialize Stripe PaymentSheet in SetupIntent mode
      const { error: initError } = await initPaymentSheet({
        setupIntentClientSecret: clientSecret,
        merchantDisplayName:     'UberApp',
        style:                   'automatic',
      });
      if (initError) throw new Error(initError.message);

      // 3. Present the sheet — user enters card details
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          setError(t('pay_methods_add_err'));
        }
        return;
      }

      // 4. Reload cards list
      await loadCards();
    } catch (err) {
      setError(err.message ?? 'Error al agregar tarjeta.');
    } finally {
      setAdding(false);
    }
  };

  const confirmDelete = (card) => {
    Alert.alert(
      t('pay_methods_del_title'),
      t('pay_methods_del_msg', BRAND_LABELS[card.brand] ?? card.brand, card.last4),
      [
        { text: t('pay_methods_del_cancel'), style: 'cancel' },
        {
          text: t('pay_methods_del_btn'),
          style: 'destructive',
          onPress: () => handleDeleteCard(card.id),
        },
      ],
    );
  };

  const handleDeleteCard = async (pmId) => {
    setDeletingId(pmId);
    setError('');
    try {
      await paymentApi.deleteCard(pmId);
      setCards(prev => prev.filter(c => c.id !== pmId));
    } catch {
      setError(t('pay_methods_del_err'));
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderCard = ({ item }) => (
    <View style={styles.cardRow}>
      <View style={styles.cardIcon}>
        <Icon name="card" size={22} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardBrand}>
          {BRAND_LABELS[item.brand] ?? item.brand}  ****{item.last4}
        </Text>
        <Text style={styles.cardExpiry}>
          {t('pay_methods_expires')} {String(item.expMonth).padStart(2, '0')}/{item.expYear}
        </Text>
      </View>
      {deletingId === item.id
        ? <ActivityIndicator size="small" color={COLORS.danger} />
        : (
          <TouchableOpacity
            onPress={() => confirmDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="trash-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        )
      }
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('pay_methods_title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {/* ── Stripe test mode hint ── */}
      <View style={styles.testBanner}>
        <Icon name="information-circle-outline" size={14} color="#666" />
        <Text style={styles.testBannerText}>
          {t('pay_methods_test')}
        </Text>
      </View>

      {/* ── Card list ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="card-outline" size={56} color={COLORS.border} />
              <Text style={styles.emptyTitle}>{t('pay_methods_empty')}</Text>
              <Text style={styles.emptySubtitle}>{t('pay_methods_empty_sub')}</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* ── Add card button ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.addBtn, adding && styles.addBtnDisabled]}
          onPress={handleAddCard}
          disabled={adding}
          activeOpacity={0.85}
        >
          {adding
            ? <ActivityIndicator color={COLORS.white} size="small" />
            : <>
                <Icon name="add-circle-outline" size={20} color={COLORS.white} />
                <Text style={styles.addBtnText}>{t('pay_methods_add')}</Text>
              </>
          }
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  title:   { fontSize: FONT.lg, fontWeight: '800', color: COLORS.dark },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: SPACING.md, flexGrow: 1 },

  cardRow: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    flexDirection: 'row', alignItems: 'center', padding: SPACING.md,
    gap: SPACING.sm, ...SHADOW.card,
  },
  cardIcon:   {
    width: 44, height: 44, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  cardBrand:  { fontSize: FONT.base, fontWeight: '700', color: COLORS.dark },
  cardExpiry: { fontSize: FONT.sm, color: COLORS.gray, marginTop: 2 },

  separator: { height: SPACING.sm },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, gap: SPACING.sm,
  },
  emptyTitle:    { fontSize: FONT.lg, fontWeight: '800', color: COLORS.dark },
  emptySubtitle: {
    fontSize: FONT.sm, color: COLORS.gray,
    textAlign: 'center', paddingHorizontal: SPACING.lg,
  },

  testBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF8E1', paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#FFE082',
  },
  testBannerText: { flex: 1, fontSize: 11, color: '#666' },

  footer: { padding: SPACING.md, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border },
  addBtn: {
    backgroundColor: COLORS.primary, height: 52, borderRadius: RADIUS.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText:     { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
});
