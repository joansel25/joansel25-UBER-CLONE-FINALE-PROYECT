import React, { createContext, useContext, useState } from 'react';

const TripContext = createContext(null);

export function TripProvider({ children }) {
  const [activeTrip, setActiveTrip] = useState(null);
  const [origin, setOrigin]         = useState(null);
  const [destination, setDestination] = useState(null);
  const [estimate, setEstimate]     = useState(null);

  const clearTrip = () => {
    setActiveTrip(null);
    setOrigin(null);
    setDestination(null);
    setEstimate(null);
  };

  return (
    <TripContext.Provider
      value={{
        activeTrip, setActiveTrip,
        origin, setOrigin,
        destination, setDestination,
        estimate, setEstimate,
        clearTrip,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export const useTrip = () => {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside TripProvider');
  return ctx;
};
