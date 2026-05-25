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
//   'loading'   — verificando perfil en Firestore
//   'found'     — perfil existe en Firestore
//   'not_found' — usuario Firebase SIN perfil Firestore → completar registro
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

        // Cargar caché mientras se consulta Firestore
        try {
          const cached = await AsyncStorage.getItem(USER_KEY);
          if (cached) setDbUser(JSON.parse(cached));
        } catch { /* ignora cache corrupta */ }

        try {
          logger.step('Auth', 'Cargando perfil desde Firestore…');
          const { data } = await userApi.getMe();
          logger.ok('Auth', `Perfil encontrado — role:${data.role}`);
          setDbUser(data);
          setProfileStatus('found');
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
        } catch (err) {
          if (err.statusCode === 404) {
            if (isRegisteringRef.current) {
              // Registro en curso → mantener 'loading' hasta que refreshUser lo confirme
              setProfileStatus('loading');
            } else {
              logger.info('Auth', 'Sin perfil Firestore → completar registro');
              setDbUser(null);
              setProfileStatus('not_found');
              await AsyncStorage.removeItem(USER_KEY);
            }
          } else {
            logger.error('Auth', `Error al cargar perfil: ${err.message}`);
            // Error inesperado → limpiar caché y pedir al usuario que registre
            setDbUser(null);
            setProfileStatus('not_found');
            await AsyncStorage.removeItem(USER_KEY);
          }
        }
      } else {
        logger.info('Auth', 'Sin sesión Firebase — limpiando estado');
        setDbUser(null);
        setProfileStatus('loading');
        await AsyncStorage.removeItem(USER_KEY);
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
    await AsyncStorage.removeItem(USER_KEY);
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
