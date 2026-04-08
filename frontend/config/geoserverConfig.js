export const GEOSERVER_CONFIG = {
    // Use port 80 proxy via Nginx
    baseUrl: 'http://117.251.19.107/geoserver',
    workspace: 'OCFALAYERS',
    layers: {
        states: {
            name: 'states',
            displayName: 'States',
            opacity: 1.0,
        },
        street: {
            name: 'STREET VIEW',
            displayName: 'Street View',
            opacity: 1.0,
        },
        terrain: {
            name: 'TERRAIN VIEW',
            displayName: 'Terrain View',
            opacity: 1.0,
        },
        /*
        traffic: {
            name: 'TRAFFIC VIEW',
            displayName: 'Geo Traffic',
            opacity: 0.8,
        }
        */
    },
    wmsParams: {
        service: 'WMS',
        version: '1.1.1',
        request: 'GetMap',
        format: 'image/png',
        transparent: true,
        srs: 'EPSG:4326' // EPSG:4326 is supported and standard for WMS 1.1.1
    }
};
