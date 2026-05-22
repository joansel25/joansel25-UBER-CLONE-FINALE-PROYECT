// Currency — Colombian Peso
export const formatCOP = (amount) =>
  new Intl.NumberFormat('es-CO', {
    style:    'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);

// Duration in minutes → "5 min" / "1 h 10 min"
export const formatDuration = (minutes) => {
  if (!minutes) return '--';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
};

// Distance in km → "1.2 km" / "800 m"
export const formatDistance = (km) => {
  if (!km) return '--';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
};

// ISO date → "22 may. 2026"
export const formatDate = (dateStr) => {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

// ISO date → "10:35 a.m."
export const formatTime = (dateStr) => {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit',
  });
};
