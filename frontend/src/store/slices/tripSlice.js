import { createSlice } from '@reduxjs/toolkit';

const tripSlice = createSlice({
  name: 'trip',
  initialState: {
    origin:      null,
    destination: null,
    estimate:    null,
    activeTrip:  null,
  },
  reducers: {
    setOrigin:      (state, action) => { state.origin      = action.payload; },
    setDestination: (state, action) => { state.destination = action.payload; },
    setEstimate:    (state, action) => { state.estimate    = action.payload; },
    setActiveTrip:  (state, action) => { state.activeTrip  = action.payload; },
    clearTrip:      (state) => {
      state.origin      = null;
      state.destination = null;
      state.estimate    = null;
      state.activeTrip  = null;
    },
  },
});

export const { setOrigin, setDestination, setEstimate, setActiveTrip, clearTrip } = tripSlice.actions;
export default tripSlice.reducer;
