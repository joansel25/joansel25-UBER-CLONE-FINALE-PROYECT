import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth }           from '../context/AuthContext';
import Loader                from '../components/common/Loader';
import AuthNavigator         from './AuthNavigator';
import TabNavigator          from './TabNavigator';
import RegisterScreen        from '../screens/auth/RegisterScreen';
import FollowTravelScreen    from '../screens/FollowTravelScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { firebaseUser, dbUser, loading } = useAuth();

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
          <>
            <Stack.Screen name="Main"        component={TabNavigator} />
            <Stack.Screen name="FollowTravel" component={FollowTravelScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
