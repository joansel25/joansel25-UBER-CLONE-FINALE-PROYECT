import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth }              from '../context/AuthContext';
import Loader                   from '../components/common/Loader';
import AuthNavigator            from './AuthNavigator';
import TabNavigator             from './TabNavigator';
import DriverTabNavigator       from './DriverTabNavigator';
import RegisterScreen           from '../screens/auth/RegisterScreen';
import FollowTravelScreen       from '../screens/FollowTravelScreen';
import PaymentMethodsScreen     from '../screens/PaymentMethodsScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { firebaseUser, dbUser, loading } = useAuth();

  if (loading) return <Loader fullscreen />;

  const isDriver = dbUser?.role === 'driver';

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!firebaseUser ? (
          // No session → Auth flow
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !dbUser ? (
          // Firebase account exists but MongoDB profile not created yet
          <Stack.Screen name="Register" component={RegisterScreen} />
        ) : isDriver ? (
          // Driver → driver-specific tabs + shared screens
          <>
            <Stack.Screen name="DriverMain"      component={DriverTabNavigator} />
            <Stack.Screen name="PaymentMethods"  component={PaymentMethodsScreen} />
          </>
        ) : (
          // Passenger → main app
          <>
            <Stack.Screen name="Main"            component={TabNavigator} />
            <Stack.Screen name="FollowTravel"    component={FollowTravelScreen} />
            <Stack.Screen name="PaymentMethods"  component={PaymentMethodsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
