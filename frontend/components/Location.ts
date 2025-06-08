// Enhanced location service with caching, rate limiting, and better error handling

interface LocationCache {
  [key: string]: {
    name: string;
    timestamp: number;
  };
}

interface GeolocationResult {
  name: string;
  fromCache: boolean;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

// Configuration
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_DELAY = 1000; // 1 second between requests
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT = 8000; // 8 seconds

// In-memory cache for location names
const locationCache: LocationCache = {};

// Rate limiting
let lastRequestTime = 0;
const pendingRequests = new Map<string, Promise<string>>();

// Generate cache key from coordinates
const getCacheKey = (latitude: number, longitude: number): string => {
  // Round to 4 decimal places (~11m precision) for better cache hits
  const roundedLat = Math.round(latitude * 10000) / 10000;
  const roundedLng = Math.round(longitude * 10000) / 10000;
  return `${roundedLat},${roundedLng}`;
};

// Check if cached location is still valid
const isCacheValid = (cacheEntry: { timestamp: number }): boolean => {
  return Date.now() - cacheEntry.timestamp < CACHE_DURATION;
};

// Rate limiting helper
const enforceRateLimit = async (): Promise<void> => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    const delay = RATE_LIMIT_DELAY - timeSinceLastRequest;
    console.log(`⏳ Rate limiting: waiting ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  lastRequestTime = Date.now();
};

// Enhanced location fetching with multiple fallback services
const fetchLocationFromAPI = async (
  latitude: number,
  longitude: number,
  retryCount = 0
): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    await enforceRateLimit();

    // Primary service: OpenStreetMap Nominatim
    let response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'TinderJobApp/1.0 (contact@example.com)',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.display_name) {
      // Parse and format the location name nicely
      const address = data.address || {};
      const locationParts = [
        address.city || address.town || address.village,
        address.state || address.region,
        address.country
      ].filter(Boolean);

      return locationParts.length > 0 ? locationParts.join(', ') : data.display_name;
    }

    throw new Error('No location data in response');

  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      console.warn(`⏰ Location request timeout for ${latitude}, ${longitude}`);
    } else {
      console.warn(`🌍 Primary location service failed: ${error.message}`);
    }

    // Retry with exponential backoff
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`🔄 Retrying location fetch in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchLocationFromAPI(latitude, longitude, retryCount + 1);
    }

    // Fallback: try alternative service
    if (retryCount === 0) {
      try {
        return await fetchLocationFromFallbackAPI(latitude, longitude);
      } catch (fallbackError) {
        console.error('🚨 All location services failed:', fallbackError);
      }
    }

    throw error;
  }
};

