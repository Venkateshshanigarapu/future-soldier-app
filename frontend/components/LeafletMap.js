import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

const LeafletMap = ({
  region,
  markers = [],
  polygons = [],
  circles = [],
  polylines = [],
  mapLayer = 'street',
  localTileUrl = 'http://117.251.19.107:8000/',
  onRegionChange,
  onLoad
}) => {
  const webViewRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        html, body { height: 100%; margin: 0; padding: 0; background: #ddd; }
        #map { height: 100%; width: 100%; }
        #loading {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          display: flex; align-items: center; justify-content: center;
          background: #f0f0f0; z-index: 9999; font-family: sans-serif;
        }
        /* Custom User Marker Style */
        .user-marker {
          background: transparent;
          border: none;
        }
      </style>
    </head>
    <body>
      <div id="loading">Loading local tiles...</div>
      <div id="map"></div>
      <script>
        (function() {
          var oldLog = console.log;
          console.log = function() {
            var message = Array.from(arguments).join(' ');
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'console', log: message }));
            }
            oldLog.apply(console, arguments);
          };
          var oldError = console.error;
          console.error = function() {
            var message = Array.from(arguments).join(' ');
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'console', error: message }));
            }
            oldError.apply(console, arguments);
          };
        })();

        try {
          console.log('Leaflet initializing...');
          
          // Test connection to tile server
          fetch('${localTileUrl}', { mode: 'no-cors' })
            .then(() => console.log('Connection to tile server (${localTileUrl}) OK'))
            .catch(err => console.error('Connection to tile server (${localTileUrl}) FAILED: ' + err.message));

          var map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            rotate: false,
            touchRotate: false,
            maxZoom: 22,
          }).setView([${region?.latitude || 17.4822}, ${region?.longitude || 78.4790}], ${region?.zoom || 13});

          // Map rotation is disabled.

          var streetLayer = L.tileLayer('${localTileUrl}/tiles/{z}/{x}/{y}.png', {
            maxZoom: 22,
            maxNativeZoom: 19, // Use native tiles up to 19, then upscale
            noWrap: true
          });

          var satelliteLayer = L.tileLayer('${localTileUrl}/satellite/{z}/{x}/{y}.png', {
            maxZoom: 22,
            maxNativeZoom: 19,
            noWrap: true
          });

          // GeoServer WMS Layers
          var geoStreetLayer = L.tileLayer.wms('http://117.251.19.107/geoserver/OCFALAYERS/wms', {
            layers: 'OCFALAYERS:STREET VIEW',
            format: 'image/png',
            transparent: true,
            version: '1.1.1',
            minZoom: 12, // Only visible from zoom level 12
            maxZoom: 22, // Visible up to zoom level 22
            attribution: 'GeoServer'
          });

          var geoTerrainLayer = L.tileLayer.wms('http://117.251.19.107/geoserver/OCFALAYERS/wms', {
            layers: 'OCFALAYERS:TERRAIN VIEW',
            format: 'image/png',
            transparent: true,
            version: '1.1.1',
            maxZoom: 22,
            attribution: 'GeoServer'
          });

          var geoTrafficLayer = L.tileLayer.wms('http://117.251.19.107/geoserver/OCFALAYERS/wms', {
            layers: 'OCFALAYERS:TRAFFIC VIEW',
            format: 'image/png',
            transparent: true,
            version: '1.1.1',
            maxZoom: 22,
            attribution: 'GeoServer'
          });

          // States Layer - Always visible
          var geoStatesLayer = L.tileLayer.wms('http://117.251.19.107/geoserver/OCFALAYERS/wms', {
            layers: 'OCFALAYERS:states',
            format: 'image/png',
            transparent: true,
            version: '1.1.1',
            maxZoom: 22,
            zIndex: 1000, // Keep on top
            attribution: 'GeoServer'
          });

          var currentLayers = [];

          function switchLayer(layerName) {
            // Remove existing layers
            currentLayers.forEach(function(l) { map.removeLayer(l); });
            currentLayers = [];
            
            console.log('Switching map layer to:', layerName);
            
            if (layerName === 'satellite') {
                satelliteLayer.addTo(map);
                currentLayers.push(satelliteLayer);
            } else if (layerName === 'geoStreet') {
                // Keep Normal Map as base for Street View
                streetLayer.addTo(map);
                geoStreetLayer.addTo(map);
                currentLayers.push(streetLayer, geoStreetLayer);
            } else if (layerName === 'geoTerrain') {
                // Keep Normal Map as base for Terrain View
                streetLayer.addTo(map);
                geoTerrainLayer.addTo(map);
                currentLayers.push(streetLayer, geoTerrainLayer);
            } else if (layerName === 'geoTraffic') {
                streetLayer.addTo(map);
                geoTrafficLayer.addTo(map);
                currentLayers.push(streetLayer, geoTrafficLayer);
            } else {
                // Default: Normal Map
                streetLayer.addTo(map);
                currentLayers.push(streetLayer);
            }

            // Always add States Layer on top
            geoStatesLayer.addTo(map);
            currentLayers.push(geoStatesLayer);
          }

          switchLayer('${mapLayer}');

          function logTileError(e) {
            var url = e.url || e.tile?.src || 'unknown';
            console.error('Tile load failed: ' + url);
          }
          streetLayer.on('tileerror', logTileError);
          satelliteLayer.on('tileerror', logTileError);

          document.getElementById('loading').style.display = 'none';

          var markersGroup = L.layerGroup().addTo(map);
          var polygonsGroup = L.layerGroup().addTo(map);
          var circlesGroup = L.layerGroup().addTo(map);
          var polylinesGroup = L.layerGroup().addTo(map);

          function updateMarkers(markers) {
            console.log('updateMarkers called with', markers.length, 'markers');
            markersGroup.clearLayers();
            markers.forEach(m => {
              if (m.latitude && m.longitude) {
                if (m.type === 'user') {
                   // Directional arrow for user
                   var heading = m.heading || 0;
                   // Use SVG for smoother arrow
                   // Map is fixed North-up. Rotate arrow by device heading.
                   var arrowSvg = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(' + heading + 'deg); filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.3));">' +
                      '<path d="M12 2L4.5 20.5L12 17L19.5 20.5L12 2Z" fill="#2E3192" stroke="white" stroke-width="2" stroke-linejoin="round"/>' +
                      '</svg>';
                   
                   var icon = L.divIcon({
                      className: 'user-marker',
                      html: arrowSvg,
                      iconSize: [40, 40],
                      iconAnchor: [20, 20]
                   });
                   L.marker([m.latitude, m.longitude], { icon: icon, zIndexOffset: 1000 }).addTo(markersGroup)
                    .bindPopup(m.title || '');
                } else {
                   L.marker([m.latitude, m.longitude]).addTo(markersGroup)
                    .bindPopup(m.title || '');
                }
              }
            });
          }

          function updatePolygons(polygons) {
            polygonsGroup.clearLayers();
            polygons.forEach(p => {
              if (p.coordinates && p.coordinates.length >= 3) {
                L.polygon(p.coordinates.map(c => [c.latitude, c.longitude]), {
                  color: p.strokeColor || 'blue',
                  fillColor: p.fillColor || 'blue',
                  fillOpacity: 0.2
                }).addTo(polygonsGroup);
              }
            });
          }

          function updateCircles(circles) {
            circlesGroup.clearLayers();
            circles.forEach(c => {
              if (c.center && c.radius) {
                L.circle([c.center.latitude, c.center.longitude], {
                  radius: c.radius,
                  color: c.strokeColor || 'red',
                  fillColor: c.fillColor || 'red',
                  fillOpacity: 0.2
                }).addTo(circlesGroup);
              }
            });
          }

          function updatePolylines(polylines) {
            polylinesGroup.clearLayers();
            polylines.forEach(p => {
              if (p.coordinates && p.coordinates.length >= 2) {
                L.polyline(p.coordinates.map(c => [c.latitude, c.longitude]), {
                  color: p.strokeColor || 'blue',
                  weight: p.strokeWidth || 3
                }).addTo(polylinesGroup);
              }
            });
          }

          function handleMessage(event) {
             try {
               var data = JSON.parse(event.data);
               console.log('WebView received message:', data.type);
               
               if (data.type === 'updateData') {
                 console.log('Processing updateData. Markers:', data.markers ? data.markers.length : 0);
                 if (data.markers) updateMarkers(data.markers);
                 if (data.polygons) updatePolygons(data.polygons);
                 if (data.circles) updateCircles(data.circles);
                 if (data.polylines) updatePolylines(data.polylines);
               } else if (data.type === 'setLayer') {
                  switchLayer(data.layer);
               } else if (data.type === 'setRegion') {
                 map.setView([data.latitude, data.longitude], data.zoom || map.getZoom());
               }
             } catch(e) {
               console.error('Leaflet message error:', e);
             }
          }

          window.addEventListener('message', handleMessage);
          document.addEventListener('message', handleMessage);
          console.log('WebView message listeners attached (window + document)');

          map.on('moveend', function() {
            var center = map.getCenter();
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'onRegionChange',
                latitude: center.lat,
                longitude: center.lng,
                zoom: map.getZoom()
              }));
            }
          });

          // Signal that the map is ready
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'onLoad' }));
          }
        } catch(err) {
          document.getElementById('loading').innerHTML = 'Map error: ' + err.message;
          console.error('Leaflet init error:', err);
        }
      </script>
    </body>
    </html>
  `;

  // Fallback: force readiness if signal is missed
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isMapReady) {
        console.log('[LeafletMap] Force-setting map ready after timeout');
        setIsMapReady(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [isMapReady]);

  useEffect(() => {
    if (webViewRef.current && isMapReady) {
      console.log('[LeafletMap] Sending data update to WebView:', { markers: markers.length });
      webViewRef.current.postMessage(JSON.stringify({
        type: 'updateData',
        markers,
        polygons,
        circles,
        polylines
      }));
    }
  }, [markers, polygons, circles, polylines, isMapReady]);

  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'setLayer',
        layer: mapLayer
      }));
    }
  }, [mapLayer]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        androidHardwareAccelerationDisabled={false}
        startInLoadingState={true}
        onLoad={() => {
          console.log('[LeafletMap] WebView loaded');
          if (onLoad) onLoad();
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'console') {
              console.log(`[WebView ${data.error ? 'ERROR' : 'LOG'}]`, data.log || data.error);
              return;
            }
            if (data.type === 'onLoad') {
              console.log('[LeafletMap] Map ready signal received');
              setIsMapReady(true);
              if (onLoad) onLoad();
              return;
            }
            if (data.type === 'onRegionChange' && onRegionChange) {
              onRegionChange(data);
            }
          } catch (e) {
            console.error('onMessage error:', e);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  }
});

export default LeafletMap;
