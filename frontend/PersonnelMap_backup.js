import React, { forwardRef, useEffect, useRef, useState, useMemo, useCallback, useImperativeHandle } from 'react';
import { createRoot } from 'react-dom/client';
import { useAuth, ROLES } from '../contexts/AuthContext';
import DrawPolygon from './DrawPolygon';
import { apiGet, apiPost, apiDelete, apiPut } from '../utils/api';
import ZoneAssignmentDialog from './ZoneAssignmentDialog';
import ZoneMonitorWindow from './ZoneMonitorWindow';
import SoldierDetailWindow from './SoldierDetailWindow';
import PersonDashboardManager from './PersonDashboardManager';
import { PersonDashboardContent } from './PersonDashboardPopup';
import ZoneDashboardContent from './ZoneDashboardContent';
import { AuthProvider } from '../contexts/AuthContext';

import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import '../styles/UserDashboardCard.css';

/**
 * PersonnelMap Component
 * 
 * This is the central map visualization component of MilTrack that displays 
 * personnel locations with custom markers based on their roles.
 * 
 * Features:
 * - Displays personnel on an interactive Leaflet map
 * - Custom markers with color coding based on role
 * - Detail panels when selecting personnel
 * - Support for geofencing visualization
 * - Highlighting specific troops
 * 
 * @param {Object[]} personnel - Array of personnel objects to display on the map
 * @param {string[]} highlightedTroops - Array of IDs for troops to highlight
 * @param {Function} onPersonSelect - Callback when a person is selected
 * @param {boolean} isFullPage - Whether map is displayed in full-page mode
 * @param {Object} mapConfig - Configuration for map features like geofence editing
 * @param {Function} setMapConfig - Function to update map configuration
 * @param {Object} selectedPerson - The currently selected person object
 * @param {string} selectedPersonId - ID of the person selected from the panel for highlighting
 * @param {Function} onZoneChange - Callback when a zone is created, edited, or deleted
 * @param {number} refreshTrigger - Value to trigger a refresh of the map data
 * @param {number} highlightedZone - ID of the zone to highlight
 * @param {boolean} editingMode - Whether we're in zone editing mode
 * @param {boolean} showAllZones - Whether to show all zones regardless of user role
 * @param {Function} onLocationTrackingChange - Callback to notify parent component of location tracking status changes
 * @param {Object} currentLocation - The current location of the user
 * @param {string} mapLayer - The current map layer ('street' or 'satellite')
 * @param {Object} zoneAssignmentData - Data for zone assignment
 */

