/**
 * El render completo del App requiere módulos nativos (Stripe, Firebase, Maps)
 * no disponibles en entorno Jest. Los tests funcionales están en LoginScreen.test.js
 * y RegisterScreen.test.js.
 */
test('placeholder — módulos nativos no disponibles en Jest', () => {
  expect(true).toBe(true);
});
