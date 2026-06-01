import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@app_theme';

const LIGHT = {
  primary:      '#007AFF',
  primaryLight: '#E3F2FD',
  success:      '#34C759',
  danger:       '#FF3B30',
  warning:      '#FF9500',
  dark:         '#1a1a1a',
  gray:         '#666',
  lightGray:    '#f0f0f0',
  border:       '#ddd',
  inputBg:      '#f9f9f9',
  white:        '#fff',
  black:        '#000',
  infoBox:      '#E3F2FD',
  infoBorder:   '#007AFF',
  card:         '#ffffff',
  background:   '#F5F7FA',
  surface:      '#ffffff',
  textPrimary:  '#1a1a1a',
  textSecondary:'#666666',
  mapStyle:     null,
};

const DARK = {
  primary:      '#3B9EFF',
  primaryLight: '#1A2A3F',
  success:      '#30D158',
  danger:       '#FF453A',
  warning:      '#FFD60A',
  dark:         '#F2F2F7',
  gray:         '#8E8E93',
  lightGray:    '#2C2C2E',
  border:       '#38383A',
  inputBg:      '#1C1C1E',
  white:        '#1C1C1E',
  black:        '#FFFFFF',
  infoBox:      '#1A2A3F',
  infoBorder:   '#3B9EFF',
  card:         '#2C2C2E',
  background:   '#000000',
  surface:      '#1C1C1E',
  textPrimary:  '#F2F2F7',
  textSecondary:'#8E8E93',
  mapStyle: [
    { elementType: 'geometry',        stylers: [{ color: '#212121' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'road',            elementType: 'geometry',        stylers: [{ color: '#373737' }] },
    { featureType: 'road',            elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
    { featureType: 'water',           elementType: 'geometry',        stylers: [{ color: '#000000' }] },
    { featureType: 'water',           elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
    { featureType: 'poi',             stylers: [{ visibility: 'off' }] },
    { featureType: 'transit',         stylers: [{ visibility: 'off' }] },
  ],
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(val => { if (val === 'dark') setIsDark(true); })
      .catch(() => {});
  }, []);

  function toggleTheme() {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  }

  const colors = isDark ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export { LIGHT, DARK };
