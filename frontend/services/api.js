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
const HOSTED_BACKEND_URL = 'http://117.251.19.107:8090/api';

// ← Set to your HTTP backend URL for production

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
				return `http://${ip}:8090/api`;
			}
		}
	} catch { }

	// 4. Platform defaults (Android emulator needs 10.0.2.2)
	const host = Platform.OS === 'android' ? 'http://10.0.2.2:8090' : 'http://117.251.19.107:8090';
	return `${host}/api`;
})();

let cachedBaseUrl = null;

export const getApiBaseUrl = () => {
	// Cached override from AsyncStorage is loaded on first call via getEffectiveBaseUrlAsync
	const url = cachedBaseUrl || DEFAULT_BASE_URL;
	try { console.log('[api] API_BASE_URL:', url); } catch { }
	return url;
};

export const getEffectiveBaseUrlAsync = async () => {
	if (cachedBaseUrl) return cachedBaseUrl;
	try {
		const stored = await AsyncStorage.getItem('apiBaseUrl');
		if (stored && typeof stored === 'string' && stored.trim().length > 0) {
			cachedBaseUrl = stored.trim();
			return cachedBaseUrl;
		}
	} catch { }
	cachedBaseUrl = DEFAULT_BASE_URL;
	return cachedBaseUrl;
};

export const setApiBaseUrlAsync = async (url) => {
	cachedBaseUrl = url;
	try { await AsyncStorage.setItem('apiBaseUrl', url); } catch { }
};

// Convenience constant for modules that import it once at startup
export const API_BASE_URL = getApiBaseUrl();

// Helper to strip trailing /api when building socket root URL
const toRootUrl = (url) => url.replace(/\/?api\/?$/, '');

// Create a singleton socket connection (lazy)
let socketInstance = null;
let socketInitPromise = null;

async function getSocketAsync() {
	if (socketInstance) return socketInstance;
	if (socketInitPromise) return socketInitPromise;

	socketInitPromise = (async () => {
		try {
			const base = await getEffectiveBaseUrlAsync();
			const root = toRootUrl(base);
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
			socketInstance = { on: () => { }, off: () => { }, emit: () => { } };
		}
		return socketInstance;
	})();

	return socketInitPromise;
}

export async function reinitSocketAsync() {
	try {
		if (socketInstance && typeof socketInstance.disconnect === 'function') {
			socketInstance.disconnect();
		}
	} catch { }
	socketInstance = null;
	socketInitPromise = null;
	return getSocketAsync();
}

export const socket = (() => {
	// Backwards-compatible: return a placeholder immediately.
	// Callers that need guaranteed connection should await getSocketAsync().
	// We kick off init in the background.
	getSocketAsync();
	return {
		on: (...args) => socketInstance?.on?.(...args),
		off: (...args) => socketInstance?.off?.(...args),
		emit: (...args) => socketInstance?.emit?.(...args),
	};
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
		try { const j = await res.json(); msg = j.error || msg; } catch { }
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
		try { const j = await res.json(); msg = j.error || msg; } catch { }
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
		try { const j = await res.json(); msg = j.error || msg; } catch { }
		throw new Error(msg);
	}
	return res.json();
}

async function httpDelete(path) {
	const base = await getEffectiveBaseUrlAsync();
	const res = await fetch(`${base}${path}`, {
		method: 'DELETE',
	});
	if (!res.ok) {
		let msg = `DELETE ${path} → HTTP ${res.status}`;
		try { const j = await res.json(); msg = j.error || msg; } catch { }
		throw new Error(msg);
	}
	return res.json();
}

