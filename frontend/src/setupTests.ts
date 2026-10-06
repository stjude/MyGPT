// jest-dom adds custom vitest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest';
import './utils/runtimeConfig';

const storage = new Map<string, string>()
const localStorageMock: Storage = {
	get length() {
		return storage.size
	},
	clear: () => storage.clear(),
	getItem: (key) => storage.get(key) ?? null,
	key: (index) => Array.from(storage.keys())[index] ?? null,
	removeItem: (key) => {
		storage.delete(key)
	},
	setItem: (key, value) => {
		storage.set(key, String(value))
	},
}

Object.defineProperty(globalThis, 'localStorage', {
	configurable: true,
	value: localStorageMock,
})