// Fallback location service (you can add more services here)
const fetchLocationFromFallbackAPI = async (
  latitude: number,
  longitude: number
): Promise<string> => {
  // Alternative: BigDataCloud (has a free tier)
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      }
    );

    if (!response.ok) {
      throw new Error(`BigDataCloud API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.city || data.locality) {
      const parts = [data.city || data.locality, data.principalSubdivision, data.countryName]
        .filter(Boolean);
      return parts.join(', ');
    }

    throw new Error('No usable location data from fallback API');
  } catch (error) {
    console.error('Fallback location service failed:', error);
    throw error;
  }
};

// Main export function with enhanced features
export const fetchLocationName = async (
  latitude: number,
  longitude: number
): Promise<string> => {
  // Input validation
  if (!isValidCoordinate(latitude, longitude)) {
    console.warn(`❌ Invalid coordinates: ${latitude}, ${longitude}`);
    return "Invalid Location";
  }

  const cacheKey = getCacheKey(latitude, longitude);

  // Check cache first
  if (locationCache[cacheKey] && isCacheValid(locationCache[cacheKey])) {
    console.log(`💾 Cache hit for ${cacheKey}`);
    return locationCache[cacheKey].name;
  }

  // Check if request is already pending for these coordinates
  if (pendingRequests.has(cacheKey)) {
    console.log(`⏳ Request already pending for ${cacheKey}`);
    return await pendingRequests.get(cacheKey)!;
  }

  // Create new request
  const requestPromise = (async (): Promise<string> => {
    try {
      const locationName = await fetchLocationFromAPI(latitude, longitude);

      // Cache successful result
      locationCache[cacheKey] = {
        name: locationName,
        timestamp: Date.now(),
      };

      console.log(`✅ Location resolved: ${locationName} for ${cacheKey}`);
      return locationName;

    } catch (error: any) {
      console.error(`❌ Failed to fetch location for ${cacheKey}:`, error);

      // Return a reasonable fallback
      return generateFallbackLocationName(latitude, longitude);
    } finally {
      // Clean up pending request
      pendingRequests.delete(cacheKey);
    }
  })();

  // Store pending request to avoid duplicates
  pendingRequests.set(cacheKey, requestPromise);

  return await requestPromise;
};

// Enhanced coordinate validation
const isValidCoordinate = (latitude: number, longitude: number): boolean => {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    // Exclude 0,0 coordinates (often invalid)
    !(latitude === 0 && longitude === 0)
  );
};

// Generate reasonable fallback location name
const generateFallbackLocationName = (latitude: number, longitude: number): string => {
  // Determine hemisphere and general region
  const latDirection = latitude >= 0 ? 'N' : 'S';
  const lngDirection = longitude >= 0 ? 'E' : 'W';

  // Simple region detection
  let region = 'Unknown Region';

  if (latitude > 60) region = 'Northern Region';
  else if (latitude > 23.5) region = 'Northern Temperate';
  else if (latitude > -23.5) region = 'Tropical Region';
  else if (latitude > -60) region = 'Southern Temperate';
  else region = 'Southern Region';

  return `${region} (${Math.abs(latitude).toFixed(2)}°${latDirection}, ${Math.abs(longitude).toFixed(2)}°${lngDirection})`;
};

// Utility functions for location management
export const clearLocationCache = (): void => {
  Object.keys(locationCache).forEach(key => delete locationCache[key]);
  console.log('🧹 Cleared location cache');
};

export const getCacheStats = (): { size: number; oldestEntry: string | null } => {
  const entries = Object.entries(locationCache);
  const size = entries.length;

  let oldestEntry: string | null = null;
  let oldestTimestamp = Date.now();

  entries.forEach(([key, value]) => {
    if (value.timestamp < oldestTimestamp) {
      oldestTimestamp = value.timestamp;
      oldestEntry = key;
    }
  });

  return { size, oldestEntry };
};

// Preload locations for better UX
export const preloadLocations = async (coordinates: Array<{ latitude: number, longitude: number }>): Promise<void> => {
  console.log(`🔄 Preloading ${coordinates.length} locations...`);

  const promises = coordinates.map(async (coord, index) => {
    // Add delay between requests to respect rate limits
    await new Promise(resolve => setTimeout(resolve, index * 500));

    try {
      await fetchLocationName(coord.latitude, coord.longitude);
    } catch (error) {
      console.warn(`Failed to preload location ${coord.latitude}, ${coord.longitude}:`, error);
    }
  });

  await Promise.allSettled(promises);
  console.log('✅ Location preloading completed');
};

// Cleanup old cache entries
export const cleanupLocationCache = (): number => {
  const now = Date.now();
  let removedCount = 0;

  Object.keys(locationCache).forEach(key => {
    if (!isCacheValid(locationCache[key])) {
      delete locationCache[key];
      removedCount++;
    }
  });

  if (removedCount > 0) {
    console.log(`🧹 Cleaned up ${removedCount} expired location cache entries`);
  }

  return removedCount;
};

// Get location with detailed result info
export const fetchLocationWithDetails = async (
  latitude: number,
  longitude: number
): Promise<GeolocationResult> => {
  const cacheKey = getCacheKey(latitude, longitude);
  const fromCache = locationCache[cacheKey] && isCacheValid(locationCache[cacheKey]);

  const name = await fetchLocationName(latitude, longitude);

  return {
    name,
    fromCache,
    coordinates: { latitude, longitude }
  };
};

// Batch location fetching for multiple coordinates
export const fetchMultipleLocations = async (
  coordinates: Array<{ latitude: number, longitude: number, id?: string }>
): Promise<Array<{ id?: string, name: string, coordinates: { latitude: number, longitude: number } }>> => {
  const results = await Promise.allSettled(
    coordinates.map(async (coord) => {
      const name = await fetchLocationName(coord.latitude, coord.longitude);
      return {
        id: coord.id,
        name,
        coordinates: { latitude: coord.latitude, longitude: coord.longitude }
      };
    })
  );

  return results
    .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
    .map(result => result.value);
};

// Distance calculation utility
export const calculateDistance = (
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number }
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(point2.latitude - point1.latitude);
  const dLon = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.latitude)) * Math.cos(toRadians(point2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

// Location validation and formatting utilities
export const formatCoordinates = (latitude: number, longitude: number): string => {
  const latDirection = latitude >= 0 ? 'N' : 'S';
  const lngDirection = longitude >= 0 ? 'E' : 'W';

  return `${Math.abs(latitude).toFixed(4)}°${latDirection}, ${Math.abs(longitude).toFixed(4)}°${lngDirection}`;
};

export const isNearby = (
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number },
  maxDistanceKm: number = 50
): boolean => {
  return calculateDistance(point1, point2) <= maxDistanceKm;
};

// Export cache management for external use
export const getLocationCacheSize = (): number => {
  return Object.keys(locationCache).length;
};

export const exportLocationCache = (): LocationCache => {
  return { ...locationCache };
};

export const importLocationCache = (cache: LocationCache): void => {
  Object.assign(locationCache, cache);
  console.log(`📥 Imported ${Object.keys(cache).length} location cache entries`);
};