import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider }   from '@stripe/stripe-react-native';
import { Provider }         from 'react-redux';
import Config               from 'react-native-config';

import { AuthProvider } from './src/context/AuthContext';
import store            from './src/store';
import AppNavigator     from './src/navigation/AppNavigator';

function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StripeProvider publishableKey={Config.STRIPE_PUBLISHABLE_KEY}>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;
