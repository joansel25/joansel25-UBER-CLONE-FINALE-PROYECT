import React, { createContext, useContext, useState, useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import userApi from '../api/userApi';

const AuthContext = createContext(null);

const USER_KEY = '@uber_user';

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [dbUser, setDbUser]             = useState(null);
  const [loading, setLoading]           = useState(true);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          // Try cached profile first for instant load
          const cached = await AsyncStorage.getItem(USER_KEY);
          if (cached) setDbUser(JSON.parse(cached));

          // Always refresh from backend
          const res = await userApi.getMe();
          const userData = res.data.data;
          setDbUser(userData);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
        } catch {
          // If backend call fails (e.g. user not registered yet), keep null
          setDbUser(null);
        }
      } else {
        setDbUser(null);
        await AsyncStorage.removeItem(USER_KEY);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = (email, password) =>
    auth().signInWithEmailAndPassword(email, password);

  const signOut = async () => {
    await auth().signOut();
    await AsyncStorage.removeItem(USER_KEY);
    setDbUser(null);
  };

  const refreshUser = async () => {
    const res = await userApi.getMe();
    const userData = res.data.data;
    setDbUser(userData);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
    return userData;
  };

  return (
    <AuthContext.Provider
      value={{ firebaseUser, dbUser, loading, signIn, signOut, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
