// utils/geoUtils.ts
// Comprehensive geo utilities for the job matching app

export interface Coordinates {
    latitude: number;
    longitude: number;
}

export interface BoundingBox {
    north: number;
    south: number;
    east: number;
    west: number;
}

// Distance calculation using Haversine formula
export const calculateDistance = (point1: Coordinates, point2: Coordinates): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(point2.latitude - point1.latitude);
    const dLon = toRadians(point2.longitude - point1.longitude);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(point1.latitude)) * Math.cos(toRadians(point2.latitude)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Convert degrees to radians
const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

// Convert radians to degrees
const toDegrees = (radians: number): number => radians * (180 / Math.PI);

// Calculate bounding box for a given center point and radius
export const getBoundingBox = (center: Coordinates, radiusKm: number): BoundingBox => {
    const lat = toRadians(center.latitude);
    const lng = toRadians(center.longitude);
    const r = radiusKm / 6371; // radius in radians

    const minLat = lat - r;
    const maxLat = lat + r;

    const deltaLng = Math.asin(Math.sin(r) / Math.cos(lat));
    const minLng = lng - deltaLng;
    const maxLng = lng + deltaLng;

    return {
        north: toDegrees(maxLat),
        south: toDegrees(minLat),
        east: toDegrees(maxLng),
        west: toDegrees(minLng)
    };
};

// Check if a point is within a bounding box
export const isWithinBounds = (point: Coordinates, bounds: BoundingBox): boolean => {
    return (
        point.latitude >= bounds.south &&
        point.latitude <= bounds.north &&
        point.longitude >= bounds.west &&
        point.longitude <= bounds.east
    );
};

// Generate Firestore geohash for efficient geo queries (simplified version)
export const generateGeohash = (coordinates: Coordinates, precision: number = 7): string => {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';

    let lat = coordinates.latitude;
    let lng = coordinates.longitude;
    let latRange = [-90, 90];
    let lngRange = [-180, 180];

    let hash = '';
    let even = true;
    let bit = 0;
    let bitCount = 0;

    while (hash.length < precision) {
        if (even) {
            const mid = (lngRange[0] + lngRange[1]) / 2;
            if (lng >= mid) {
                bit = bit * 2 + 1;
                lngRange[0] = mid;
            } else {
                bit = bit * 2;
                lngRange[1] = mid;
            }
        } else {
            const mid = (latRange[0] + latRange[1]) / 2;
            if (lat >= mid) {
                bit = bit * 2 + 1;
                latRange[0] = mid;
            } else {
                bit = bit * 2;
                latRange[1] = mid;
            }
        }

        even = !even;
        bitCount++;

        if (bitCount === 5) {
            hash += base32[bit];
            bit = 0;
            bitCount = 0;
        }
    }

    return hash;
};

// Get nearby geohashes for expanded search
export const getNearbyGeohashes = (coordinates: Coordinates, precision: number = 7): string[] => {
    const centerHash = generateGeohash(coordinates, precision);
    const neighbors = getGeohashNeighbors(centerHash);
    return [centerHash, ...neighbors];
};

// Simplified geohash neighbor calculation
const getGeohashNeighbors = (geohash: string): string[] => {
    // This is a simplified version - in production you'd want a complete implementation
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    const neighbors: string[] = [];

    // Generate some neighbor approximations
    for (let i = 0; i < 8; i++) {
        const lastChar = geohash[geohash.length - 1];
        const lastIndex = base32.indexOf(lastChar);
        const neighborIndex = (lastIndex + i - 4) % base32.length;

        if (neighborIndex >= 0) {
            const neighbor = geohash.slice(0, -1) + base32[neighborIndex];
            neighbors.push(neighbor);
        }
    }

    return neighbors;
};

// Validate coordinates
export const isValidCoordinates = (coordinates: Coordinates): boolean => {
    return (
        typeof coordinates.latitude === 'number' &&
        typeof coordinates.longitude === 'number' &&
        !isNaN(coordinates.latitude) &&
        !isNaN(coordinates.longitude) &&
        coordinates.latitude >= -90 &&
        coordinates.latitude <= 90 &&
        coordinates.longitude >= -180 &&
        coordinates.longitude <= 180
    );
};

// Format coordinates for display
export const formatCoordinates = (coordinates: Coordinates, precision: number = 4): string => {
    const latDirection = coordinates.latitude >= 0 ? 'N' : 'S';
    const lngDirection = coordinates.longitude >= 0 ? 'E' : 'W';

    return `${Math.abs(coordinates.latitude).toFixed(precision)}°${latDirection}, ${Math.abs(coordinates.longitude).toFixed(precision)}°${lngDirection}`;
};

// Calculate bearing between two points
export const calculateBearing = (start: Coordinates, end: Coordinates): number => {
    const startLat = toRadians(start.latitude);
    const startLng = toRadians(start.longitude);
    const endLat = toRadians(end.latitude);
    const endLng = toRadians(end.longitude);

    const dLng = endLng - startLng;

    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

    const bearing = toDegrees(Math.atan2(y, x));
    return (bearing + 360) % 360; // Normalize to 0-360 degrees
};

// Get cardinal direction from bearing
export const getCardinalDirection = (bearing: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
};

// Sort coordinates by distance from a reference point
export const sortByDistance = (
    coordinates: Array<Coordinates & { id?: string }>,
    referencePoint: Coordinates
): Array<Coordinates & { id?: string; distance: number }> => {
    return coordinates
        .map(coord => ({
            ...coord,
            distance: calculateDistance(referencePoint, coord)
        }))
        .sort((a, b) => a.distance - b.distance);
};

// Filter coordinates within a radius
export const filterByRadius = (
    coordinates: Array<Coordinates & { id?: string }>,
    center: Coordinates,
    radiusKm: number
): Array<Coordinates & { id?: string }> => {
    return coordinates.filter(coord =>
        calculateDistance(center, coord) <= radiusKm
    );
};

// Calculate center point of multiple coordinates
export const calculateCenterPoint = (coordinates: Coordinates[]): Coordinates => {
    if (coordinates.length === 0) {
        throw new Error('Cannot calculate center of empty coordinates array');
    }

    let x = 0;
    let y = 0;
    let z = 0;

    coordinates.forEach(coord => {
        const lat = toRadians(coord.latitude);
        const lng = toRadians(coord.longitude);

        x += Math.cos(lat) * Math.cos(lng);
        y += Math.cos(lat) * Math.sin(lng);
        z += Math.sin(lat);
    });

    x /= coordinates.length;
    y /= coordinates.length;
    z /= coordinates.length;

    const centralLongitude = Math.atan2(y, x);
    const centralSquareRoot = Math.sqrt(x * x + y * y);
    const centralLatitude = Math.atan2(z, centralSquareRoot);

    return {
        latitude: toDegrees(centralLatitude),
        longitude: toDegrees(centralLongitude)
    };
};

// Convert distance to human readable format
export const formatDistance = (distanceKm: number): string => {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)}m`;
    } else if (distanceKm < 10) {
        return `${distanceKm.toFixed(1)}km`;
    } else {
        return `${Math.round(distanceKm)}km`;
    }
};

// Check if two coordinates are approximately equal
export const coordinatesEqual = (
    coord1: Coordinates,
    coord2: Coordinates,
    tolerance: number = 0.0001 // ~11m precision
): boolean => {
    return (
        Math.abs(coord1.latitude - coord2.latitude) <= tolerance &&
        Math.abs(coord1.longitude - coord2.longitude) <= tolerance
    );
};

export default {
    calculateDistance,
    getBoundingBox,
    isWithinBounds,
    generateGeohash,
    getNearbyGeohashes,
    isValidCoordinates,
    formatCoordinates,
    calculateBearing,
    getCardinalDirection,
    sortByDistance,
    filterByRadius,
    calculateCenterPoint,
    formatDistance,
    coordinatesEqual
};