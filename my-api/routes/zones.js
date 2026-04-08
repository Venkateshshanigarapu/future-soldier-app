const express = require('express');
const router = express.Router();
const db = require('../db');

// Simple test route
router.get('/test', (req, res) => {
  console.log('Zones test endpoint hit');
  res.json({ message: 'Zones router is working', timestamp: new Date().toISOString() });
});

// Ensure zones table exists (self-healing if missing)
async function ensureZonesTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS zones (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        zone_type VARCHAR(50) NOT NULL,
        center_lat DECIMAL(10, 8) NOT NULL,
        center_lng DECIMAL(11, 8) NOT NULL,
        radius_meters INTEGER NOT NULL,
        unit VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (_) { }
}

// ---- Data access helpers: support both schemas (zones | geofences) ----
async function fetchZonesFromZonesTable(unit = null, userId = null) {
  try {
    let query = 'SELECT id, name, description, zone_type, center_lat, center_lng, radius_meters, unit, is_active FROM zones WHERE is_active = true';
    const params = [];

    if (userId) {
      // Get user role
      const userRes = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
      const role = userRes.rows[0]?.role?.toLowerCase() || 'soldier';

      if (role === 'commander') {
        query += ' AND unit IN (SELECT name FROM units WHERE id IN (SELECT unit_id FROM commander_unit_mappings WHERE commander_id = $1))';
      } else {
        // Soldier or others: use soldier_unit_mappings
        query += ' AND unit IN (SELECT name FROM units WHERE id IN (SELECT unit_id FROM soldier_unit_mappings WHERE soldier_id = $1))';
      }
      params.push(userId);
    } else if (unit) {
      query += ' AND LOWER(unit) = LOWER($1)';
      params.push(unit.toString().trim());
    }

    const result = await db.query(query, params);
    return (result.rows || []).map(z => {
      // Safely parse center coordinates - handle null/undefined values
      const lat = z.center_lat != null ? parseFloat(z.center_lat) : null;
      const lng = z.center_lng != null ? parseFloat(z.center_lng) : null;
      const center = (lat != null && lng != null && isFinite(lat) && isFinite(lng))
        ? { latitude: lat, longitude: lng }
        : null;

      return {
        id: z.id,
        name: z.name,
        description: z.description,
        zone_type: z.zone_type,
        center: center, // Only set if valid, otherwise null
        radius_meters: Number(z.radius_meters) || 0,
        unit: z.unit,
        is_active: z.is_active,
      };
    });
  } catch (err) {
    if (err && err.code === '42P01') return null; // table not found
    throw err;
  }
}

async function fetchZonesFromGeofencesTable(unit = null, userId = null) {
  try {
    // Try permutations: table names [geofences|geofence], center columns [center_latitude/center_longitude | center_lat/center_lng], polygon column [points|polygon|coordinates]
    const tableNames = ['geofences', 'geofence'];
    const centerVariants = [
      { lat: 'center_latitude', lng: 'center_longitude' },
      { lat: 'center_lat', lng: 'center_lng' },
    ];
    const polyCols = ['new_points', 'points', 'polygon', 'coordinates'];

    for (const tbl of tableNames) {
      for (const c of centerVariants) {
        for (const pcol of polyCols) {
          try {
            let query = `SELECT id, name, ${c.lat} as latc, ${c.lng} as lngc, ${pcol} as poly, type, level, unit_name FROM ${tbl} WHERE status = 'active'`;
            const params = [];

            if (unit) {
              query += ` AND LOWER(unit_name) = LOWER($1)`;
              params.push(unit.toString().trim());
            } else if (userId) {
              // Get user role
              const userRes = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
              const role = userRes.rows[0]?.role?.toLowerCase() || 'soldier';

              if (role === 'commander') {
                query += ' AND unit_id IN (SELECT unit_id FROM commander_unit_mappings WHERE commander_id = $1)';
              } else {
                query += ' AND unit_id IN (SELECT unit_id FROM soldier_unit_mappings WHERE soldier_id = $1)';
              }
              params.push(userId);
            }

            const r = await db.query(query, params);
            const rows = r.rows || [];
            if (rows.length === 0) continue;
            return rows.map(gf => {
              let coords = [];
              try { coords = Array.isArray(gf.poly) ? gf.poly : JSON.parse(gf.poly || '[]'); } catch { coords = []; }

              // Safely parse center coordinates - handle null/undefined values
              const lat = gf.latc != null ? parseFloat(gf.latc) : null;
              const lng = gf.lngc != null ? parseFloat(gf.lngc) : null;
              const center = (lat != null && lng != null && isFinite(lat) && isFinite(lng))
                ? { latitude: lat, longitude: lng }
                : null;

              return {
                id: gf.id,
                name: gf.name,
                description: gf.level || null,
                zone_type: gf.type || 'operation',
                center: center, // Only set if valid, otherwise null
                polygon: coords,
                radius_meters: 0,
                unit: gf.unit_name || null,
                is_active: true,
              };
            });
          } catch (err) {
            // 42P01: undefined_table, 42703: undefined_column — try next variant
            if (!err || (err.code !== '42P01' && err.code !== '42703')) throw err;
          }
        }
      }
    }
    // None available
    return null;
  } catch (err) {
    if (err && err.code === '42P01') return null; // table not found
    throw err;
  }
}

