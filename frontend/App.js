import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider }   from '@stripe/stripe-react-native';
import Config               from 'react-native-config';

import { AuthProvider } from './src/context/AuthContext';
import { TripProvider } from './src/context/TripContext';
import AppNavigator     from './src/navigation/AppNavigator';

function App() {
  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={Config.STRIPE_PUBLISHABLE_KEY}>
        <AuthProvider>
          <TripProvider>
            <AppNavigator />
          </TripProvider>
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}

export default App;