const PersonnelMap = forwardRef(function PersonnelMap({ personnel, highlightedTroops = [], onPersonSelect, isFullPage = false, mapConfig, setMapConfig, selectedPerson, selectedPersonId, onZoneChange, currentLocation, mapLayer, zoneAssignmentData, searchLocation, searchArea }, ref) {
  // Map and element references
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const zonesLayerRef = useRef(null);
  const markerRefs = useRef({});
  const initTimeoutRef = useRef(null);
  const highlightedZoneLayerRef = useRef(null);
  const zonesRef = useRef([]);
  const drawControlRef = useRef(null);
  const searchOutlineLayerRef = useRef(null);
  const indiaBorderLayerRef = useRef(null);

  // State variables
  const [selectedPersonInternal, setSelectedPersonInternal] = useState(null);
  const [mapInitError, setMapInitError] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [previouslySelectedPerson, setPreviouslySelectedPerson] = useState(null);
  const [drawingLayer, setDrawingLayer] = useState(null);
  const [zones, setZones] = useState([]);
  const [editInstructionsVisible, setEditInstructionsVisible] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [trackingError, setTrackingError] = useState(null);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const locationWatchIdRef = useRef(null);
  const [currentZone, setCurrentZone] = useState(null);
  const [zoneDropdownOpen, setZoneDropdownOpen] = useState(false);
  const zoneDropdownRef = useRef(null);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [pendingZoneCoords, setPendingZoneCoords] = useState(null);
  const [zoneMonitorOpen, setZoneMonitorOpen] = useState(false);
  const [zoneMonitorData, setZoneMonitorData] = useState(null);
  const [zoneMonitorSoldiers, setZoneMonitorSoldiers] = useState([]);
  const [pendingZoneInitial, setPendingZoneInitial] = useState(null);
  const [soldierDetail, setSoldierDetail] = useState(null);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [indiaBorder, setIndiaBorder] = useState(null);

  // Fetch GeoJSON for India border (or any overlay) once
  useEffect(() => {
    fetch('/de.geojson')
      .then((res) => res.json())
      .then((data) => setIndiaBorder(data))
      .catch(() => { });
  }, []);

  // When GeoJSON data arrives after map is ready, add/update overlay
  useEffect(() => {
    if (!mapInstanceRef.current || !indiaBorder) return;
    try {
      if (indiaBorderLayerRef.current) {
        indiaBorderLayerRef.current.remove();
        indiaBorderLayerRef.current = null;
      }
      const L = window.L;
      if (!L) return;
      indiaBorderLayerRef.current = L.geoJSON(indiaBorder, {
        style: { color: '#662e52', weight: 0.5, fill: true, fillOpacity: -2 }
      }).addTo(mapInstanceRef.current);
    } catch (_) { }
  }, [indiaBorder, mapReady]);

  // User Dashboard Manager state
  // const [dashboardManager, setDashboardManager] = useState(null);
  const dashboardManagerRef = useRef(null);

  // Authentication context for user permissions
  const { currentUser } = useAuth();

  // Check if user can draw zones (case-insensitive)
  const canDrawZones = currentUser.role && ['master', 'commander', 'unit_head', 'brigadier'].includes(currentUser.role.toLowerCase());

  // Track the current tile layer
  const tileLayerStreetRef = useRef(null);
  const tileLayerSatelliteRef = useRef(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getDrawControl: () => {
      const control = drawControlRef.current;
      console.log('getDrawControl called, returning:', control);
      if (control && control._toolbars) {
        console.log('Handlers status:', {
          polygon: control._toolbars.draw?._modes?.polygon?.handler?.enabled(),
          edit: control._toolbars.edit?._modes?.edit?.handler?.enabled(),
          remove: control._toolbars.edit?._modes?.remove?.handler?.enabled()
        });
      }
      return control;
    },
    setDrawMode: (enabled) => setIsDrawMode(!!enabled),
    clearPlottedPoints: () => {
      console.log('Clearing plotted points...');
      try {
        // Clear any drawing layers
        if (drawingLayer) {
          mapInstanceRef.current?.removeLayer(drawingLayer);
          setDrawingLayer(null);
        }

        // Clear any pending zone coordinates
        setPendingZoneCoords(null);

        // Disable any active drawing modes
        const drawControl = drawControlRef.current;
        if (drawControl && drawControl._toolbars) {
          const polygonHandler = drawControl._toolbars.draw?._modes?.polygon?.handler;
          if (polygonHandler && polygonHandler.enabled()) {
            polygonHandler.disable();
          }

          const editHandler = drawControl._toolbars.edit?._modes?.edit?.handler;
          if (editHandler && editHandler.enabled()) {
            editHandler.disable();
          }

          const removeHandler = drawControl._toolbars.edit?._modes?.remove?.handler;
          if (removeHandler && removeHandler.enabled()) {
            removeHandler.disable();
          }
        }

        // Clear any drawn features from the map
        if (mapInstanceRef.current) {
          mapInstanceRef.current.eachLayer((layer) => {
            if (layer instanceof L.FeatureGroup && layer._layers) {
              // This is likely a drawing layer, remove it
              mapInstanceRef.current.removeLayer(layer);
            }
          });
        }

        console.log('Plotted points cleared successfully');
      } catch (error) {
        console.error('Error clearing plotted points:', error);
      }
    },
    // Programmatically open the Create & Assign dialog with given coordinates
    openAssignmentDialog: (coords, initial) => {
      try {
        // Normalize to [{lat,lng}] format
        const normalized = Array.isArray(coords)
          ? coords.map(p => Array.isArray(p) ? { lat: p[0], lng: p[1] } : p)
          : [];
        setPendingZoneCoords(normalized);
        setPendingZoneInitial(initial || null);
        setZoneDialogOpen(true);
      } catch (e) {
        console.error('Failed to open assignment dialog:', e);
      }
    },
    // Method to focus on a specific zone
    focusOnZone: (zone) => {
      if (!mapInstanceRef.current) return;

      try {
        console.log("focusOnZone called with zone:", zone);

        // Normalize zone points - accept points, polygon_coordinates, or coordinates
        let points = zone.points ?? zone.polygon_coordinates ?? zone.coordinates;
        if (typeof points === 'string') {
          try { points = JSON.parse(points); } catch { points = []; }
        }
        if (!Array.isArray(points)) {
          console.error("Invalid zone points format:", zone.points);
          return;
        }

        if (!points || points.length < 3) {
          console.error("Not enough points to create a zone polygon");
          return;
        }

        // Ensure L is defined
        const L = window.L;

        // Convert points to LatLng format - handle both [lat, lng] and {lat, lng} formats
        const latLngs = points.map(point => {
          if (Array.isArray(point)) {
            // Format: [lat, lng]
            return L.latLng(point[0], point[1]);
          } else if (point && typeof point === 'object' && point.lat !== undefined && point.lng !== undefined) {
            // Format: {lat: x, lng: y}
            return L.latLng(point.lat, point.lng);
          } else {
            console.error("Invalid point format:", point);
            return null;
          }
        }).filter(latLng => latLng !== null);

        if (latLngs.length < 3) {
          console.error("Not enough valid points to create a zone polygon");
          return;
        }

        // Create a LatLngBounds object from the zone points
        const bounds = L.latLngBounds(latLngs);

        // Fit the map to the bounds of the zone with some padding
        mapInstanceRef.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16
        });

        // Clear any existing highlighted zone layer
        if (highlightedZoneLayerRef.current) {
          if (mapInstanceRef.current.hasLayer(highlightedZoneLayerRef.current)) {
            mapInstanceRef.current.removeLayer(highlightedZoneLayerRef.current);
          }
          highlightedZoneLayerRef.current = null;
        }

        // Create and add a highlighted version of the zone
        const highlightedPolygon = L.polygon(latLngs, {
          color: '#27ae60', // Green outline for highlight
          weight: 5,
          opacity: 0.9,
          fillColor: '#27ae60',
          fillOpacity: 0.08, // transparent green layer
          className: 'highlighted-zone'
        });

        // Add tooltip with zone info
        highlightedPolygon.bindTooltip(`
          <div class="zone-highlight-tooltip">
            <strong>${zone.name}</strong>
          </div>
        `, {
          permanent: false,
          direction: 'center',
          className: 'zone-highlight-tooltip'
        });

        // Add to map and store reference
        highlightedPolygon.addTo(mapInstanceRef.current);
        highlightedZoneLayerRef.current = highlightedPolygon;

        // Call the fetch zones function to update all zones with the highlighted one
        if (window.componentFetchZones) {
          window.componentFetchZones();
        }
      } catch (error) {
        console.error('Error focusing on zone:', error);
      }
    },

    // Method to edit a specific zone
    editZone: (zone) => {
      if (!mapInstanceRef.current || !window.L || !canDrawZones) return;

      const L = window.L;

      try {
        console.log("editZone called with zone:", zone);

        // First clear any existing highlight
        if (highlightedZoneLayerRef.current) {
          mapInstanceRef.current.removeLayer(highlightedZoneLayerRef.current);
          highlightedZoneLayerRef.current = null;
        }

        // Normalize zone points - accept points, polygon_coordinates, or coordinates
        let points = zone.points ?? zone.polygon_coordinates ?? zone.coordinates;
        if (typeof points === 'string') {
          try { points = JSON.parse(points); } catch { points = []; }
        }
        if (!Array.isArray(points)) {
          console.error("Invalid zone points format:", zone.points);
          return;
        }

        if (!points || points.length < 3) {
          console.error("Not enough points to create a zone polygon");
          return;
        }

        // Convert points to LatLng format - handle both [lat, lng] and {lat, lng} formats
        const latLngs = points.map(point => {
          if (Array.isArray(point)) {
            // Format: [lat, lng]
            return L.latLng(point[0], point[1]);
          } else if (point && typeof point === 'object' && point.lat !== undefined && point.lng !== undefined) {
            // Format: {lat: x, lng: y}
            return L.latLng(point.lat, point.lng);
          } else {
            console.error("Invalid point format:", point);
            return null;
          }
        }).filter(latLng => latLng !== null);

        if (latLngs.length < 3) {
          console.error("Not enough valid points to create a zone polygon");
          return;
        }

        // Focus the map on this zone
        mapInstanceRef.current.fitBounds(L.polygon(latLngs).getBounds(), {
          padding: [50, 50],
          maxZoom: 16
        });

        // Create a custom editable polygon WITHOUT using Leaflet Draw feature group
        const polygon = L.polygon(latLngs, {
          color: '#f39c12', // Orange for editing
          weight: 3,
          opacity: 0.9,
          fillColor: '#f39c12',
          fillOpacity: 0.1 // subtle transparent orange layer during edit
        });

        // Store zone data in the layer
        polygon.zoneId = zone.id;
        polygon.zoneName = zone.name;

        // Add directly to map (NOT to drawingLayer to avoid auto-save)
        polygon.addTo(mapInstanceRef.current);

        // Enable editing with vertex handles
        polygon.editing.enable();

        // Add save button to the bottom of the map
        const mapContainer = mapInstanceRef.current.getContainer();

        // Create edit controls div if it doesn't exist
        let editControlsDiv = mapContainer.querySelector('.edit-zone-controls');
        if (!editControlsDiv) {
          editControlsDiv = document.createElement('div');
          editControlsDiv.className = 'edit-zone-controls';
          mapContainer.appendChild(editControlsDiv);
        }

        // Set content
        editControlsDiv.innerHTML = `
            <div class="edit-zone-title">Editing Zone: ${zone.name}</div>
            <div class="edit-zone-buttons">
              <button class="edit-zone-save">Save Changes</button>
              <button class="edit-zone-cancel">Cancel</button>
              <button class="edit-zone-delete">Delete Zone</button>
            </div>
          `;

        // Add event listeners
        const saveButton = editControlsDiv.querySelector('.edit-zone-save');
        const cancelButton = editControlsDiv.querySelector('.edit-zone-cancel');
        const deleteButton = editControlsDiv.querySelector('.edit-zone-delete');

        if (saveButton) {
          saveButton.onclick = () => {
            try {
              // Ensure editing is disabled to finalize any pending edits
              if (polygon.editing && polygon.editing.enabled()) {
                polygon.editing.disable();
              }

              // Get the current coordinates from the polygon (including any edits)
              // Use getLatLngs() which returns the most up-to-date coordinates
              const latLngs = polygon.getLatLngs()[0];
              if (!latLngs || latLngs.length < 3) {
                console.error('Invalid polygon: need at least 3 points');
                try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'error', message: 'Polygon must have at least 3 points' } })); } catch (_) { }
                return;
              }

              // Convert to coordinate format: array of {lat, lng} objects
              const coordinates = latLngs.map(latlng => ({ lat: latlng.lat, lng: latlng.lng }));
              console.log('Save button clicked, coordinates:', coordinates);
              console.log('Number of points:', coordinates.length);
              setPendingZoneCoords(coordinates);
              setEditingZoneId(zone.id);
              // Set initial data so the dialog is pre-filled and save button is enabled
              // Ensure we always have a name (use default if missing) so save button can be enabled
              const zoneName = zone.name || zone.zone_name || `Zone ${zone.id || 'Unknown'}`;
              setPendingZoneInitial({
                name: zoneName,
                description: zone.description || zone.level || zone.details || zone.geofence_description || '',
                unit_id: zone.unit_id || zone.unitId || zone?.unit?.id || zone?.unit?.unit_id || zone.unitid || null,
                unit: zone.unit || null,
                unit_name: zone.unit_name || zone?.unit?.name || ''
              });
              console.log('Set pendingZoneInitial for editing:', {
                name: zoneName,
                unit_id: zone.unit_id || zone.unitId || zone?.unit?.id || zone?.unit?.unit_id || zone.unitid,
                zone
              });
              setZoneDialogOpen(true);
              // Keep the popup reusable across edits by not destroying edit state
            } catch (e) {
              console.error('Failed to prepare coordinates for edit save:', e);
              try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'error', message: 'Failed to capture edited coordinates: ' + e.message } })); } catch (_) { }
            }
          };
        }

        if (cancelButton) {
          cancelButton.onclick = () => {
            cancelZoneEdit();
            setEditingZoneId(null);
          };
        }

        if (deleteButton) {
          // deleteZone(zone.id);
          console.log("Hi Bujjiiii");
        }

        // Custom edit mode - no Leaflet Draw controls needed
        console.log("Custom edit mode enabled for zone:", zone.id);
        setEditInstructionsVisible(true);
      } catch (error) {
        console.error('Error setting up zone editing:', error);
      }
    },

    // Method to delete a zone
    // deleteZone: (zoneId) => {
    //   if (!mapInstanceRef.current || !canDrawZones) return;

    //   fetch(`/api/zones/${zoneId}`, {
    //     method: 'DELETE',
    //     headers: {
    //       'Content-Type': 'application/json'
    //     },
    //     body: JSON.stringify({
    //       user_id: currentUser.id,
    //       user_role: currentUser.role.toUpperCase()
    //     })
    //   })
    //   .then(response => response.json())
    //   .then(data => {
    //     if (data.success) {
    //       // Notify parent component of zone change
    //       if (onZoneChange) {
    //         onZoneChange();
    //       }
    //     } else {
    //       alert('Failed to delete zone: ' + data.error);
    //     }
    //   })
    //   .catch(error => {
    //     alert('Error deleting zone: ' + error.message);
    //   });
    // }
    goToCurrentLocation: ({ lat, lng }) => {
      if (mapInstanceRef.current && lat && lng) {
        mapInstanceRef.current.setView([lat, lng], 16, { animate: true });
      }
    },
  }));

  // Make clearPlottedPoints available globally
  useEffect(() => {
    window.clearPlottedPoints = () => {
      const mapRef = ref?.current;
      if (mapRef && mapRef.clearPlottedPoints) {
        mapRef.clearPlottedPoints();
      }
    };

    return () => {
      delete window.clearPlottedPoints;
    };
  }, [ref]);

  // Function to save edited zone
  const saveEditedZone = (zoneId, polygon) => {
    try {
      if (!polygon || !polygon.getLatLngs || !zoneId) {
        console.error('Invalid polygon or zone ID for saving');
        return;
      }

      // Ensure editing is disabled to finalize any pending edits
      if (polygon.editing && polygon.editing.enabled()) {
        polygon.editing.disable();
      }

      // Get coordinates from the polygon (including any edits)
      const latLngs = polygon.getLatLngs()[0];
      if (!latLngs || latLngs.length < 3) {
        console.error('Invalid polygon: need at least 3 points');
        try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'error', message: 'Polygon must have at least 3 points' } })); } catch (_) { }
        return;
      }

      // Convert to coordinate format: array of [lat, lng] arrays
      const coordinates = latLngs.map(latlng => [latlng.lat, latlng.lng]);

      console.log('Saving edited zone', zoneId, 'with coordinates:', coordinates);
      console.log('Number of points:', coordinates.length);

      // Make API call to update geofence (zones backed by geofences)
      apiPut(`/v1/geofences/${zoneId}`, {
        points: coordinates,
        polygon_coordinates: coordinates,
        coordinates: coordinates,
        user_id: currentUser.id,
        user_role: currentUser.role.toUpperCase()
      })
        .then((data) => {
          if (data && data.success) {
            cleanupZoneEditing();
            if (window.componentFetchZones) {
              window.componentFetchZones();
            }
            if (onZoneChange) {
              onZoneChange();
            }
            // Broadcast change + app notification
            try { window.dispatchEvent(new Event('geofence-changed')); } catch (_) { }
            try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'success', message: 'Zone updated successfully' } })); } catch (_) { }
          } else {
            try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'error', message: 'Failed to update zone' } })); } catch (_) { }
          }
        })
        .catch((error) => {
          console.error('Error updating zone:', error);
          try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'error', message: 'Error updating zone: ' + error.message } })); } catch (_) { }
        });
    } catch (error) {
      console.error('Error saving zone edits:', error);
    }
  };

  // Function to cancel zone editing
  const cancelZoneEdit = () => {
    cleanupZoneEditing();

    // Refresh zones
    if (window.componentFetchZones) {
      window.componentFetchZones();
    }

    // Notify parent
    if (onZoneChange) {
      onZoneChange();
    }
  };

  // Clean up editing UI elements
  const cleanupZoneEditing = () => {
    try {
      // Remove edit controls
      const mapContainer = mapInstanceRef.current.getContainer();
      const editControlsDiv = mapContainer.querySelector('.edit-zone-controls');
      if (editControlsDiv) {
        editControlsDiv.remove();
      }

      // Remove any custom styles
      const editModeStyle = document.querySelector('.edit-mode-style');
      if (editModeStyle) {
        editModeStyle.remove();
      }

      setEditInstructionsVisible(false);

      // If we have access to the drawing control, disable edit mode
      if (drawControlRef.current &&
        drawControlRef.current._toolbars &&
        drawControlRef.current._toolbars.edit) {

        try {
          // Disable both edit and remove handlers
          if (drawControlRef.current._toolbars.edit._modes.edit.handler) {
            drawControlRef.current._toolbars.edit._modes.edit.handler.disable();
          }

          if (drawControlRef.current._toolbars.edit._modes.remove.handler) {
            drawControlRef.current._toolbars.edit._modes.remove.handler.disable();
          }

          // Deactivate any active buttons
          const activeButtons = document.querySelectorAll('.leaflet-draw-toolbar-button.leaflet-draw-toolbar-button-enabled');
          activeButtons.forEach(button => {
            button.classList.remove('leaflet-draw-toolbar-button-enabled');
          });

        } catch (error) {
          console.error('Error disabling edit modes:', error);
        }
      }

      // Clear the drawing layer and redraw all zones
      if (window.componentFetchZones) {
        window.componentFetchZones();
      }

    } catch (error) {
      console.error('Error cleaning up zone editing:', error);
    }
  };

  /**
   * Initialize the map when component mounts
   */
  useEffect(() => {
    let attempts = 0;
    function tryInit() {
      if (mapRef.current && mapRef.current.clientWidth > 0 && mapRef.current.clientHeight > 0) {
        initializeMap();
      } else if (attempts < 20) { // Try for up to 2 seconds
        attempts++;
        setTimeout(tryInit, 100);
      }
    }
    tryInit();
    return () => {
      cleanupMap();
    };
  }, []);

  /**
   * Clean up the map instance to prevent memory leaks
   */
  const cleanupMap = () => {
    if (mapInstanceRef.current) {
      try {
        markersLayerRef.current = null;
        mapInstanceRef.current.remove();
      } catch (error) {
        console.error("Error cleaning up map:", error);
      }
      mapInstanceRef.current = null;
      setMapReady(false);
      setMapInitialized(false);
    }
  };

  /**
   * Initialize the Leaflet map with appropriate settings
   */
  const initializeMap = () => {
    // Skip if already initialized or container not ready
    if (mapInitialized || !mapRef.current) return;

    try {
      // Check if Leaflet is available
      if (!window.L) {
        throw new Error("Leaflet library not loaded");
      }

      // Check if container has dimensions
      const container = mapRef.current;
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        console.warn("Map container has no dimensions, delaying initialization");
        return;
      }

      // Create the map instance using the Leaflet library
      const L = window.L;

      // Set default view to a central location with appropriate zoom level
      mapInstanceRef.current = L.map(mapRef.current, {
        attributionControl: false, // Disable attribution for cleaner look
        zoomControl: false,
        minZoom: 3,
        maxZoom: 18,
        maxBounds: [[-90, -180], [90, 180]], // Restrict panning to world bounds
        maxBoundsViscosity: 1.0 // Prevent blank spaces when panning
      }).setView([28.6139, 77.2090], 6); // New Delhi, India with zoom level 6 to show most of India

      // Add zoom control to bottom left
      L.control.zoom({ position: 'bottomleft' }).addTo(mapInstanceRef.current);

      // --- Preload both tile layers ---
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        noWrap: true
      });
      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri',
        maxZoom: 19,
        noWrap: true
      });
      streetLayer.addTo(mapInstanceRef.current);
      satelliteLayer.addTo(mapInstanceRef.current);
      streetLayer.setOpacity(1);
      satelliteLayer.setOpacity(0);
      tileLayerStreetRef.current = streetLayer;
      tileLayerSatelliteRef.current = satelliteLayer;

      // Create a layer group for markers
      markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
      // Create a dedicated layer group for zones to prevent duplicates and simplify refreshes
      zonesLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

      // Helper to add/update India border GeoJSON layer if available
      const addIndiaBorderLayer = () => {
        if (!mapInstanceRef.current || !window.L || !indiaBorder) return;
        try { if (indiaBorderLayerRef.current) { indiaBorderLayerRef.current.remove(); } } catch (_) { }
        const L = window.L;
        indiaBorderLayerRef.current = L.geoJSON(indiaBorder, {
          style: { color: 'black', weight: 2, fill: true, fillOpacity: 0.05 }
        }).addTo(mapInstanceRef.current);
        try {
          const bounds = indiaBorderLayerRef.current.getBounds();
          if (bounds && bounds.isValid()) {
            mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20] });
          }
        } catch (_) { }
      };

      // Wait for the map to be fully initialized
      mapInstanceRef.current.whenReady(() => {
        setMapReady(true);

        // Add GeoJSON overlay if already loaded
        addIndiaBorderLayer();

        // Initialize Leaflet Draw controls
        if (canDrawZones && window.L && window.L.Control && window.L.Control.Draw) {
          const L = window.L;

          // Create feature group for drawn items
          const drawnItems = new L.FeatureGroup();
          mapInstanceRef.current.addLayer(drawnItems);
          setDrawingLayer(drawnItems);

          // Configure draw control - DISABLE EDIT to prevent auto-save
          const drawControl = new L.Control.Draw({
            position: 'topleft',
            draw: {
              polygon: {
                allowIntersection: false,
                drawError: {
                  color: '#e1e100',
                  message: '<strong>Error:</strong> Shape edges cannot cross!'
                },
                shapeOptions: {
                  color: '#97009c',
                  weight: 3,
                  opacity: 0.8,
                  fillOpacity: 0.2
                }
              },
              polyline: false,
              rectangle: false,
              circle: false,
              marker: false,
              circlemarker: false
            },
            edit: false  // DISABLE EDIT COMPLETELY to prevent auto-save
          });

          mapInstanceRef.current.addControl(drawControl);
          drawControlRef.current = drawControl;

          console.log('Draw control created and added:', drawControl);
          console.log('Draw control toolbars:', drawControl._toolbars);
          console.log('Polygon handler:', drawControl._toolbars?.draw?._modes?.polygon?.handler);
          console.log('Edit handler:', drawControl._toolbars?.edit?._modes?.edit?.handler);
          console.log('Remove handler:', drawControl._toolbars?.edit?._modes?.remove?.handler);

          // Handle draw events
          mapInstanceRef.current.on(L.Draw.Event.CREATED, function (e) {
            const layer = e.layer;
            drawnItems.addLayer(layer);
            // Get the coordinates
            const coordinates = layer.getLatLngs()[0].map(latlng => ({
              lat: latlng.lat,
              lng: latlng.lng
            }));
            // Open the assignment dialog
            setPendingZoneCoords(coordinates);
            setZoneDialogOpen(true);
            setIsDrawMode(false);
          });

          // Disable auto-save on edit - let user control when to save
          // mapInstanceRef.current.on(L.Draw.Event.EDITED, async function (e) {
          //   // Auto-save disabled - user must click Save button manually
          // });

          mapInstanceRef.current.on(L.Draw.Event.DELETED, async function (e) {
            const layers = e.layers;
            try {
              const deletions = [];
              layers.eachLayer(function (layer) {
                if (!layer.zoneId) return;
                deletions.push(apiDelete(`/v1/zones/${layer.zoneId}`));
              });
              if (deletions.length > 0) await Promise.allSettled(deletions);
            } catch (err) { console.error('Persist delete failed', err); }
          });
        }
        setMapInitError(null);
        setMapInitialized(true);

        // Update markers once map is ready
        updateMarkers();

        // Load and display zones
        loadZones();

        // Invalidate size to ensure proper rendering
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 100);
      });
    } catch (error) {
      console.error("Error initializing map:", error);
      setMapInitError("Failed to initialize map. Please try reloading the page.");
      cleanupMap();
    }
  };

  /**
   * Update markers when personnel data changes, but only if map is ready
   * Optimized to prevent unnecessary marker clearing during frequent updates
   */
  useEffect(() => {
    if (mapInstanceRef.current && markersLayerRef.current && mapReady) {
      try {
        // Force invalidate size to prevent map glitches
        mapInstanceRef.current.invalidateSize();

        // Store the current zoom and center before updating markers
        const currentZoom = mapInstanceRef.current.getZoom();
        const currentCenter = mapInstanceRef.current.getCenter();

        updateMarkers();

        // Add map click handler to deselect person when clicking on empty areas
        const mapClickHandler = (e) => {
          // Check if the click was on a marker or popup
          const clickTarget = e.originalEvent.target;
          const isMarkerClick =
            clickTarget.classList &&
            (clickTarget.classList.contains('leaflet-marker-icon') ||
              clickTarget.classList.contains('leaflet-popup') ||
              clickTarget.closest('.leaflet-popup') ||
              clickTarget.classList.contains('leaflet-interactive'));

          // If not clicking on a marker or popup and a person is selected, deselect
          if (!isMarkerClick && (selectedPerson || selectedPersonInternal)) {
            if (onPersonSelect) {
              onPersonSelect(null);
            }
            setSelectedPersonInternal(null);
          }
        };

        // Add the click handler
        mapInstanceRef.current.on('click', mapClickHandler);

        // Return cleanup function
        return () => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.off('click', mapClickHandler);
          }
        };
      } catch (error) {
        console.error("Error updating markers:", error);
        setMapInitError("Failed to update map markers. Please try reloading the page.");
      }
    }
  }, [mapReady, highlightedTroops, selectedPerson, onPersonSelect, selectedPersonInternal, currentLocation, searchLocation]);

  /**
   * Separate effect for personnel data updates to prevent marker flickering
   * Only updates markers when personnel data actually changes significantly
   * Now fully dynamic - updates in real-time as Kafka data arrives
   */
  useEffect(() => {
    if (mapInstanceRef.current && markersLayerRef.current && mapReady && personnel) {
      // Real-time updates from Kafka - update markers immediately when data changes
      // No debouncing needed as Kafka already batches updates
      try {
        updateMarkers();
      } catch (error) {
        console.error("Error updating markers from personnel change:", error);
      }
    }
  }, [personnel, mapReady]);

  // Render or clear the searched area outline when searchArea changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    // Clear previous outline
    if (searchOutlineLayerRef.current) {
      try {
        mapInstanceRef.current.removeLayer(searchOutlineLayerRef.current);
      } catch (_) { }
      searchOutlineLayerRef.current = null;
    }
    if (!searchArea) return;
    const { south, west, north, east } = searchArea;
    if ([south, west, north, east].some(v => typeof v !== 'number' || Number.isNaN(v))) return;
    // Create a rectangle with dashed outline to highlight searched area
    const bounds = L.latLngBounds([[south, west], [north, east]]);
    const rectangle = L.rectangle(bounds, {
      color: '#FF5722',
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0,
      dashArray: '6,6'
    });
    rectangle.addTo(mapInstanceRef.current);
    searchOutlineLayerRef.current = rectangle;
    try {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } catch (_) { }
  }, [searchArea]);

  const L = window.L;

  /**
   * Load zones from the backend and display them on the map
   */

  // Function to save a new zone
  const saveNewZone = async (name, coordinates, assignments = {}, description = '') => {
    try {
      const data = await apiPost('/v1/zones', {
        name: name,
        description: description || `Zone created by ${currentUser.name}`,
        type: 'polygon',
        points: coordinates,
        unit_id: assignments.unit?.id || null,
        commander_id: assignments.commander?.id || null,
        brigadier_id: assignments.brigadier?.id || null,
        soldier_id: assignments.soldier?.id || null,
        created_by: currentUser.id,
        user_id: currentUser.id,
        user_role: currentUser.role.toUpperCase()
      });
      if (data.success) {
        console.log('Zone saved successfully');
        loadZones();
        if (onZoneChange) {
          try { onZoneChange('Zone created successfully'); } catch (_) { }
        }
      } else {
        console.error('Failed to save zone:', data.error);
        alert('Failed to save zone: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving zone:', error);
      alert('Error saving zone. Check console for details.');
    }
  };

  // Function to delete a zone
  // const deleteZone = async (zoneId) => {
  //   if (!currentUser || (currentUser.role !== ROLES.MASTER && currentUser.role !== ROLES.COMMANDER)) {
  //     console.error('Insufficient permissions to delete zone');
  //     return false;
  //   }

  //   try {
  //     const response = await fetch(`http://117.251.19.107:5000/api/zones/${zoneId}`, {
  //       method: 'DELETE',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         user_id: currentUser.id,
  //         user_role: currentUser.role.toUpperCase()
  //       })
  //     });

  //     const data = await response.json();

  //     if (data.success) {
  //       console.log('Zone deleted successfully');
  //       // Refresh zones
  //       loadZones();
  //       return true;
  //     } else {
  //       console.error('Failed to delete zone:', data.error);
  //       return false;
  //     }
  //   } catch (error) {
  //     console.error('Error deleting zone:', error);
  //     return false;
  //   }
  // };

  const loadZones = async () => {
    try {
      const data = await apiGet('/v1/zones');
      if (data.success && data.zones) {
        // No change needed if the mapping is correct in the backend
        setZones(data.zones);
        displayZonesOnMap(data.zones);
        console.log('Loaded zones:', data.zones);
      }
    } catch (error) {
      console.error('Error loading zones:', error);
    }
  };

  /**
   * Display zones on the map as polygons or circles
   */
  const displayZonesOnMap = (zonesToDisplay) => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    // Clear previously rendered zones to avoid duplicates
    try { zonesLayerRef.current && zonesLayerRef.current.clearLayers(); } catch (_) { }
    zonesToDisplay.forEach(zone => {
      let zoneLayer;
      if (zone.type === 'polygon' && zone.points) {
        try {
          let coordinates;
          if (typeof zone.points === 'string') {
            coordinates = JSON.parse(zone.points);
          } else {
            coordinates = zone.points;
          }
          // Force all points to [lat, lng] arrays
          const leafletCoords = coordinates.map(point => {
            if (Array.isArray(point) && point.length === 2) {
              return [parseFloat(point[0]), parseFloat(point[1])];
            } else if (point && typeof point === 'object' && point.lat != null && point.lng != null) {
              return [parseFloat(point.lat), parseFloat(point.lng)];
            }
            return null;
          }).filter(coord => coord !== null);
          if (leafletCoords.length >= 3) {
            zoneLayer = L.polygon(leafletCoords, {
              color: '#27ae60', // green outline
              weight: 3,
              fillColor: '#27ae60',
              fillOpacity: 0.06 // faint transparent green layer
            });
            console.log('Adding polygon to map:', leafletCoords);
          }
        } catch (error) {
          console.error('Error parsing polygon coordinates:', error);
          return;
        }
      }
      if (zoneLayer) {
        // Attach id for edit/remove flows
        zoneLayer.zoneId = zone.id;
        // Add hover tooltip to show zone name
        try {
          zoneLayer.bindTooltip(`
            <div class="zone-tooltip"><strong>${zone.name || 'Zone'}</strong></div>
          `, { permanent: false, direction: 'center', className: 'zone-name-tooltip' });
        } catch (_) { }
        // Add to zones layer group (single source of truth)
        try { zonesLayerRef.current.addLayer(zoneLayer); } catch (_) { zoneLayer.addTo(mapInstanceRef.current); }

        // Add click handler: open dashboard in new browser tab (same as soldier marker)
        zoneLayer.on('click', async (e) => {
          try {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);

            // Open a blank new tab immediately to avoid popup blockers
            const newWin = window.open('', '_blank', 'width=1000,height=800,resizable,scrollbars');
            if (!newWin) return;

            // Write a minimal shell page and mount React content into it
            newWin.document.write(`<!DOCTYPE html><html><head><title>${zone.name || 'Zone'} - Dashboard</title></head><body style='margin:0;background:#e9ecf5;'></body></html>`);
            newWin.document.close();

            // Create a container in the new window
            const container = newWin.document.createElement('div');
            container.id = 'zone-dashboard-root';
            container.className = 'bg-white rounded-lg shadow overflow-hidden';
            container.style.background = 'linear-gradient(135deg, rgb(244, 246, 250) 0%, rgb(233, 236, 245) 100%)';
            container.style.minHeight = '100vh';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            newWin.document.body.appendChild(container);

            // Copy stylesheets and inline styles to keep visuals identical
            try {
              Array.from(document.styleSheets).forEach(styleSheet => {
                try {
                  if (styleSheet.href) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = styleSheet.href;
                    newWin.document.head.appendChild(link);
                  } else if (styleSheet.cssRules) {
                    const styleEl = document.createElement('style');
                    Array.from(styleSheet.cssRules).forEach(rule => {
                      styleEl.appendChild(document.createTextNode(rule.cssText));
                    });
                    newWin.document.head.appendChild(styleEl);
                  }
                } catch (_) {
                  // ignore cross-origin stylesheets
                }
              });
            } catch (_) { }

            // Dynamically render ZoneDashboardContent into the new window using React 18 root
            // Use React and createRoot from the current scope (they're imported at the top)
            const root = createRoot(container);
            root.render(
              React.createElement(AuthProvider, {},
                React.createElement(ZoneDashboardContent, { zone: zone, onSoldierClick: null, isFullScreen: true })
              )
            );

            // Expose needed components to new window for debugging/fallback
            try {
              newWin.opener = window;
              newWin.ZoneDashboardContent = ZoneDashboardContent;
              newWin.AuthProvider = AuthProvider;
            } catch (_) { }

            // Clean up when closed
            newWin.onbeforeunload = () => {
              try { root.unmount(); } catch (_) { }
            };
          } catch (err) {
            console.error('Failed to open zone dashboard tab:', err);
          }
        });

        // Add double-click handler for monitoring
        zoneLayer.on('dblclick', () => handleZoneMonitor(zone.id));
      }
    });
  };

  // Listen for cross-page geofence changes (create/update/delete) and refresh zones
  useEffect(() => {
    const handler = (e) => {
      try { loadZones(); } catch (_) { }
    };
    window.addEventListener('geofence-changed', handler);
    return () => window.removeEventListener('geofence-changed', handler);
  }, []);

  // Separate effect for geofence rendering to prevent interference with personnel markers
  useEffect(() => {
    if (mapInstanceRef.current && zones.length > 0) {
      // Small delay to ensure geofences render after personnel markers
      const timeoutId = setTimeout(() => {
        try {
          displayZonesOnMap(zones);
        } catch (error) {
          console.error('Error displaying zones:', error);
        }
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [zones]);

  /**
   * Update markers when personnel data changes
   * Optimized to prevent unnecessary marker clearing and improve performance
   */
  const updateMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    try {
      // Store current map view state before updating markers
      const currentZoom = mapInstanceRef.current.getZoom();
      const currentCenter = mapInstanceRef.current.getCenter();
      const wasManuallyZoomed = mapInstanceRef.current._zoomAnimated; // Check if user has interacted with map

      // Show all users with a stored location (regardless of online status)
      const validPersonnel = personnel.filter(p => p && p.location && p.location.lat && p.location.lng);

      // Check if we need to update markers by comparing with existing markers
      const existingMarkerIds = Object.keys(markerRefs.current);
      const newPersonnelIds = validPersonnel.map(p => p.id.toString());

      // Only clear and re-render if personnel data has actually changed
      const personnelChanged = existingMarkerIds.length !== newPersonnelIds.length ||
        !existingMarkerIds.every(id => newPersonnelIds.includes(id)) ||
        !newPersonnelIds.every(id => existingMarkerIds.includes(id));

      if (!personnelChanged && existingMarkerIds.length > 0) {
        // Just update existing markers without clearing
        validPersonnel.forEach(person => {
          const existingMarker = markerRefs.current[person.id];
          if (existingMarker) {
            // Update marker position if location changed
            const newLatLng = [person.location.lat, person.location.lng];
            if (existingMarker.getLatLng().lat !== newLatLng[0] || existingMarker.getLatLng().lng !== newLatLng[1]) {
              existingMarker.setLatLng(newLatLng);
            }
          }
        });
        return; // Skip full re-render
      }

      // Clear existing markers only when necessary
      markersLayerRef.current.clearLayers();

      // Reset marker refs
      markerRefs.current = {};

      // Defensive: Remove any stray person-marker icons from the DOM
      document.querySelectorAll('.leaflet-marker-icon.person-marker').forEach(el => el.remove());
      // Also remove any default Leaflet marker icons (not our custom ones)
      document.querySelectorAll('.leaflet-marker-icon:not(.person-marker)').forEach(el => el.remove());
      // Also remove any default Leaflet marker shadows
      document.querySelectorAll('.leaflet-marker-shadow').forEach(el => el.remove());

      validPersonnel.forEach(person => {
        // Determine if this person should be highlighted
        const isHighlighted = highlightedTroops.includes(person.id);
        const isSelected = selectedPersonId && person.id === parseInt(selectedPersonId);
        const isSecondaryHighlight = selectedPersonId && getHighlightedTroops().includes(person.id.toString()) && !isSelected;

        // Marker color based on role
        let markerColor = '#2A5CAA'; // Default: blue for soldiers
        if (person.role === 'commander') markerColor = '#4CAF50'; // Green for commanders
        if (person.role === 'brigadier') markerColor = '#E67E22'; // Orange for brigadiers
        if (person.role === 'master') markerColor = '#8E44AD'; // Purple for master
        if (person.role === 'observer') markerColor = '#607D8B'; // Gray for observer
        // Add more roles/colors as needed

        // Directional arrow rotation
        const heading = person.heading != null ? person.heading : 0;
        const rotation = `transform: rotate(${heading}deg);`;

        // SVG: small dot + arrow
        const markerIcon = L.divIcon({
          className: 'person-marker',
          iconSize: [24, 32],
          iconAnchor: [12, 16],
          html: `
            <div style="${rotation} width:24px; height:32px; display:flex; align-items:center; justify-content:center;">
              <svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Arrow (points up, rotates with heading) -->
                <polygon points="12,2 16,12 12,9 8,12" fill="${markerColor}" stroke="black" stroke-width="1"/>
                <!-- Small dot -->
                <circle cx="12" cy="20" r="5" fill="${markerColor}" stroke="white" stroke-width="2"/>
              </svg>
            </div>
          `
        });
        // Create the marker with higher z-index to appear above geofences
        const marker = L.marker([person.location.lat, person.location.lng], {
          icon: markerIcon,
          zIndexOffset: isSelected ? 3000 : (isSecondaryHighlight ? 2500 : (isHighlighted ? 2000 : 1000)), // Higher z-index for selected/highlighted
          interactive: true, // Ensure marker is interactive
          bubblingMouseEvents: false // Prevent event bubbling that might interfere with clicks
        }).addTo(markersLayerRef.current);
        console.log('Adding marker to map:', person.name, person.location);

        // We intentionally avoid binding a click popup to skip the intermediate stage

        // Add tooltip for hover (shows basic info)
        const tooltipContent = `<strong>${person.name}</strong><br/>${person.role.charAt(0).toUpperCase() + person.role.slice(1)}<br/>${person.category || ''}`;
        marker.bindTooltip(tooltipContent, {
          permanent: false,
          direction: 'top',
          offset: [0, -30]
        });

        // Add marker to reference object for later access
        markerRefs.current[person.id] = marker;

        // Add click handler: open full dashboard in new browser tab directly
        marker.on('click', async (e) => {
          try {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);

            // Optional: notify selection callback
            if (onPersonSelect) {
              onPersonSelect(person);
            }

            // Open a blank new tab immediately to avoid popup blockers
            const newWin = window.open('', '_blank', 'width=1000,height=800,resizable,scrollbars');
            if (!newWin) return;

            // Write a minimal shell page and mount React content into it
            newWin.document.write(`<!DOCTYPE html><html><head><title>${person.name || 'User'} - Dashboard</title></head><body style='margin:0;background:#e9ecf5;'></body></html>`);
            newWin.document.close();

            // Create a container in the new window
            const container = newWin.document.createElement('div');
            container.id = 'person-dashboard-root';
            container.style.background = 'linear-gradient(135deg, rgb(244, 246, 250) 0%, rgb(233, 236, 245) 100%)';
            container.style.minHeight = '100vh';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            newWin.document.body.appendChild(container);

            // Copy stylesheets and inline styles to keep visuals identical
            try {
              Array.from(document.styleSheets).forEach(styleSheet => {
                try {
                  if (styleSheet.href) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = styleSheet.href;
                    newWin.document.head.appendChild(link);
                  } else if (styleSheet.cssRules) {
                    const styleEl = document.createElement('style');
                    Array.from(styleSheet.cssRules).forEach(rule => {
                      styleEl.appendChild(document.createTextNode(rule.cssText));
                    });
                    newWin.document.head.appendChild(styleEl);
                  }
                } catch (_) {
                  // ignore cross-origin stylesheets
                }
              });
            } catch (_) { }

            // Dynamically render PersonDashboardContent into the new window using React 18 root
            // Wrap in AuthProvider and RealtimeVitalsProvider to ensure API calls and real-time data work
            const { RealtimeVitalsProvider } = require('../contexts/RealtimeVitalsContext');
            const root = createRoot(container);
            root.render(
              React.createElement(AuthProvider, {},
                React.createElement(RealtimeVitalsProvider, {},
                  React.createElement(PersonDashboardContent, {
                    user: person,
                    latestVitals: person.vitals || null,
                    survival: person.survival || null,
                    isFullScreen: true
                  })
                )
              )
            );

            // Clean up when closed
            newWin.onbeforeunload = () => {
              try { root.unmount(); } catch (_) { }
            };
          } catch (err) {
            console.error('Failed to open dashboard tab:', err);
          }
        });

        // Add higher priority event handlers to ensure markers respond
        marker.on('mousedown', (e) => {
          L.DomEvent.stopPropagation(e);
        });

        marker.on('mouseup', (e) => {
          L.DomEvent.stopPropagation(e);
        });
      });

      // Only fit bounds on initial map load, not on updates
      if (!wasManuallyZoomed && validPersonnel.length > 0) {
        try {
          const bounds = L.latLngBounds(validPersonnel.map(p => [p.location.lat, p.location.lng]));
          if (bounds.isValid()) {
            mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          }
        } catch (error) {
          console.error("Error fitting bounds:", error);
        }
      } else if (wasManuallyZoomed) {
        // Restore previous view if user had already zoomed/panned
        mapInstanceRef.current.setView(currentCenter, currentZoom, { animate: false });
      }

      // Add current location marker if currentLocation is provided
      if (currentLocation && mapInstanceRef.current && markersLayerRef.current) {
        const L = window.L;
        // Marker color based on currentUser's role
        let markerColor = '#2A5CAA'; // Default: blue for soldiers
        const normalizedRole = currentUser?.role?.toUpperCase();
        if (normalizedRole === 'COMMANDER') markerColor = '#4CAF50'; // Green
        if (normalizedRole === 'BRIGADIER') markerColor = '#E67E22'; // Orange
        if (normalizedRole === 'MASTER') markerColor = '#8E44AD'; // Purple
        if (normalizedRole === 'OBSERVER') markerColor = '#607D8B'; // Gray
        // Directional arrow rotation (use heading if available)
        const heading = currentLocation.heading != null ? currentLocation.heading : 0;
        const rotation = `transform: rotate(${heading}deg);`;
        // SVG: small dot + arrow
        const currentLocationIcon = L.divIcon({
          className: 'person-marker',
          html: `<div style="${rotation} width:24px;height:32px;display:flex;align-items:center;justify-content:center;"><svg width='24' height='32' viewBox='0 0 24 32' fill='none' xmlns='http://www.w3.org/2000/svg'><polygon points='12,2 16,12 12,9 8,12' fill='${markerColor}' stroke='black' stroke-width='1'/><circle cx='12' cy='20' r='5' fill='${markerColor}' stroke='white' stroke-width='2'/></svg></div>`,
          iconSize: [24, 32],
          iconAnchor: [12, 16],
          popupAnchor: [0, -16],
        });
        const marker = L.marker([currentLocation.lat, currentLocation.lng], {
          icon: currentLocationIcon,
          zIndexOffset: 6000,
        });
        marker.addTo(markersLayerRef.current);
        mapInstanceRef.current._currentLocationMarker = marker;
      }

      // Add search location marker if searchLocation is provided
      if (searchLocation && mapInstanceRef.current && markersLayerRef.current) {
        const L = window.L;
        // Create a distinct search location marker with a different icon
        const searchLocationIcon = L.divIcon({
          className: 'search-location-marker',
          html: `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.9);border-radius:50%;border:3px solid #FF5722;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><svg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' fill='#FF5722'/></svg></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        });
        const searchMarker = L.marker([searchLocation.lat, searchLocation.lng], {
          icon: searchLocationIcon,
          zIndexOffset: 7000, // Higher than current location marker
        });

        // Add popup for search location
        const searchPopupContent = `
          <div style="text-align: center; padding: 8px;">
            <div style="font-weight: bold; color: #FF5722; margin-bottom: 4px;">
              <i class="material-icons" style="font-size: 16px; vertical-align: middle;">search</i>
              Searched Location
            </div>
            <div style="font-size: 12px; color: #666;">
              ${searchLocation.label || 'Location'}
            </div>
            <div style="font-size: 10px; color: #999; margin-top: 4px;">
              ${searchLocation.lat.toFixed(6)}, ${searchLocation.lng.toFixed(6)}
            </div>
          </div>
        `;
        searchMarker.bindPopup(searchPopupContent);

        searchMarker.addTo(markersLayerRef.current);
        mapInstanceRef.current._searchLocationMarker = searchMarker;
      }
    } catch (error) {
      console.error("Error in updateMarkers:", error);
    }
  }, [personnel, highlightedTroops, selectedPersonId, isDrawMode, currentLocation, searchLocation]);

  /**
   * Create custom icons based on role and highlight status
   * 
   * @param {string} role - User role (SOLDIER, COMMANDER, MASTER)
   * @param {boolean} isHighlighted - Whether the marker should be highlighted
   * @returns {Object} Leaflet icon object using external URLs
   */
  const getMarkerIcon = (role, isHighlighted, isSelected) => {
    if (!window.L) return null;
    // Use only the custom SVG marker for all roles
    let shirtColor = '#2A5CAA'; // Default: blue for soldiers
    const normalizedRole = role?.toUpperCase();
    if (normalizedRole === 'COMMANDER') shirtColor = '#4CAF50'; // Green
    if (normalizedRole === 'BRIGADIER') shirtColor = '#E67E22'; // Orange
    if (normalizedRole === 'MASTER') shirtColor = '#8E44AD'; // Purple
    if (normalizedRole === 'OBSERVER') shirtColor = '#607D8B'; // Gray
    // Add more roles/colors as needed
    const rotation = '';
    return window.L.divIcon({
      className: isSelected ? 'selected-marker' : (isHighlighted ? 'highlighted-marker' : 'default-marker'),
      iconSize: [28, 40],
      iconAnchor: [14, 39],
      html: `
        <div style="${rotation} width:28px; height:40px; display:flex; align-items:center; justify-content:center;">
          <svg width="28" height="40" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 0C7.37258 0 2 5.37258 2 12C2 21 14 40 14 40C14 40 26 21 26 12C26 5.37258 20.6274 0 14 0Z" fill="${shirtColor}"/>
            <circle cx="14" cy="14" r="6" fill="white"/>
          </svg>
        </div>
      `
    });
  };

  /**
   * Create popup content with conditional information based on user permissions
   * 
   * @param {Object} person - Personnel data object
   * @param {boolean} isHighlighted - Whether this person is highlighted
   * @returns {string} HTML content for popup
   */
  const createPopupContent = (person, isHighlighted) => {
    const canViewDetails =
      currentUser.role === ROLES.MASTER ||
      currentUser.role === ROLES.OBSERVER ||
      (currentUser.role === ROLES.COMMANDER && currentUser.troops && currentUser.troops.includes(person.id)) ||
      currentUser.id === person.id;

    let content = `
      <div style="min-width: 150px;">
        <strong>${person.name}</strong><br/>
        ${person.role.charAt(0).toUpperCase() + person.role.slice(1)}<br/>
        ${person.category || ''}
    `;

    // Add highlight indicator if applicable
    if (isHighlighted) {
      content += `
        <div style="color: #FFD700; font-weight: bold; margin-top: 5px;">
          ★ Assigned Troop ★
        </div>
      `;
    }

    // Add vitals info if permissions allow and data exists
    if (canViewDetails) {
      content += `
        <hr style="margin: 5px 0; border-top: 1px solid #eee;" />
        <div style="font-size: 12px;">
          <strong>Status:</strong> Active<br/>
      `;

      // Only add vitals if they exist
      if (person.vitals) {
        content += `
          ${person.vitals.bp ? `<strong>BP:</strong> ${person.vitals.bp}<br/>` : '<strong>BP:</strong> Not available<br/>'}
          ${person.vitals.spo2 ? `<strong>SpO2:</strong> ${person.vitals.spo2}%<br/>` : '<strong>SpO2:</strong> Not available<br/>'}
        `;
      } else {
        content += `
          <strong>Vitals:</strong> No sensor data available<br/>
        `;
      }

      content += `</div>`;
    }

    content += `</div>`;
    return content;
  };

  /**
   * Detail panel for selected person (only shown when NOT in full-page mode)
   * Displays detailed information about the selected personnel
   * 
   * @param {Object} person - The selected person's data
   */
  const DetailPanel = ({ person }) => {
    if (!person || isFullPage) return null;

    return (
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'white',
        // padding: '15px', 
        borderRadius: '8px',
        boxShadow: '0 0 15px rgba(0, 0, 0, 0.2)',
        zIndex: 1000,
        minWidth: '250px',
        maxWidth: '350px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {previouslySelectedPerson && (
              <button
                onClick={() => {
                  setSelectedPersonInternal(previouslySelectedPerson);
                  setPreviouslySelectedPerson(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  marginRight: '8px',
                  color: '#3498db',
                  fontSize: '16px',
                  padding: '0',
                }}
                title="Go back to previous selection"
              >
                <i className="fas fa-arrow-left"></i>
              </button>
            )}
            <h4 style={{ margin: 0 }}>{person.name}</h4>
          </div>
          <button
            onClick={() => {
              setSelectedPersonInternal(null);
              setPreviouslySelectedPerson(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '0',
              color: '#aaa'
            }}
            title="Close details"
          >
            ×
          </button>
        </div>

        <p><strong>Role:</strong> {person.role.charAt(0).toUpperCase() + person.role.slice(1)}</p>
        <p><strong>Category:</strong> {person.category || 'Not specified'}</p>

        {person.vitals ? (
          <>
            <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid #eee' }} />
            <h5 style={{ marginTop: 0 }}>Vitals</h5>
            <p><strong>Blood Pressure:</strong> {person.vitals.bp || 'Not available'}</p>
            <p><strong>SpO2:</strong> {person.vitals.spo2 ? `${person.vitals.spo2}%` : 'Not available'}</p>
            <p><strong>Steps Today:</strong> {person.vitals.steps || 'Not available'}</p>
            <p><strong>Sleep:</strong> {person.vitals.sleep || 'Not available'}</p>
          </>
        ) : (
          <>
            <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid #eee' }} />
            <h5 style={{ marginTop: 0 }}>Vitals</h5>
            <p style={{ color: '#e74c3c' }}>No sensor data available for this user</p>
          </>
        )}

        <div style={{ marginTop: '15px', textAlign: 'center' }}>
          <button
            onClick={() => {
              if (onPersonSelect) onPersonSelect(person);
              setSelectedPersonInternal(null);
            }}
            style={{
              padding: '5px 15px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: 'auto',
              marginRight: '5px'
            }}
          >
            View Full Details
          </button>
          <button
            onClick={() => {
              setSelectedPersonInternal(null);
              setPreviouslySelectedPerson(null);
            }}
            style={{
              padding: '5px 15px',
              backgroundColor: '#7f8c8d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: 'auto'
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  /**
   * Map legend component that displays marker color meanings
   */
  const MapLegend = () => (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: '70px',
      marginLeft: 0,
      backgroundColor: 'white',
      padding: '3px 6px 2px 6px',
      borderRadius: '5px',
      boxShadow: '0 0 4px rgba(0, 0, 0, 0.08)',
      zIndex: 1000,
      fontSize: '9px',
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'column',
      minHeight: '24px',
      minWidth: 'fit-content',
      maxWidth: '60vw',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontWeight: 'bold', marginBottom: 2, fontSize: '10px' }}>Legend</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
        {/* First row: 3 items */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'flex-end', justifyContent: 'center' }}>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Soldier marker */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="8,1 11,7 8,5.5 5,7" fill="#2A5CAA" stroke="black" strokeWidth="0.7" />
              <circle cx="8" cy="13" r="3.2" fill="#2A5CAA" stroke="white" strokeWidth="1.2" />
            </svg>
            <span style={{ marginTop: 0 }}>Soldier</span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Commander marker */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="8,1 11,7 8,5.5 5,7" fill="#4CAF50" stroke="black" strokeWidth="0.7" />
              <circle cx="8" cy="13" r="3.2" fill="#4CAF50" stroke="white" strokeWidth="1.2" />
            </svg>
            <span style={{ marginTop: 0 }}>Commander</span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Brigadier marker */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="8,1 11,7 8,5.5 5,7" fill="#E67E22" stroke="black" strokeWidth="0.7" />
              <circle cx="8" cy="13" r="3.2" fill="#E67E22" stroke="white" strokeWidth="1.2" />
            </svg>
            <span style={{ marginTop: 0 }}>Brigadier</span>
          </span>
        </div>
        {/* Second row: remaining items */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'flex-end', justifyContent: 'center', marginTop: 1 }}>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Master marker */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="8,1 11,7 8,5.5 5,7" fill="#8E44AD" stroke="black" strokeWidth="0.7" />
              <circle cx="8" cy="13" r="3.2" fill="#8E44AD" stroke="white" strokeWidth="1.2" />
            </svg>
            <span style={{ marginTop: 0 }}>Master</span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Observer marker */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="8,1 11,7 8,5.5 5,7" fill="#607D8B" stroke="black" strokeWidth="0.7" />
              <circle cx="8" cy="13" r="3.2" fill="#607D8B" stroke="white" strokeWidth="1.2" />
            </svg>
            <span style={{ marginTop: 0 }}>Observer</span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '8px', height: '8px', border: '1.5px dashed #27ae60', borderRadius: '50%', backgroundColor: 'rgba(39, 174, 96, 0.1)' }}></div>
            <span style={{ marginTop: 0 }}>Geofence</span>
          </span>
          {highlightedTroops.length > 0 && (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', border: '1.5px solid #FFFF00' }}></div>
              <span style={{ marginTop: 0 }}>Highlighted Troop</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );

  /**
   * Get highlighted troops based on selected person
   */
  const getHighlightedTroops = useCallback(() => {
    if (!selectedPersonId) return [];

    const selectedPersonData = personnel.find(p => p.id === parseInt(selectedPersonId));
    if (!selectedPersonData) return [];

    let troopsToHighlight = [selectedPersonId];

    // If selected person is a commander, highlight their troops
    if (selectedPersonData.role === ROLES.COMMANDER && selectedPersonData.troops) {
      troopsToHighlight = [...troopsToHighlight, ...selectedPersonData.troops.map(id => id.toString())];
    }

    return troopsToHighlight;
  }, [selectedPersonId, personnel]);

  /**
   * Handle highlighting and show info tag when person is selected from panel
   */
  useEffect(() => {
    if (!selectedPersonId || !mapInstanceRef.current || !markersLayerRef.current) return;

    const selectedPersonData = personnel.find(p => p.id === parseInt(selectedPersonId));
    if (!selectedPersonData || !selectedPersonData.location) return;

    // Zoom to the selected person
    const lat = selectedPersonData.location.lat;
    const lng = selectedPersonData.location.lng;

    // Animate to the location
    mapInstanceRef.current.flyTo([lat, lng], 14, {
      duration: 1.5,
      easeLinearity: 0.25
    });

    // Add info tag instead of pulse
    setTimeout(() => {
      if (mapInstanceRef.current) {
        const L = window.L;

        // Create an info popup that stays visible
        const infoPopup = L.popup({
          closeButton: false,
          autoClose: false,
          closeOnClick: false,
          className: 'info-tag-popup'
        })
          .setLatLng([lat, lng])
          .setContent(`
          <div class="info-tag">
            <strong>${selectedPersonData.name}</strong><br/>
            <span class="role-tag">${selectedPersonData.role.charAt(0).toUpperCase() + selectedPersonData.role.slice(1)}</span>
          </div>
        `)
          .openOn(mapInstanceRef.current);

        // Remove the info tag after 3 seconds
        setTimeout(() => {
          if (infoPopup && mapInstanceRef.current) {
            mapInstanceRef.current.closePopup(infoPopup);
          }
        }, 3000);
      }
    }, 1600); // Start after zoom animation

  }, [selectedPersonId, personnel]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (zoneDropdownRef.current && !zoneDropdownRef.current.contains(event.target)) {
        setZoneDropdownOpen(false);
      }
    }
    if (zoneDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [zoneDropdownOpen]);

  // Function to trigger Leaflet-draw actions
  const triggerLeafletDraw = (action) => {
    const mapContainer = document.querySelector('.leaflet-container');
    if (!mapContainer) return;
    let btn;
    if (action === 'draw') {
      btn = mapContainer.querySelector('.leaflet-draw-draw-polygon');
    } else if (action === 'edit') {
      btn = mapContainer.querySelector('.leaflet-draw-edit-edit');
    } else if (action === 'remove') {
      btn = mapContainer.querySelector('.leaflet-draw-edit-remove');
    }
    if (btn) btn.click();
    setZoneDropdownOpen(false);
  };

  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerStreetRef.current || !tileLayerSatelliteRef.current) return;
    if (mapLayer === 'satellite') {
      tileLayerStreetRef.current.setOpacity(0);
      tileLayerSatelliteRef.current.setOpacity(1);
    } else {
      tileLayerStreetRef.current.setOpacity(1);
      tileLayerSatelliteRef.current.setOpacity(0);
    }
  }, [mapLayer]);

  // Helper to fetch latest vitals for a user
  async function fetchLatestVitals(userId) {
    try {
      const res = await apiGet(`/vitals/asset/${userId}?limit=1`);
      if (res.success && res.vitals && res.vitals.length > 0) {
        return res.vitals[0];
      }
    } catch (e) { }
    return null;
  }

  // Handler to open zone monitor window
  async function handleZoneMonitor(zoneId) {
    setZoneMonitorOpen(false);
    setZoneMonitorData(null);
    setZoneMonitorSoldiers([]);
    try {
      const [zoneRes, personnelRes] = await Promise.all([
        apiGet(`/zones/${zoneId}`),
        apiGet(`/zones/${zoneId}/personnel`)
      ]);
      if (zoneRes.success && personnelRes.success) {
        const zone = zoneRes.zone;
        const personnel = personnelRes.personnel || [];
        // Fetch vitals for each soldier in parallel
        const soldiersWithVitals = await Promise.all(personnel.map(async (soldier) => {
          const vitals = await fetchLatestVitals(soldier.id);
          return { ...soldier, vitals };
        }));
        setZoneMonitorData(zone);
        setZoneMonitorSoldiers(soldiersWithVitals);
        setZoneMonitorOpen(true);
      }
    } catch (e) {
      // Optionally show error
    }
  }

  // Handler for soldier card click
  function handleSoldierCardClick(soldier) {
    setSoldierDetail(soldier);
  }

  useEffect(() => {
    console.log('PersonnelMap received personnel:', personnel);
  }, [personnel]);

  if (mapInitError) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: '#f8d7da',
        color: '#721c24',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h4>Map Error</h4>
        <p>{mapInitError}</p>
        <p>This could be due to a network issue or a problem with the map service.</p>
        <button
          onClick={initializeMap}
          style={{
            marginTop: '10px',
            padding: '8px 15px',
            backgroundColor: '#0275d8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry Loading Map
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{ position: 'relative', height: isFullPage ? '100vh' : 'auto' }}>
        {/* Map container with appropriate sizing based on view mode */}
        <div
          ref={mapRef}
          style={{
            // left: '60px',
            height: isFullPage ? '100vh' : '100vh',
            width: '100%',
            flex: 1,
            borderRadius: isFullPage ? '0' : '8px',
            overflow: 'hidden', // Prevent content overflow
            border: 'none',
            padding: '0',
            margin: '0'
          }}
          className={`map-container ${isFullPage ? 'full-page-map' : ''}`}
        />
        {/* Show map legend when map is ready */}
        {mapReady && <MapLegend />}
        {/* Show detail panel when a person is selected */}
        {selectedPersonInternal && <DetailPanel person={selectedPersonInternal} />}
        {/* DrawPolygon component for geofence drawing */}
        {mapReady && mapInstanceRef.current && (
          <DrawPolygon
          // personnel={personnel}
          // mapInstance={mapInstanceRef.current}
          // mapConfig={mapConfig}
          // setMapConfig={setMapConfig}
          />
        )}

        {/* User Dashboard Manager for individual user cards */}
        <PersonDashboardManager ref={dashboardManagerRef} />

        {/* Add CSS for highlighted markers */}
        <style>
          {`
            @keyframes pulse {
              0% {
                transform: scale(0.5);
                opacity: 1;
              }
              100% {
                transform: scale(1.5);
                opacity: 0;
              }
            }
            
            .full-page-map {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
            }
            
            .leaflet-container {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
                'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
              font-size: 14px;
              font-weight: 400;
            }

            /* Hide Leaflet Draw default UI; we'll control via our dropdown */
            .leaflet-draw-toolbar,
            .leaflet-draw-actions {
              display: none !important;
            }

            /* Pulse animation for selected markers */
            @keyframes pulse {
              0% {
                transform: scale(1);
                opacity: 1;
              }
              50% {
                transform: scale(1.2);
                opacity: 0.7;
              }
              100% {
                transform: scale(1);
                opacity: 1;
              }
            }
            
            .pulse-marker {
              animation: pulse 2s ease-in-out infinite;
            }
            
            .selected-marker {
              filter: drop-shadow(0 0 10px #FFD700) drop-shadow(0 0 20px #FFD700);
              animation: pulse 2s ease-in-out infinite;
            }
            
            .highlighted-marker {
              filter: drop-shadow(0 0 5px #FFA500) drop-shadow(0 0 10px #FFA500);
            }
            
            .default-marker {
              filter: none;
            }
            
            /* Stationary pulse for map circles */
            .pulse-marker-stationary {
              animation: stationaryPulse 2s ease-in-out 3;
            }
            
            @keyframes stationaryPulse {
              0% {
                opacity: 0.7;
                stroke-width: 3;
              }
              50% {
                opacity: 0.3;
                stroke-width: 6;
              }
              100% {
                opacity: 0.7;
                stroke-width: 3;
              }
            }

            /* Info tag popup styles */
            .info-tag-popup .leaflet-popup-content-wrapper {
              background: rgba(234, 228, 228, 0.54);
              color: white;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            
            .info-tag-popup .leaflet-popup-content {
              margin: 8px 12px;
              line-height: 1.4;
              font-size: 14px;
            }
            
            .info-tag {
              text-align: center;
              min-width: 120px;
            }
            
            .info-tag strong {
              display: block;
              margin-bottom: 4px;
              font-size: 16px;
            }
            
            .role-tag {
              background: rgba(255, 255, 255, 0.2);
              padding: 2px 6px;
              border-radius: 12px;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .info-tag-popup .leaflet-popup-tip {
              background: rgba(0, 0, 0, 0.8);
            }

            /* Zone Detail Popup Styling - Matching PersonDashboardPopup */
            .zone-detail-popup .leaflet-popup-content-wrapper {
              padding: 0;
              border-radius: 8px 8px 0 0;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
              overflow: visible;
            }

            .zone-detail-popup .leaflet-popup-content {
              margin: 0;
              padding: 0;
              width: 700px !important;
              min-height: 600px;
            }

            .zone-detail-popup .leaflet-popup-tip {
              background: white;
            }

            .zone-detail-popup .leaflet-popup-close-button {
              color: white !important;
              font-size: 24px !important;
              font-weight: bold !important;
              top: 12px !important;
              right: 12px !important;
              width: 24px !important;
              height: 24px !important;
              z-index: 1000;
            }

            .zone-detail-popup .leaflet-popup-close-button:hover {
              color: #f0f0f0 !important;
            }

            .zone-detail-popup h3,
            .zone-detail-popup h4 {
              font-family: system-ui, -apple-system, sans-serif;
            }

            /* Hide only the main Leaflet-draw toolbar buttons, keep toolbar and sub-action buttons visible */
            // .leaflet-draw-toolbar .leaflet-draw-toolbar-button {
            //   display: none !important;
            // }
            .leaflet-draw { z-index: 10000 !important; }
          `}
        </style>
      </div>
      <ZoneAssignmentDialog
        isOpen={zoneDialogOpen}
        onClose={() => {
          setZoneDialogOpen(false);
          setPendingZoneCoords(null);
          setEditingZoneId(null);
        }}
        onSave={({ name, coordinates, assignments, description }) => {
          try {
            if (editingZoneId) {
              // Normalize coordinates to array format [[lat, lng], ...]
              let normalizedPoints;
              if (Array.isArray(coordinates)) {
                if (coordinates.length > 0) {
                  // Check if first element is an object with lat/lng or already an array
                  if (typeof coordinates[0] === 'object' && coordinates[0] !== null && 'lat' in coordinates[0] && 'lng' in coordinates[0]) {
                    // Format: [{lat, lng}, ...] -> [[lat, lng], ...]
                    normalizedPoints = coordinates.map(c => [c.lat, c.lng]);
                  } else if (Array.isArray(coordinates[0]) && coordinates[0].length >= 2) {
                    // Format: [[lat, lng], ...] -> already correct
                    normalizedPoints = coordinates;
                  } else {
                    console.error('Invalid coordinate format:', coordinates);
                    try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'error', message: 'Invalid coordinate format' } })); } catch (_) { }
                    return;
                  }
                } else {
                  console.error('Coordinates array is empty');
                  try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'error', message: 'Polygon must have at least 3 points' } })); } catch (_) { }
                  return;
                }
              } else {
                console.error('Coordinates is not an array:', coordinates);
                try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'error', message: 'Invalid coordinates data' } })); } catch (_) { }
                return;
              }

              if (normalizedPoints.length < 3) {
                console.error('Polygon must have at least 3 points, got:', normalizedPoints.length);
                try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'error', message: 'Polygon must have at least 3 points' } })); } catch (_) { }
                return;
              }

              console.log('Updating geofence with points:', normalizedPoints);
              console.log('Number of points:', normalizedPoints.length);
              console.log('Editing zone ID:', editingZoneId);

              // Update existing geofence (edit flow) - ensure we're updating, not creating
              if (!editingZoneId) {
                console.error('Editing zone ID is missing! Cannot update zone.');
                try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'error', message: 'Error: Zone ID missing. Cannot update zone.' } })); } catch (_) { }
                return;
              }

              apiPut(`/v1/geofences/${editingZoneId}`, {
                name,
                description: description || '',
                level: description || '',
                points: normalizedPoints,
                polygon_coordinates: normalizedPoints,
                coordinates: normalizedPoints,
                unit_id: assignments?.unit?.id || null,
                user_id: currentUser.id,
                user_role: currentUser.role.toUpperCase(),
              })
                .then((res) => {
                  if (res && res.success) {
                    try { window.dispatchEvent(new Event('geofence-changed')); } catch (_) { }
                    try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'success', message: 'Zone updated successfully' } })); } catch (_) { }
                    // Keep edit mode active; allow user to continue resizing and re-open popup
                    try {
                      const drawControl = document.querySelector('.leaflet-draw');
                      if (drawControl) drawControl.style.display = 'block';
                      const toolbar = document.querySelector('.leaflet-draw-actions');
                      if (toolbar) toolbar.style.display = 'block';
                    } catch (_) { }
                  } else {
                    try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'error', message: 'Failed to update zone' } })); } catch (_) { }
                  }
                })
                .catch((err) => {
                  console.error('Error updating geofence:', err);
                  try { window.dispatchEvent(new CustomEvent('app-notify', { detail: { type: 'error', message: 'Error updating geofence: ' + err.message } })); } catch (_) { }
                })
                .finally(() => {
                  setZoneDialogOpen(false);
                  setPendingZoneCoords(null);
                  // Do NOT clear editingZoneId here; keep user in edit session
                });
            } else {
              // Create new zone (existing flow)
              saveNewZone(name, coordinates, assignments, description);
              setZoneDialogOpen(false);
              setPendingZoneCoords(null);
              setEditingZoneId(null);
            }
          } catch (e) {
            console.error('Zone save error:', e);
          }
        }}
        coordinates={pendingZoneCoords}
        searchData={zoneAssignmentData}
        initial={pendingZoneInitial}
        isEditing={Boolean(editingZoneId)}
      />
      <ZoneMonitorWindow
        isOpen={zoneMonitorOpen}
        onClose={() => setZoneMonitorOpen(false)}
        zone={zoneMonitorData}
        soldiers={zoneMonitorSoldiers}
        onSoldierClick={handleSoldierCardClick}
      />
      <SoldierDetailWindow
        isOpen={!!soldierDetail}
        onClose={() => setSoldierDetail(null)}
        soldier={soldierDetail}
      />
    </>
  );
});

export default PersonnelMap;