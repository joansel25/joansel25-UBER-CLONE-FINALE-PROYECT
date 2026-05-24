import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
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
    const unsubscribe = onAuthStateChanged(getAuth(), async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          // Serve cached profile instantly while we fetch fresh data
          const cached = await AsyncStorage.getItem(USER_KEY);
          if (cached) setDbUser(JSON.parse(cached));

          // Fetch profile — retry once to handle the race condition where
          // onAuthStateChanged fires before the MongoDB profile is created
          let data = null;
          try {
            ({ data } = await userApi.getMe());
          } catch (firstErr) {
            console.log('[AuthContext] getMe attempt 1 failed:', firstErr.statusCode, firstErr.message);
            // Wait 2 s and retry (covers registration race condition)
            await new Promise(r => setTimeout(r, 2000));
            try {
              ({ data } = await userApi.getMe());
            } catch (secondErr) {
              console.log('[AuthContext] getMe attempt 2 failed:', secondErr.statusCode, secondErr.message);
            }
          }

          if (data) {
            setDbUser(data);
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
          } else {
            setDbUser(null);
            await AsyncStorage.removeItem(USER_KEY);
          }
        } catch {
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
    signInWithEmailAndPassword(getAuth(), email, password);

  const signOut = async () => {
    await firebaseSignOut(getAuth());
    await AsyncStorage.removeItem(USER_KEY);
    setDbUser(null);
  };

  const refreshUser = async () => {
    const { data } = await userApi.getMe();
    setDbUser(data);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
    return data;
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
