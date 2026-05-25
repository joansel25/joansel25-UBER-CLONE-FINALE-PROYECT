import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth }           from '../context/AuthContext';
import Loader                from '../components/common/Loader';
import AuthNavigator         from './AuthNavigator';
import TabNavigator          from './TabNavigator';
import DriverTabNavigator    from './DriverTabNavigator';
import RegisterScreen        from '../screens/auth/RegisterScreen';
import FollowTravelScreen    from '../screens/FollowTravelScreen';
import PaymentMethodsScreen  from '../screens/PaymentMethodsScreen';
import PaymentHistory        from '../screens/PaymentHistory';
import TripDetailScreen      from '../screens/TripDetailScreen';
import DriverRegisterScreen  from '../screens/driver/DriverRegisterScreen';

const Stack = createNativeStackNavigator();

function ProfileLoadingScreen() {
  return <Loader fullscreen />;
}

export default function AppNavigator() {
  const { firebaseUser, dbUser, loading, profileStatus } = useAuth();

  if (loading) return <Loader fullscreen />;

  const isDriver = dbUser?.role === 'driver';

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!firebaseUser ? (
          // Sin sesión → flujo de login / registro
          <Stack.Screen name="Auth" component={AuthNavigator} />

        ) : profileStatus === 'not_found' ? (
          // Cuenta Firebase existe pero SIN perfil Firestore → completar registro
          <Stack.Screen name="Register" component={RegisterScreen} />

        ) : !dbUser ? (
          // profileStatus === 'loading' aún en vuelo → mostrar loader
          <Stack.Screen name="ProfileLoading" component={ProfileLoadingScreen} />

        ) : isDriver ? (
          // App del conductor
          <>
            <Stack.Screen name="DriverMain"     component={DriverTabNavigator} />
            <Stack.Screen name="TripDetail"     component={TripDetailScreen} />
            <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <Stack.Screen name="PaymentHistory" component={PaymentHistory} />
          </>

        ) : (
          // App del pasajero
          <>
            <Stack.Screen name="Main"           component={TabNavigator} />
            <Stack.Screen name="FollowTravel"   component={FollowTravelScreen} />
            <Stack.Screen name="TripDetail"     component={TripDetailScreen} />
            <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <Stack.Screen name="PaymentHistory" component={PaymentHistory} />
            <Stack.Screen name="DriverRegister" component={DriverRegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
