/**
 * Pruebas de registro de usuario — RegisterScreen
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RegisterScreen from '../src/screens/auth/RegisterScreen';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRefreshUser      = jest.fn();
const mockForceUserFound   = jest.fn();
const mockSetIsRegistering = jest.fn();
const mockSignIn           = jest.fn().mockRejectedValue({ code: 'auth/wrong-password' });
const mockRegister         = jest.fn();
const mockCreateUser       = jest.fn();

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    refreshUser:      mockRefreshUser,
    forceUserFound:   mockForceUserFound,
    setIsRegistering: mockSetIsRegistering,
    signIn:           mockSignIn,
    signOut:          jest.fn(),
    firebaseUser:     null,
  }),
}));

jest.mock('../src/api/userApi', () => ({
  register: (...args) => mockRegister(...args),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth:                        jest.fn(() => ({ currentUser: null })),
  // Skip the first arg (auth instance) so mockCreateUser receives (email, password)
  createUserWithEmailAndPassword: (_auth, ...args) => mockCreateUser(...args),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView:      ({ children, ...p }) => <View {...p}>{children}</View>,
    SafeAreaProvider:  ({ children })        => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('../src/components/common/ErrorBanner', () => {
  const { Text } = require('react-native');
  return ({ message }) =>
    message ? <Text testID="error-banner">{message}</Text> : null;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };

const renderScreen = () =>
  render(<RegisterScreen navigation={mockNavigation} />);

// La pantalla tiene "Crear cuenta" como título Y como texto del botón.
// getAllByText devuelve ambos; el último es el botón.
const pressSubmit = (q) => {
  const matches = q.getAllByText('Crear cuenta');
  fireEvent.press(matches[matches.length - 1]);
};

const VALID_FORM = {
  fullName: 'Juan Pérez',
  email:    'juan@test.com',
  phone:    '3001234567',
  password: 'segura123',
};

const fillForm = (q, overrides = {}) => {
  const f = { ...VALID_FORM, ...overrides };
  fireEvent.changeText(q.getByPlaceholderText('Tu nombre completo'), f.fullName);
  fireEvent.changeText(q.getByPlaceholderText('usuario@correo.com'), f.email);
  fireEvent.changeText(q.getByPlaceholderText('3001234567'),         f.phone);
  const passwordInputs = q.getAllByPlaceholderText('••••••••');
  fireEvent.changeText(passwordInputs[0], f.password);
  fireEvent.changeText(passwordInputs[1], overrides.confirm ?? f.password);
};

const selectGender = (q) => {
  fireEvent.press(q.getByText('Seleccionar género'));
  fireEvent.press(q.getByText('Masculino'));
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RegisterScreen — registro de usuario', () => {
  beforeEach(() => {
    mockCreateUser.mockClear();
    mockRegister.mockClear();
    mockRefreshUser.mockClear();
    mockForceUserFound.mockClear();
    mockSetIsRegistering.mockClear();
    mockSignIn.mockClear();
    mockNavigation.navigate.mockClear();
  });

  // ── Renderizado ─────────────────────────────────────────────────────────────

  test('renderiza todos los campos del formulario', () => {
    const q = renderScreen();
    expect(q.getByPlaceholderText('Tu nombre completo')).toBeTruthy();
    expect(q.getByPlaceholderText('usuario@correo.com')).toBeTruthy();
    expect(q.getByPlaceholderText('3001234567')).toBeTruthy();
    expect(q.getAllByPlaceholderText('••••••••')).toHaveLength(2);
    // El título y el botón comparten texto — verifica que existan al menos 2
    expect(q.getAllByText('Crear cuenta').length).toBeGreaterThanOrEqual(2);
  });

  // ── Validaciones de campo ───────────────────────────────────────────────────

  test('valida que el nombre tenga mínimo 3 caracteres', async () => {
    const q = renderScreen();
    fillForm(q, { fullName: 'Ab' });
    pressSubmit(q);

    await waitFor(() => {
      expect(q.getByText('Mínimo 3 caracteres.')).toBeTruthy();
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('valida formato de email', async () => {
    const q = renderScreen();
    fillForm(q, { email: 'no-es-email' });
    pressSubmit(q);

    await waitFor(() => {
      expect(
        q.getByText('Formato inválido. Ejemplo: usuario@correo.com'),
      ).toBeTruthy();
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('valida que el teléfono tenga mínimo 7 dígitos', async () => {
    const q = renderScreen();
    fillForm(q, { phone: '123' });
    pressSubmit(q);

    await waitFor(() => {
      expect(q.getByText('Solo números, mínimo 7 dígitos.')).toBeTruthy();
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('valida que la contraseña tenga mínimo 6 caracteres', async () => {
    const q = renderScreen();
    fillForm(q, { password: '123', confirm: '123' });
    pressSubmit(q);

    await waitFor(() => {
      expect(
        q.getByText('La contraseña debe tener al menos 6 caracteres.'),
      ).toBeTruthy();
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('valida que las contraseñas coincidan', async () => {
    const q = renderScreen();
    fillForm(q, { confirm: 'diferente999' });
    pressSubmit(q);

    await waitFor(() => {
      expect(q.getByText('Las contraseñas no coinciden.')).toBeTruthy();
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('valida que se seleccione un género', async () => {
    const q = renderScreen();
    // Llenar todos los campos excepto género
    fireEvent.changeText(q.getByPlaceholderText('Tu nombre completo'), 'Juan Pérez');
    fireEvent.changeText(q.getByPlaceholderText('usuario@correo.com'), 'juan@test.com');
    fireEvent.changeText(q.getByPlaceholderText('3001234567'), '3001234567');
    const passes = q.getAllByPlaceholderText('••••••••');
    fireEvent.changeText(passes[0], 'segura123');
    fireEvent.changeText(passes[1], 'segura123');
    pressSubmit(q);

    await waitFor(() => {
      expect(q.getByText('Selecciona un género para continuar.')).toBeTruthy();
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  // ── Flujo exitoso ───────────────────────────────────────────────────────────

  test('flujo completo: crea cuenta Firebase, registra en backend y refresca usuario', async () => {
    mockCreateUser.mockResolvedValue({ user: { uid: 'firebase-uid-123' } });
    mockRegister.mockResolvedValue({ success: true });
    mockRefreshUser.mockResolvedValue({ _id: '1', email: 'juan@test.com' });

    const q = renderScreen();
    fillForm(q);
    selectGender(q);
    pressSubmit(q);

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith('juan@test.com', 'segura123');
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName:    'Juan Pérez',
          email:       'juan@test.com',
          firebaseUid: 'firebase-uid-123',
          role:        'passenger',
        }),
      );
      expect(mockForceUserFound).toHaveBeenCalled();
    });
  });

  // ── Errores de Firebase ─────────────────────────────────────────────────────

  test('muestra error si el correo ya está registrado', async () => {
    mockCreateUser.mockRejectedValue({ code: 'auth/email-already-in-use' });

    const q = renderScreen();
    fillForm(q);
    selectGender(q);
    pressSubmit(q);

    const banner = await q.findByTestId('error-banner');
    expect(banner.props.children).toContain('Ya existe una cuenta');
    expect(mockRegister).not.toHaveBeenCalled();
  });

  test('muestra error si la contraseña es muy débil (Firebase)', async () => {
    mockCreateUser.mockRejectedValue({ code: 'auth/weak-password' });

    const q = renderScreen();
    fillForm(q);
    selectGender(q);
    pressSubmit(q);

    const banner = await q.findByTestId('error-banner');
    expect(banner.props.children).toContain('débil');
  });

  // ── Navegación ──────────────────────────────────────────────────────────────

  test('navega a inicio de sesión al presionar el enlace', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Inicia sesión'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');
  });
});
