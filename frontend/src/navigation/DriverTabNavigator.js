import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';

import DriverHomeScreen    from '../screens/driver/DriverHomeScreen';
import TravelHistory       from '../screens/TravelHistory';
import RegisterProfileScreen from '../screens/RegisterProfileScreen';

const Tab = createBottomTabNavigator();

export default function DriverTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: { paddingBottom: 5, height: 60 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            DriverHome: focused ? 'car'    : 'car-outline',
            History:    focused ? 'time'   : 'time-outline',
            Profile:    focused ? 'person' : 'person-outline',
          };
          return <Icon name={icons[route.name] ?? 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{ title: 'Inicio' }}
      />
      <Tab.Screen
        name="History"
        component={TravelHistory}
        options={{ title: 'Historial' }}
      />
      <Tab.Screen
        name="Profile"
        component={RegisterProfileScreen}
        options={{ title: 'Perfil' }}
      />
    </Tab.Navigator>
  );
}
