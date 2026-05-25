import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import userApi from '../api/userApi';
import logger  from '../utils/logger';

const AuthContext = createContext(null);
const USER_KEY    = '@uber_user';

// profileStatus:
//   'loading'   — verifying profile in Firestore
//   'found'     — profile exists in Firestore
//   'not_found' — Firebase user with NO Firestore profile → complete registration
export function AuthProvider({ children }) {
  const [firebaseUser,      setFirebaseUser]      = useState(null);
  const [dbUser,            setDbUser]            = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [profileStatus,     setProfileStatus]     = useState('loading');
  const [isRegistering,     setIsRegisteringState] = useState(false);

  const isRegisteringRef = useRef(false);

  const setIsRegistering = (val) => {
    isRegisteringRef.current = val;
    setIsRegisteringState(val);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), async (fbUser) => {
      logger.info('Auth', `onAuthStateChanged → ${fbUser ? fbUser.email : 'signed out'}`);
      setFirebaseUser(fbUser);

      if (fbUser) {
        setProfileStatus('loading');

        // Load cache while Firestore is queried
        try {
          const cached = await AsyncStorage.getItem(USER_KEY);
          if (cached) setDbUser(JSON.parse(cached));
        } catch { /* ignore corrupted cache */ }

        try {
          logger.step('Auth', 'Loading profile from Firestore…');
          const { data } = await userApi.getMe();
          logger.ok('Auth', `Profile found — role:${data.role}`);
          setDbUser(data);
          setProfileStatus('found');
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
        } catch (err) {
          if (err.statusCode === 404) {
            if (isRegisteringRef.current) {
              // Registration in progress → keep 'loading' until refreshUser confirms
              setProfileStatus('loading');
            } else {
              logger.info('Auth', 'No Firestore profile → complete registration');
              setDbUser(null);
              setProfileStatus('not_found');
              try { await AsyncStorage.removeItem(USER_KEY); } catch { /* ignore */ }
            }
          } else {
            logger.error('Auth', `Error loading profile: ${err.message}`);
            setDbUser(null);
            setProfileStatus('not_found');
            try { await AsyncStorage.removeItem(USER_KEY); } catch { /* ignore */ }
          }
        }
      } else {
        logger.info('Auth', 'No Firebase session — clearing state');
        setDbUser(null);
        setProfileStatus('loading');
        try { await AsyncStorage.removeItem(USER_KEY); } catch { /* ignore */ }
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = (email, password) => {
    logger.step('Auth', `signIn → ${email}`);
    return signInWithEmailAndPassword(getAuth(), email, password);
  };

  const signOut = async () => {
    logger.info('Auth', 'signOut');
    await firebaseSignOut(getAuth());
    try { await AsyncStorage.removeItem(USER_KEY); } catch { /* ignore */ }
    setDbUser(null);
    setProfileStatus('loading');
  };

  const resetPassword = (email) => {
    logger.step('Auth', `resetPassword → ${email}`);
    return sendPasswordResetEmail(getAuth(), email);
  };

  const refreshUser = async () => {
    logger.step('Auth', 'refreshUser…');
    const { data } = await userApi.getMe();
    if (!data) throw new Error('No se encontró perfil en Firestore');
    logger.ok('Auth', `refreshUser OK — role:${data.role}`);
    setDbUser(data);
    setProfileStatus('found');
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
    return data;
  };

  // Used after registration to set the profile directly without a second Firestore GET
  const forceUserFound = useCallback(async (userData) => {
    logger.ok('Auth', `forceUserFound — ${userData.email}`);
    setDbUser(userData);
    setProfileStatus('found');
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData)).catch(() => {});
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser, dbUser, loading, profileStatus,
        isRegistering, setIsRegistering,
        signIn, signOut, resetPassword, refreshUser, forceUserFound,
      }}
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
