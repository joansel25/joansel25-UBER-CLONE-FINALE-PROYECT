import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth }       from '../context/AuthContext';
import Loader            from '../components/common/Loader';
import AuthNavigator     from './AuthNavigator';
import TabNavigator      from './TabNavigator';
import RegisterScreen    from '../screens/auth/RegisterScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { firebaseUser, dbUser, loading } = useAuth();

  // Hold splash until Firebase resolves the auth state
  if (loading) return <Loader fullscreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!firebaseUser ? (
          // No session → Auth flow
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !dbUser ? (
          // Firebase account exists but MongoDB profile not created yet
          <Stack.Screen name="Register" component={RegisterScreen} />
        ) : (
          // Fully authenticated → Main app
          <Stack.Screen name="Main" component={TabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
