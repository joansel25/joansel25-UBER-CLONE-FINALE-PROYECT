import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import Navigators
import TabNavigator from './TabNavigator';

// Import Screens
import ContactScreen from '../screens/ContactScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* El Stack principal carga el TabNavigator como su pantalla inicial */}
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        
        {/* Aquí agregas pantallas que NO deben tener pestañas abajo */}
        <Stack.Screen name="Contact" component={ContactScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}