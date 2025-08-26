import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';

/*
===============================================================================
BACKEND URL CONFIGURATION FOR HOSTING
===============================================================================

To use your hosted backend, you have 3 options:

1. EASIEST: Change HOSTED_BACKEND_URL below to your domain
   Example: 'https://myapp-backend.herokuapp.com/api'

2. ENVIRONMENT VARIABLE: Create frontend/.env file:
   EXPO_PUBLIC_API_BASE_URL=https://myapp-backend.herokuapp.com/api

3. RUNTIME: Use setApiBaseUrlAsync() in your app code

===============================================================================
*/

// ————————————————————————————————————————————————
// BACKEND URL CONFIGURATION
// ————————————————————————————————————————————————
// For hosting: Set your backend URL here or use environment variables
const HOSTED_BACKEND_URL = 'https://ocfa.onrender.com/api'; // ← CHANGE THIS for hosting

const DEFAULT_BASE_URL = (() => {
	// 1. Environment variable (highest priority)
	const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;
	if (envUrl && typeof envUrl === 'string') {
		return envUrl.trim();
	}

	// 2. Hosted backend URL (for production)
	if (HOSTED_BACKEND_URL) {
		return HOSTED_BACKEND_URL.trim();
	}

	// 3. Auto-detect LAN host from Expo dev environment
	try {
		const dbgHost = (Constants?.expoConfig?.hostUri || Constants?.debuggerHost || '').toString();
		if (dbgHost && dbgHost.includes(':')) {
			const ip = dbgHost.split(':')[0];
			if (ip && ip.split('.').length === 4) {
				return `http://${ip}:3001/api`;
			}
		}
	} catch {}

	// 4. Platform defaults (Android emulator needs 10.0.2.2)
	const host = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
	return `${host}/api`;
})();

let cachedBaseUrl = null;

export const getApiBaseUrl = () => {
	// Cached override from AsyncStorage is loaded on first call via getEffectiveBaseUrlAsync
	return cachedBaseUrl || DEFAULT_BASE_URL;
};

export const getEffectiveBaseUrlAsync = async () => {
	if (cachedBaseUrl) return cachedBaseUrl;
	try {
		const stored = await AsyncStorage.getItem('apiBaseUrl');
		if (stored && typeof stored === 'string' && stored.trim().length > 0) {
			cachedBaseUrl = stored.trim();
			return cachedBaseUrl;
		}
	} catch {}
	cachedBaseUrl = DEFAULT_BASE_URL;
	return cachedBaseUrl;
};

export const setApiBaseUrlAsync = async (url) => {
	cachedBaseUrl = url;
	try { await AsyncStorage.setItem('apiBaseUrl', url); } catch {}
};

// Convenience constant for modules that import it once at startup
export const API_BASE_URL = getApiBaseUrl();

// Helper to strip trailing /api when building socket root URL
const toRootUrl = (url) => url.replace(/\/?api\/?$/, '');

// Create a singleton socket connection (lazy)
let socketInstance = null;
export const socket = (() => {
	try {
		const root = toRootUrl(API_BASE_URL);
		socketInstance = io(root, {
			transports: ['websocket'],
			reconnection: true,
			reconnectionAttempts: 3, // Reduced from 5
			reconnectionDelay: 3000, // Increased from 1000ms
			reconnectionDelayMax: 10000, // Max delay between attempts
			timeout: 20000, // Connection timeout
		});
		
		// Add connection event logging (only for debugging)
		socketInstance.on('connect', () => {
			console.log('🔌 Socket connected');
		});
		
		socketInstance.on('disconnect', () => {
			console.log('🔌 Socket disconnected');
		});
		
		socketInstance.on('connect_error', (error) => {
			console.log('🔌 Socket connection error:', error.message);
		});
		
	} catch (e) {
		// Safe fallback when socket server is unavailable in dev
		socketInstance = { on: () => {}, off: () => {}, emit: () => {} };
	}
	return socketInstance;
})();

// ————————————————————————————————————————————————
// Fetch helpers
// ————————————————————————————————————————————————
async function httpGet(path) {
	const base = await getEffectiveBaseUrlAsync();
	const res = await fetch(`${base}${path}`);
	if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
	return res.json();
}

