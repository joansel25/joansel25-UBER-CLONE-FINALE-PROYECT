/**
 * Pruebas de inicio de sesión — LoginScreen
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../src/screens/auth/LoginScreen';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSignIn = jest.fn();

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView:    ({ children, ...p }) => <View {...p}>{children}</View>,
    SafeAreaProvider: ({ children })       => children,
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
  render(<LoginScreen navigation={mockNavigation} />);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LoginScreen — inicio de sesión', () => {
  beforeEach(() => {
    mockSignIn.mockClear();
    mockNavigation.navigate.mockClear();
  });

  test('renderiza los campos de email y contraseña', () => {
    const { getByPlaceholderText, getByText } = renderScreen();
    expect(getByPlaceholderText('ejemplo@correo.com')).toBeTruthy();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
    expect(getByText('Iniciar sesión')).toBeTruthy();
  });

  test('llama a signIn con las credenciales ingresadas', async () => {
    mockSignIn.mockResolvedValue(undefined);
    const { getByPlaceholderText, getByText } = renderScreen();

    fireEvent.changeText(
      getByPlaceholderText('ejemplo@correo.com'),
      'usuario@correo.com',
    );
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'mipassword');
    fireEvent.press(getByText('Iniciar sesión'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('usuario@correo.com', 'mipassword');
    });
  });

  test('normaliza el email a minúsculas antes de llamar signIn', async () => {
    mockSignIn.mockResolvedValue(undefined);
    const { getByPlaceholderText, getByText } = renderScreen();

    fireEvent.changeText(
      getByPlaceholderText('ejemplo@correo.com'),
      '  USUARIO@CORREO.COM  ',
    );
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'mipassword');
    fireEvent.press(getByText('Iniciar sesión'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('usuario@correo.com', 'mipassword');
    });
  });

  test('muestra error con credenciales incorrectas (auth/invalid-credential)', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/invalid-credential' });
    const { getByPlaceholderText, getByText, findByTestId } = renderScreen();

    fireEvent.changeText(
      getByPlaceholderText('ejemplo@correo.com'),
      'usuario@correo.com',
    );
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'wrongpass');
    fireEvent.press(getByText('Iniciar sesión'));

    const banner = await findByTestId('error-banner');
    expect(banner.props.children).toContain('contraseña');
  });

  test('muestra error con cuenta bloqueada (auth/too-many-requests)', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/too-many-requests' });
    const { getByPlaceholderText, getByText, findByTestId } = renderScreen();

    fireEvent.changeText(
      getByPlaceholderText('ejemplo@correo.com'),
      'usuario@correo.com',
    );
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'cualquierpass');
    fireEvent.press(getByText('Iniciar sesión'));

    const banner = await findByTestId('error-banner');
    expect(banner.props.children).toContain('bloqueada');
  });

  test('muestra mensaje genérico para errores desconocidos', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/unknown-error' });
    const { getByPlaceholderText, getByText, findByTestId } = renderScreen();

    fireEvent.changeText(
      getByPlaceholderText('ejemplo@correo.com'),
      'usuario@correo.com',
    );
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'cualquierpass');
    fireEvent.press(getByText('Iniciar sesión'));

    const banner = await findByTestId('error-banner');
    expect(banner.props.children).toBeTruthy();
  });

  test('navega a la pantalla de registro', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Crear cuenta nueva'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Register');
  });
});
