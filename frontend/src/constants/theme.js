// Visual design tokens — match Carlos's existing palette exactly
export const COLORS = {
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
};

export const SPACING = {
  xs:  5,
  sm:  10,
  md:  20,
  lg:  25,
  xl:  32,
};

export const RADIUS = {
  sm:  8,
  md:  12,
  lg:  16,
  full: 999,
};

export const FONT = {
  sm:   12,
  base: 14,
  md:   16,
  lg:   18,
  xl:   22,
  xxl:  28,
};

export const SHADOW = {
  card: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius:  4,
    elevation:     2,
  },
};