// ————————————————————————————————————————————————
// API surface used across the app
// ————————————————————————————————————————————————
export const apiService = {
	async getZoneByPoint(latitude, longitude) {
		const qs = new URLSearchParams({ lat: String(latitude), lng: String(longitude) }).toString();
		return httpGet(`/zones/point?${qs}`);
	},
	async getAllZones(unit = null, userId = null) {
		const params = new URLSearchParams();
		if (unit) params.append('unit', unit);
		if (userId) params.append('userId', userId);
		const qs = params.toString();
		const url = qs ? `/zones/all?${qs}` : `/zones/all`;
		const res = await httpGet(url);
		// Normalize multiple possible shapes from backend
		let circles = [];
		let polygons = [];
		if (Array.isArray(res?.circles) || Array.isArray(res?.polygons)) {
			circles = Array.isArray(res.circles) ? res.circles : [];
			polygons = Array.isArray(res.polygons) ? res.polygons : [];
		} else if (res && res.data && (Array.isArray(res.data.circles) || Array.isArray(res.data.polygons))) {
			circles = Array.isArray(res.data.circles) ? res.data.circles : [];
			polygons = Array.isArray(res.data.polygons) ? res.data.polygons : [];
		} else if (typeof res?.circles === 'number' || typeof res?.polygons === 'number') {
			// Old shape with counts only; return empty arrays so UI doesn't crash
			circles = [];
			polygons = [];
		}
		// Normalize shapes for rendering
		const normCircles = (circles || []).map(c => {
			// Skip if center is null or missing
			if (!c?.center) return null;
			const lat = Number(c.center.latitude ?? c.center.lat);
			const lng = Number(c.center.longitude ?? c.center.lng);
			// Only include if both lat and lng are valid finite numbers
			if (!isFinite(lat) || !isFinite(lng)) return null;
			return { ...c, center: { latitude: lat, longitude: lng }, radius_meters: Number(c.radius_meters || 0) };
		}).filter(Boolean);
		const normPolygons = (polygons || []).map(p => {
			const arr = Array.isArray(p?.polygon) ? p.polygon : [];
			const coords = arr.map(q => {
				if (!q) return null;
				if (Array.isArray(q) && q.length >= 2) {
					const lat = Number(q[0]);
					const lng = Number(q[1]);
					return isFinite(lat) && isFinite(lng) ? { lat, lng } : null;
				}
				const lat = Number(q.lat ?? q.latitude);
				const lng = Number(q.lng ?? q.longitude);
				return isFinite(lat) && isFinite(lng) ? { lat, lng } : null;
			}).filter(Boolean);
			// Only include center if it's valid (polygons can exist without center)
			const result = { ...p, polygon: coords };
			if (p?.center) {
				const centerLat = Number(p.center.latitude ?? p.center.lat);
				const centerLng = Number(p.center.longitude ?? p.center.lng);
				if (isFinite(centerLat) && isFinite(centerLng)) {
					result.center = { latitude: centerLat, longitude: centerLng };
				}
			}
			return result;
		});
		return { circles: normCircles, polygons: normPolygons };
	},
	async getZonesLegacyList() {
		// Fallback to legacy list endpoint which returns polygon zones
		return httpGet(`/zones`);
	},
	
	// Auth
	async login({ serviceId, password }) {
		return httpPost('/users/login', {
			username: serviceId,
			password,
		});
	},
	async register(user) {
		// Use registration-requests endpoint to store registration requests for approval
		return await httpPost('/users/registration-requests', user);
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
	async updatePushTokens({ userId, fcmToken, expoToken }) {
		return httpPut(`/users/update-tokens`, { userId, fcmToken, expoToken });
	},
	async changePassword(userId, currentPassword, newPassword) {
		return httpPost(`/users/${encodeURIComponent(userId)}/change-password`, { currentPassword, newPassword });
	},
	async getSoldiersByUnit(unit) {
		return httpGet(`/users?role=soldier&unit=${encodeURIComponent(unit)}`);
	},
	async getSoldiersByUnitId(unitId, sortBy = 'name') {
		return httpGet(`/users?role=soldier&unit_id=${encodeURIComponent(unitId)}&sortBy=${encodeURIComponent(sortBy)}`);
	},
	async getSoldiersByCommanderId(commanderId) {
		return httpGet(`/users/soldier-overview?commander_id=${encodeURIComponent(commanderId)}`);
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
	async getLatestLocation(userId) {
		return httpGet(`/locations/latest/${encodeURIComponent(userId)}`);
	},

	// Notifications / Alerts / Reports
	async getNotifications(userId) {
		try {
			// Fetch from alerts table (notifications are stored there)
			const params = userId ? { userId } : {};
			const alerts = await this.getAlerts(params);

			return (alerts || []).map(a => ({
				id: a.id,
				title: a.title || 'Alert',
				message: a.message || '',
				type: String(a.category || a.severity || 'info').toLowerCase(),
				category: a.category,
				read: Boolean(a.read),
				timestamp: a.created_at || new Date().toISOString(),
				source: 'alert',
				data: a.data,
				userId: a.user_id,
				soldierName: a.data?.soldierName || null
			}));
		} catch (error) {
			console.error('Error fetching notifications:', error);
			return [];
		}
	},
	async markNotificationAsRead(id, userId) {
		return httpPut(`/alerts/${encodeURIComponent(id)}/mark-read`, { userId });
	},
	async createNotification({ userId, title, message, type, category, priority, source, data }) {
		const resolvedCategory = category || type || 'system';
		const sev = String(priority || '').toLowerCase();
		const severity = sev === 'urgent' ? 'critical' : (sev === 'high' ? 'high' : (sev === 'low' ? 'low' : 'medium'));
		const payload = {
			category: resolvedCategory,
			message: message || title || '',
			severity,
			status: 'active',
			userId: userId || null,
			unit: null,
			data: { ...(data || {}), title: title || null, source: source || 'app' }
		};
		const resp = await httpPost('/alerts', payload);
		return resp?.alert || resp;
	},
	async deleteNotification(id) {
		// Since notifications are stored in alerts table, delete from there
		return this.deleteAlert(id);
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

	// Create simple soldier report (reuses alerts endpoint)
	async createAlert(payload) {
		return httpPost('/alerts', payload);
	},
	async deleteAlert(id) {
		return httpDelete(`/alerts/${encodeURIComponent(id)}`);
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

	// Zones (with optional unit filter for commanders)
	async getZones(unit = null, userId = null) {
		try {
			const params = new URLSearchParams();
			if (unit) params.append('unit', unit);
			if (userId) params.append('userId', userId);
			const qs = params.toString();
			const url = qs ? `/zones?${qs}` : '/zones';
			return await httpGet(url);
		} catch {
			return [];
		}
	},

	// Units
	async getUnits() {
		try {
			const units = await httpGet('/units');
			const normalized = (units || []).map(u => (typeof u === 'string' ? { id: u, name: u } : u));
			if (normalized.length > 0) return normalized;
		} catch {
			// ignore and try other sources
		}

		// Fallback 1: derive from zones (unit_name or name)
		try {
			const zones = await httpGet('/zones');
			const names = Array.from(new Set((zones || [])
				.map(z => (z?.unit_name || z?.name || '').toString().trim())
				.filter(Boolean)
			));
			if (names.length > 0) return names.map(name => ({ id: name, name }));
		} catch { }

		// Fallback 2: derive distinct units from users
		try {
			const users = await httpGet('/users');
			const distinct = Array.from(new Set((users || [])
				.map(u => (u?.unit || u?.unit_name || '').toString().trim())
				.filter(Boolean)
			));
			if (distinct.length > 0) return distinct.map(name => ({ id: name, name }));
		} catch { }

		return [];
	},
	// Locations (placeholder; backend must provide these endpoints)
	async getLocationsInRange({ startDate, endDate, userId }) {
		const qs = new URLSearchParams({ startDate, endDate, userId }).toString();
		try { return await httpGet(`/locations${qs ? `?${qs}` : ''}`); } catch { return []; }
	},

	// Health endpoints
	async getHealthVitals(userId) {
		return httpGet(`/health/vitals/${encodeURIComponent(userId)}`);
	},
	async recordHealthVitals(userId, vitals) {
		return httpPost(`/health/vitals/${encodeURIComponent(userId)}`, vitals);
	},
	async getHealthProfile(userId) {
		return httpGet(`/health/profile/${encodeURIComponent(userId)}`);
	},
	async updateHealthProfile(userId, profile) {
		return httpPut(`/health/profile/${encodeURIComponent(userId)}`, profile);
	},
	async getHealthDashboard(userId) {
		return httpGet(`/health/dashboard/${encodeURIComponent(userId)}`);
	},
	// Advanced Health Details endpoints
	async getAdvancedHealthDetails(userId) {
		return httpGet(`/health/advanced/${encodeURIComponent(userId)}`);
	},
	async updateAdvancedHealthDetails(userId, details) {
		return httpPut(`/health/advanced/${encodeURIComponent(userId)}`, details);
	},

	// Operational Details
	async getOperationalDetails(userId) {
		return httpGet(`/operational-details/${encodeURIComponent(userId)}`);
	},
	async updateOperationalDetails(userId, payload = {}) {
		return httpPut(`/operational-details/${encodeURIComponent(userId)}`, payload);
	},
	async getOperationalSkills() {
		return httpGet('/operational-details/skills');
	},

	// Vehicles
	async getVehicles(params = {}) {
		const qs = new URLSearchParams(params).toString();
		return httpGet(`/vehicles${qs ? `?${qs}` : ''}`);
	},
	async assignVehicle(payload) {
		return httpPost('/vehicles/assign', payload);
	},

	// Supply Requests - Main table for ammunition inventory and requests
	async getSupplyRequests(params = {}) {
		const qs = new URLSearchParams(params).toString();
		return httpGet(`/supply-requests${qs ? `?${qs}` : ''}`);
	},
	
	// Helper method to get approved requests (user's inventory)
	async getMyApprovedRequests(soldierId) {
		try {
			const params = new URLSearchParams({
				soldier_id: soldierId,
				status: 'approved'
			}).toString();
			return await httpGet(`/supply-requests?${params}`);
		} catch (error) {
			console.error('Error fetching approved requests:', error);
			return [];
		}
	},
	
	async createSupplyRequest({ soldier_id, type, urgency, details }) {
		return httpPost('/supply-requests', { soldier_id, type, urgency, details });
	},
	async approveSupplyRequest(id, processedBy) {
		return httpPost(`/supply-requests/${encodeURIComponent(id)}/approve`, { processed_by: processedBy });
	},
	async rejectSupplyRequest(id, processedBy) {
		return httpPost(`/supply-requests/${encodeURIComponent(id)}/reject`, { processed_by: processedBy });
	},
	
	// Damaged Requests
	async createDamagedRequest({ soldier_id, category, item_name, item_identifier, urgency, description }) {
		return httpPost('/damaged-requests', { soldier_id, category, item_name, item_identifier, urgency, description });
	},

	// Zone Breach Detection
	async checkZoneBreach(payload) {
		console.log('[API] checkZoneBreach called with payload:', payload);
		const base = await getEffectiveBaseUrlAsync();
		console.log('[API] Using base URL:', base);
		console.log('[API] Full URL will be:', `${base}/zones/check-breach`);
		return httpPost('/zones/check-breach', payload);
	},
	async getBreachStatistics() {
		return httpGet('/zones/breach-statistics');
	},
	async acknowledgeBreach(breachId) {
		return httpPost(`/zones/acknowledge-breach/${encodeURIComponent(breachId)}`);
	},
	async getZoneBreachHistory(params = {}) {
		const qs = new URLSearchParams(params).toString();
		return httpGet(`/zones/breach-history${qs ? `?${qs}` : ''}`);
	},
	async getGeoServerCapabilities() {
		const res = await fetch('http://117.251.19.107:8090/geoserver/wms?service=WMS&version=1.1.1&request=GetCapabilities');
		if (!res.ok) throw new Error('GeoServer unreachable');
		return res.text();
	},
};

export default apiService;