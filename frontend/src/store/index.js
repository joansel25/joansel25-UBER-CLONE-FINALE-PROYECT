import { configureStore } from '@reduxjs/toolkit';
import tripReducer from './slices/tripSlice';

const store = configureStore({
  reducer: {
    trip: tripReducer,
  },
});

export default store;