async function fetchAllZonesUnified(unit = null, userId = null) {
  // Prefer zones table; if empty or missing, include geofences
  const zonesV2 = await fetchZonesFromZonesTable(unit, userId);
  const geofences = await fetchZonesFromGeofencesTable(unit, userId);
  if (Array.isArray(zonesV2) && zonesV2.length > 0) {
    // Merge any geofences too (optional)
    if (Array.isArray(geofences) && geofences.length > 0) {
      return [...zonesV2, ...geofences];
    }
    return zonesV2;
  }
  // zones table missing or empty → use geofences if available
  return Array.isArray(geofences) ? geofences : [];
}

// Create a new zone (circular) in zones table
router.post('/', async (req, res) => {
  try {
    await ensureZonesTable();
    const { name, description, zone_type, center, radius_meters, unit } = req.body || {};
    if (!name || !zone_type || !center || typeof radius_meters !== 'number') {
      return res.status(400).json({ error: 'name, zone_type, center, radius_meters are required' });
    }
    const result = await db.query(
      `INSERT INTO zones (name, description, zone_type, center_lat, center_lng, radius_meters, unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, description || null, zone_type, Number(center.latitude), Number(center.longitude), radius_meters, unit || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating zone:', err);
    res.status(500).json({ error: 'Failed to create zone' });
  }
});

// Quick debug endpoint to inspect what the API sees
router.get('/debug', async (req, res) => {
  try {
    const z = await fetchZonesFromZonesTable();
    const g = await fetchZonesFromGeofencesTable();
    res.json({ zones_table_count: Array.isArray(z) ? z.length : null, geofences_count: Array.isArray(g) ? g.length : null, sample_zone: (z && z[0]) || null, sample_geofence: (g && g[0]) || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List all zones (with optional unit/user filter)
router.get('/', async (req, res) => {
  try {
    await ensureZonesTable();
    const { unit, userId } = req.query; // Optional filters
    console.log(`[Zones] GET /zones - unit: ${unit || 'NONE'}, userId: ${userId || 'NONE'}`);

    let zones = await fetchAllZonesUnified(unit, userId);
    console.log(`[Zones] Total zones fetched from database:`, zones?.length || 0);

    // Filter by unit if provided (case-insensitive exact match)
    if (unit) {
      const unitLower = (unit || '').toString().trim().toLowerCase();
      console.log(`[Zones] Filtering zones by unit "${unit}" (normalized: "${unitLower}")`);

      zones = (zones || []).filter(z => {
        const zoneUnit = (z.unit || '').toString().trim().toLowerCase();
        const matches = zoneUnit === unitLower;
        if (!matches && zones.length < 20) { // Only log if not too many zones
          console.log(`[Zones] Zone "${z.name}" (unit: "${z.unit}") does NOT match "${unit}"`);
        }
        return matches;
      });
      console.log(`[Zones] ✅ Filtered zones by unit "${unit}": ${zones.length} zones found`);
    } else {
      console.log(`[Zones] No unit filter provided, returning all zones`);
    }

    // Return in LEGACY format expected by frontend GeospatialScreen: array with optional `coordinates` for polygons
    const legacy = (zones || []).map(z => {
      // Map polygon points to { latitude, longitude } when available
      let coordinates = undefined;
      if (Array.isArray(z.polygon) && z.polygon.length >= 3) {
        coordinates = z.polygon
          .map(p => {
            const lat = Number(p.lat ?? p.latitude);
            const lng = Number(p.lng ?? p.longitude);
            if (!isFinite(lat) || !isFinite(lng)) return null;
            return { latitude: lat, longitude: lng };
          })
          .filter(Boolean);
      }

      // Validate and normalize center data
      let center = null;
      if (z.center && typeof z.center === 'object' && z.center !== null) {
        const lat = Number(z.center.lat ?? z.center.latitude);
        const lng = Number(z.center.lng ?? z.center.longitude);
        if (isFinite(lat) && isFinite(lng)) {
          center = { latitude: lat, longitude: lng };
        } else {
          console.log(`[Zones] Zone "${z.name}" has invalid center data:`, z.center);
        }
      } else {
        if (!z.center) {
          console.log(`[Zones] Zone "${z.name}" has no center data`);
        }
      }

      // If center is invalid but we have polygon coordinates, calculate center from coordinates
      if (!center && coordinates && coordinates.length > 0) {
        const sumLat = coordinates.reduce((sum, c) => sum + c.latitude, 0);
        const sumLng = coordinates.reduce((sum, c) => sum + c.longitude, 0);
        center = {
          latitude: sumLat / coordinates.length,
          longitude: sumLng / coordinates.length
        };
        console.log(`[Zones] ✅ Calculated center from polygon for zone "${z.name}":`, center);
      }

      // Fallback: If zone name or unit is "Hyderabad" and no valid center, use Hyderabad coordinates
      if (!center && (z.name === 'Hyderabad' || z.unit === 'Hyderabad' || z.unit_name === 'Hyderabad')) {
        center = { latitude: 17.3850, longitude: 78.4867 }; // Hyderabad city center
        console.log(`[Zones] ✅ Using fallback Hyderabad coordinates for zone "${z.name}"`);
      }

      return {
        id: z.id,
        name: z.name,
        unit_name: z.unit,
        ...(center ? { center } : {}), // Only include center if valid
        radius_meters: z.radius_meters,
        // Only include coordinates when polygon exists (legacy clients expect this key for polygons)
        ...(coordinates ? { coordinates } : {}),
      };
    });
    res.json(legacy);
  } catch (err) {
    if (err && err.code === '42P01') { // undefined_table
      await ensureZonesTable();
      return res.json([]);
    }
    console.error('Error fetching zones:', err);
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
});

// Legacy alias for all zones to match frontend expectations
router.get('/all', async (req, res) => {
  try {
    await ensureZonesTable();
    const { unit, userId } = req.query;
    const zones = await fetchAllZonesUnified(unit, userId);

    // Filter circles: must have valid center with latitude/longitude and positive radius
    const circles = (zones || []).filter(z => {
      if (!z || !z.center) return false;
      const lat = z.center.latitude ?? z.center.lat;
      const lng = z.center.longitude ?? z.center.lng;
      return lat != null && lng != null &&
        typeof lat === 'number' && typeof lng === 'number' &&
        isFinite(lat) && isFinite(lng) &&
        typeof z.radius_meters === 'number' && z.radius_meters > 0;
    }).map(z => ({
      id: z.id,
      name: z.name,
      center: {
        latitude: Number(z.center.latitude ?? z.center.lat),
        longitude: Number(z.center.longitude ?? z.center.lng)
      },
      radius_meters: z.radius_meters,
      unit: z.unit,
      zone_type: z.zone_type,
      is_active: z.is_active,
    }));

    // Filter polygons: must have valid polygon array with at least 3 points
    const polygons = (zones || []).filter(z => {
      if (!z || !Array.isArray(z.polygon) || z.polygon.length < 3) return false;
      // If center exists, validate it; otherwise polygon is still valid
      if (z.center) {
        const lat = z.center.latitude ?? z.center.lat;
        const lng = z.center.longitude ?? z.center.lng;
        // Center is optional for polygons, but if present must be valid
        if (lat != null || lng != null) {
          return (lat == null || (typeof lat === 'number' && isFinite(lat))) &&
            (lng == null || (typeof lng === 'number' && isFinite(lng)));
        }
      }
      return true; // Polygon is valid even without center
    }).map(z => {
      const result = {
        id: z.id,
        name: z.name,
        polygon: z.polygon,
        unit: z.unit,
        zone_type: z.zone_type,
        is_active: z.is_active,
      };
      // Only include center if it's valid
      if (z.center) {
        const lat = z.center.latitude ?? z.center.lat;
        const lng = z.center.longitude ?? z.center.lng;
        if (lat != null && lng != null &&
          typeof lat === 'number' && typeof lng === 'number' &&
          isFinite(lat) && isFinite(lng)) {
          result.center = {
            latitude: Number(lat),
            longitude: Number(lng)
          };
        }
      }
      return result;
    });

    // Return arrays directly to match frontend expectations
    res.json({ circles, polygons });
  } catch (err) {
    if (err && err.code === '42P01') {
      await ensureZonesTable();
      return res.json({ circles: [], polygons: [] });
    }
    console.error('Error fetching zones(all):', err);
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
});

// Point-in-circle check for simple circular zones
const isPointInsideCircle = (lat, lng, centerLat, centerLng, radiusMeters) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(centerLat - lat);
  const dLng = toRad(centerLng - lng);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat)) * Math.cos(toRad(centerLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;
  return dist <= radiusMeters;
};

// Lookup zone by a point (lat,lng)
router.get('/point', async (req, res) => {
  try {
    await ensureZonesTable();
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (!isFinite(lat) || !isFinite(lng)) {
      return res.status(400).json({ error: 'Invalid lat/lng' });
    }
    // Try zones table (circular)
    let zone = null;
    const zonesV2 = await fetchZonesFromZonesTable();
    if (Array.isArray(zonesV2) && zonesV2.length > 0) {
      const match = zonesV2.find(z => typeof z.radius_meters === 'number' && isPointInsideCircle(lat, lng, z.center.latitude, z.center.longitude, z.radius_meters));
      if (match) zone = match;
    }
    // Fallback to geofences (polygon)
    if (!zone) {
      const geofences = await fetchZonesFromGeofencesTable();
      if (Array.isArray(geofences) && geofences.length > 0) {
        const polyHit = geofences.find(g => Array.isArray(g.polygon) && g.polygon.length >= 3 && pointInPolygon({ lat, lng }, g.polygon));
        if (polyHit) zone = polyHit;
      }
    }
    res.json(zone);
  } catch (err) {
    if (err && err.code === '42P01') {
      await ensureZonesTable();
      return res.json(null);
    }
    console.error('Error fetching zone by point:', err);
    res.status(500).json({ error: 'Failed to fetch zone by point' });
  }
});

// Test endpoint to verify zones router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Zones router is working', timestamp: new Date().toISOString() });
});

// Debug endpoint for zone membership
router.get('/membership', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const result = await db.query(`
      SELECT zm.*, z.name as zone_name, z.zone_type, u.username, u.unit
      FROM zone_membership zm
      LEFT JOIN zones z ON zm.zone_id = z.id
      LEFT JOIN users u ON zm.user_id = u.id
      WHERE zm.user_id = $1
      ORDER BY zm.last_event_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching zone membership:', err);
    res.status(500).json({ error: 'Failed to fetch zone membership' });
  }
});

// Zone breach detection and notification system with transition tracking
router.post('/check-breach', async (req, res) => {
  console.log('Zone breach check endpoint hit:', req.body);
  try {
    await ensureZonesTable();
    const { user_id, latitude, longitude, heading } = req.body;

    if (!user_id || !latitude || !longitude) {
      return res.status(400).json({ error: 'user_id, latitude, longitude are required' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (!isFinite(lat) || !isFinite(lng)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Get all active zones
    const zones = await fetchAllZonesUnified();
    const userRes = await db.query('SELECT username, role, unit FROM users WHERE id = $1', [user_id]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];
    const transitions = [];
    const COOLDOWN_MINUTES = 2; // Prevent spam notifications

    // Aggregated Safety Check Logic
    let isInsideAnyAssignedZone = false;
    let currentlyInsideZones = [];
    const assignedZones = zones.filter(z => z.unit === null || z.unit === user.unit);

    // First pass: Determine current physical state
    for (const zone of assignedZones) {
      let isInside = false;
      if (zone.radius_meters > 0) {
        isInside = isPointInsideCircle(lat, lng, zone.center.latitude, zone.center.longitude, zone.radius_meters);
      } else if (Array.isArray(zone.polygon) && zone.polygon.length >= 3) {
        isInside = pointInPolygon({ lat, lng }, zone.polygon);
      }

      if (isInside) {
        isInsideAnyAssignedZone = true;
        currentlyInsideZones.push(zone.name);
      }
    }

    // unauthorized zones check (independent of global safety)
    const unauthorizedZones = zones.filter(z => z.unit !== null && z.unit !== user.unit);
    for (const zone of unauthorizedZones) {
      let isInside = false;
      if (zone.radius_meters > 0) {
        isInside = isPointInsideCircle(lat, lng, zone.center.latitude, zone.center.longitude, zone.radius_meters);
      } else if (Array.isArray(zone.polygon) && zone.polygon.length >= 3) {
        isInside = pointInPolygon({ lat, lng }, zone.polygon);
      }

      if (isInside) {
        // Ensure we don't spam: check last state
        const membershipRes = await db.query(`SELECT last_state, last_push_at FROM zone_membership WHERE user_id = $1 AND zone_id = $2`, [user_id, zone.id]);
        const lastState = membershipRes.rows[0]?.last_state || 'unknown';
        const lastPushAt = membershipRes.rows[0]?.last_push_at;

        if (lastState !== 'unauthorized_inside' || (lastPushAt && (new Date() - new Date(lastPushAt)) / 60000 >= COOLDOWN_MINUTES)) {
          // Trigger Unauthorized Alert
          const message = `Soldier ${user.username} has entered unauthorized zone "${zone.name}"`;
          // ... (Log alert and update DB logic similarly) ...
          await db.query(`
                INSERT INTO zone_membership (user_id, zone_id, last_state, last_event_at, last_push_at, last_state_change_at)
                VALUES ($1, $2, 'unauthorized_inside', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, zone_id) DO UPDATE SET last_state = 'unauthorized_inside', last_event_at = CURRENT_TIMESTAMP, last_push_at = CURRENT_TIMESTAMP
              `, [user_id, zone.id]);

          const alertResult = await db.query(`
                INSERT INTO alerts (category, message, severity, status, user_id, unit, created_at, data)
                VALUES ('zone_breach', $1, 'critical', 'active', $2, $3, CURRENT_TIMESTAMP, $4) RETURNING *
              `, [message, user_id, user.unit, { type: 'zone_breach', zoneId: String(zone.id), zoneName: zone.name, severity: 'critical', requiresAction: true }]);

          // Emit socket
          const io = req.app.get('io');
          if (io) io.emit('zoneTransition', { alertId: alertResult.rows[0].id, soldierId: user_id, event: 'zone_breach', severity: 'critical' });
        }
      } else {
        // Left unauthorized zone
        await db.query(`UPDATE zone_membership SET last_state = 'outside' WHERE user_id = $1 AND zone_id = $2 AND last_state = 'unauthorized_inside'`, [user_id, zone.id]);
      }
    }

    // Global Safety State Management
    // We store a virtual zone_id '0' or a specific user_status table for global safety
    // For now, we can infer "Was Safe" by checking if any assigned zone had 'inside' state recently?
    // Better: Query all assigned zone memberships for this user.
    const membershipsRes = await db.query(`
      SELECT zm.zone_id, zm.last_state 
      FROM zone_membership zm
      JOIN zones z ON zm.zone_id = z.id
      WHERE zm.user_id = $1 AND (z.unit IS NULL OR z.unit = $2)
    `, [user_id, user.unit]);

    // Determine if user WAS inside any assigned zone previously
    const wasInsideAny = membershipsRes.rows.some(r => r.last_state === 'inside');

    // console.log(`[BreachCheck] User ${user.username}: WasInside=${wasInsideAny}, IsInside=${isInsideAnyAssignedZone}`);

    let globalEvent = null;

    if (wasInsideAny && !isInsideAnyAssignedZone) {
      // Transition: Safe -> Unsafe (Warning/Critical)
      globalEvent = 'zone_breach';
    } else if (!wasInsideAny && isInsideAnyAssignedZone) {
      // Transition: Unsafe -> Safe
      globalEvent = 'zone_return';
    }

    // Update individual zone statuses in DB to keep state consistent
    for (const zone of assignedZones) {
      let isInsideThis = false;
      if (zone.radius_meters > 0) {
        isInsideThis = isPointInsideCircle(lat, lng, zone.center.latitude, zone.center.longitude, zone.radius_meters);
      } else if (Array.isArray(zone.polygon)) {
        isInsideThis = pointInPolygon({ lat, lng }, zone.polygon);
      }
      const newState = isInsideThis ? 'inside' : 'outside';

      await db.query(`
            INSERT INTO zone_membership (user_id, zone_id, last_state, last_event_at, last_state_change_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, zone_id) DO UPDATE SET 
            last_state = $3, 
            last_event_at = CURRENT_TIMESTAMP,
            last_state_change_at = CASE WHEN zone_membership.last_state != $3 THEN CURRENT_TIMESTAMP ELSE zone_membership.last_state_change_at END
        `, [user_id, zone.id, newState]);
    }

    // Trigger Global Alerts
    if (globalEvent) {
      // Check global cooldown (prevent spamming transitions)
      // We can iterate the assignedZones memberships to find the latest push?
      // Easier: Check the latest alert for this user
      const lastAlertRes = await db.query(`SELECT created_at FROM alerts WHERE user_id = $1 AND category = $2 ORDER BY created_at DESC LIMIT 1`, [user_id, globalEvent]);
      const lastAlertTime = lastAlertRes.rows[0]?.created_at;
      const timeSince = lastAlertTime ? (new Date() - new Date(lastAlertTime)) / 60000 : 999;

      if (timeSince >= COOLDOWN_MINUTES) {
        let msg = '';
        let severity = 'medium';
        if (globalEvent === 'zone_breach') {
          msg = `Soldier ${user.username} has LEFT all assigned zones!`;
          severity = 'high'; // effectively critical if no zones left
        } else {
          msg = `Soldier ${user.username} is now SAFE inside assigned zone(s): ${currentlyInsideZones.join(', ')}`;
          severity = 'low';
        }

        const alertResult = await db.query(`
              INSERT INTO alerts (category, message, severity, status, user_id, unit, created_at, data)
              VALUES ($1, $2, $3, 'active', $4, $5, CURRENT_TIMESTAMP, $6) RETURNING *
           `, [globalEvent, msg, severity, user_id, user.unit, {
          type: globalEvent,
          severity: severity,
          zones: currentlyInsideZones,
          requiresAction: globalEvent === 'zone_breach'
        }]);

        console.log(`📡 Global Safety Alert: ${msg}`);
        const io = req.app.get('io');
        if (io) io.emit('zoneTransition', { alertId: alertResult.rows[0].id, soldierId: user_id, event: globalEvent, severity });

        transitions.push({ event: globalEvent, message: msg });
      }
    }

    res.json({
      transitions: transitions.length,
      details: transitions,
      user: { username: user.username, role: user.role, unit: user.unit }
    });

  } catch (err) {
    console.error('Error checking zone breach:', err);
    res.status(500).json({ error: 'Failed to check zone breach' });
  }
});

// Point-in-polygon ray casting
function pointInPolygon(pt, poly) {
  try {
    if (!Array.isArray(poly) || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = Number(poly[i].lat ?? poly[i].latitude ?? 0);
      const yi = Number(poly[i].lng ?? poly[i].longitude ?? 0);
      const xj = Number(poly[j].lat ?? poly[j].latitude ?? 0);
      const yj = Number(poly[j].lng ?? poly[j].longitude ?? 0);
      const intersect = ((yi > pt.lng) !== (yj > pt.lng)) &&
        (pt.lat < (xj - xi) * (pt.lng - yi) / ((yj - yi) || 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  } catch { return false; }
}

module.exports = router; 