async function httpPost(path, body) {
	const base = await getEffectiveBaseUrlAsync();
	const res = await fetch(`${base}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body ?? {}),
	});
	if (!res.ok) {
		let msg = `POST ${path} → HTTP ${res.status}`;
		try { const j = await res.json(); msg = j.error || msg; } catch {}
		throw new Error(msg);
	}
	return res.json();
}

async function httpPut(path, body) {
	const base = await getEffectiveBaseUrlAsync();
	const res = await fetch(`${base}${path}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body ?? {}),
	});
	if (!res.ok) {
		let msg = `PUT ${path} → HTTP ${res.status}`;
		try { const j = await res.json(); msg = j.error || msg; } catch {}
		throw new Error(msg);
	}
	return res.json();
}

async function httpPatch(path, body) {
	const base = await getEffectiveBaseUrlAsync();
	const res = await fetch(`${base}${path}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body ?? {}),
	});
	if (!res.ok) {
		let msg = `PATCH ${path} → HTTP ${res.status}`;
		try { const j = await res.json(); msg = j.error || msg; } catch {}
		throw new Error(msg);
	}
	return res.json();
}

// ————————————————————————————————————————————————
// API surface used across the app
// ————————————————————————————————————————————————
export const apiService = {
	// Auth
	async login({ serviceId, password }) {
		return httpPost('/users/login', {
			username: serviceId,
			password,
		});
	},
	async register(user) {
		// Prefer registration-requests endpoint to store richer info
		try {
			return await httpPost('/users/registration-requests', user);
		} catch {
			return httpPost('/users/register', user);
		}
	},

	// Users
	async getAllUsers() {
		return httpGet('/users');
	},
	async getUserByUsername(username) {
		return httpGet(`/users?username=${encodeURIComponent(username)}`);
	},
	async updateUser(id, payload) {
		return httpPut(`/users/${encodeURIComponent(id)}`, payload);
	},
	async getSoldiersByUnit(unit) {
		return httpGet(`/users?role=soldier&unit=${encodeURIComponent(unit)}`);
	},
	async getAllSoldiers() {
		return httpGet('/users?role=soldier');
	},
	async getUsersByRoleAndUnit(role, unit) {
		return httpGet(`/users?role=${encodeURIComponent(role)}&unit=${encodeURIComponent(unit)}`);
	},
	async getActiveSoldiersByUnit(unit) {
		const soldiers = await this.getSoldiersByUnit(unit);
		return (soldiers || []).filter(s =>
			(String(s.status || '').toLowerCase() === 'active') || (typeof s.isOnline === 'boolean' && s.isOnline === true)
		);
	},
	async updateUserLocation(userId, latitude, longitude, heading = 0) {
		return httpPut(`/users/${encodeURIComponent(userId)}/location`, { latitude, longitude, heading });
	},
	async updateUserPhoto(userId, photoBase64OrDataUri) {
		return httpPut(`/users/${encodeURIComponent(userId)}/photo`, { photoBase64: photoBase64OrDataUri });
	},
	async getTasksForSoldier(userId) {
		return httpGet(`/users/${encodeURIComponent(userId)}/tasks`);
	},

	// Notifications / Alerts / Reports
	async getNotifications() {
		try {
			const alerts = await httpGet('/alerts');
			return (alerts || []).map(a => ({
				id: a.id ?? a.alert_id ?? Math.random().toString(36).slice(2),
				title: a.title || a.alert_type || 'Alert',
				message: a.message || a.description || '',
				type: String(a.severity || a.alert_type || 'info').toLowerCase(),
				read: false,
				timestamp: a.created_at || a.sent_at || new Date().toISOString(),
				source: 'alert',
			}));
		} catch {
			return [];
		}
	},
	async getAlerts(params = {}) {
		try {
			const qs = new URLSearchParams(params).toString();
			return await httpGet(`/alerts${qs ? `?${qs}` : ''}`);
		} catch { return []; }
	},
	async getReports() {
		try { return await httpGet('/reports'); } catch { return []; }
	},

	// Assignments
	async getAssignments(params = {}) {
		const qs = new URLSearchParams(params).toString();
		return httpGet(`/assignments${qs ? `?${qs}` : ''}`);
	},
	async getAssignmentById(id) {
		return httpGet(`/assignments/${encodeURIComponent(id)}`);
	},
	async createAssignment(payload) {
		return httpPost('/assignments', payload);
	},
	async updateAssignment(id, payload) {
		return httpPut(`/assignments/${encodeURIComponent(id)}`, payload);
	},
	async updateAssignmentStatus(id, status) {
		return httpPatch(`/assignments/${encodeURIComponent(id)}/status`, { status });
	},

	// Zones
	async getZones() {
		try { return await httpGet('/zones'); } catch { return []; }
	},
};

export default apiService;

