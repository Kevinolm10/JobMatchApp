import {
    getFirestore,
    collection,
    query,
    where,
    limit,
    startAfter,
    getDocs,
    orderBy,
    QueryDocumentSnapshot,
    Query
} from 'firebase/firestore';

const PAGE_SIZE = 20; // Increased from 10 for better performance
const db = getFirestore();

// Enhanced interface for pagination state
interface PaginationState {
    lastVisible: QueryDocumentSnapshot | null;
    hasMore: boolean;
    isLoading: boolean;
    error: string | null;
}

// Cache for pagination states per collection
const paginationCache = new Map<string, PaginationState>();

// Initialize pagination state for a collection
const initializePaginationState = (collectionName: string): PaginationState => {
    return {
        lastVisible: null,
        hasMore: true,
        isLoading: false,
        error: null
    };
};

// Get or create pagination state
const getPaginationState = (collectionName: string): PaginationState => {
    if (!paginationCache.has(collectionName)) {
        paginationCache.set(collectionName, initializePaginationState(collectionName));
    }
    return paginationCache.get(collectionName)!;
};

// Enhanced profile fetching with better filtering and caching
export async function fetchProfilesBatch(
    collectionName: 'users' | 'businessUsers' = 'users',
    swipedIds: string[] = [],
    userLocation?: { latitude: number; longitude: number },
    maxDistanceKm?: number
): Promise<{
    profiles: any[];
    hasMore: boolean;
    error: string | null;
}> {
    const state = getPaginationState(collectionName);

    if (state.isLoading) {
        console.log('Fetch already in progress, skipping...');
        return { profiles: [], hasMore: state.hasMore, error: null };
    }

    if (!state.hasMore) {
        console.log('No more profiles to fetch');
        return { profiles: [], hasMore: false, error: null };
    }

    state.isLoading = true;
    state.error = null;

    try {
        // Build query with proper ordering for consistent pagination
        let q: Query = query(
            collection(db, collectionName),
            orderBy('createdAt', 'desc'), // Ensure consistent ordering
            limit(PAGE_SIZE)
        );

        // Add pagination cursor if available
        if (state.lastVisible) {
            q = query(
                collection(db, collectionName),
                orderBy('createdAt', 'desc'),
                startAfter(state.lastVisible),
                limit(PAGE_SIZE)
            );
        }

        // Execute query
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            state.hasMore = false;
            state.isLoading = false;
            return { profiles: [], hasMore: false, error: null };
        }

        // Update pagination state
        state.lastVisible = snapshot.docs[snapshot.docs.length - 1];
        state.hasMore = snapshot.docs.length === PAGE_SIZE;

        // Process profiles
        let profiles = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Add timestamp for debugging
            fetchedAt: new Date().toISOString()
        }));

        // Efficient filtering strategies
        profiles = await applyFilters(profiles, {
            swipedIds,
            userLocation,
            maxDistanceKm
        });

        console.log(`Fetched ${profiles.length} profiles from ${collectionName}`);

        state.isLoading = false;
        return {
            profiles,
            hasMore: state.hasMore,
            error: null
        };

    } catch (error: any) {
        console.error(`Error fetching ${collectionName} profiles:`, error);
        state.error = error.message;
        state.isLoading = false;

        return {
            profiles: [],
            hasMore: state.hasMore,
            error: error.message
        };
    }
}

// Enhanced filtering with multiple strategies
async function applyFilters(
    profiles: any[],
    filters: {
        swipedIds: string[];
        userLocation?: { latitude: number; longitude: number };
        maxDistanceKm?: number;
    }
): Promise<any[]> {
    let filtered = profiles;

    // Filter out swiped profiles
    if (filters.swipedIds.length > 0) {
        const swipedSet = new Set(filters.swipedIds);
        filtered = filtered.filter(profile => !swipedSet.has(profile.id));
    }

    // Apply location filtering if specified
    if (filters.userLocation && filters.maxDistanceKm) {
        const { calculateDistance } = await import('../utilities/geoUtils');
        filtered = filtered.filter(profile => {
            if (!profile.location?.latitude || !profile.location?.longitude) {
                return true; // Include profiles without location
            }

            const distance = calculateDistance(
                filters.userLocation!,
                profile.location
            );

            return distance <= filters.maxDistanceKm!;
        });
    }

    // Filter out profiles with incomplete data
    filtered = filtered.filter(profile =>
        profile.firstName &&
        profile.email &&
        (profile.skills || profile.requirements)
    );

    return filtered;
}

// Reset pagination for a collection (useful for refresh)
export function resetPagination(collectionName: string): void {
    paginationCache.set(collectionName, initializePaginationState(collectionName));
    console.log(`Reset pagination for ${collectionName}`);
}

// Get pagination info for debugging
export function getPaginationInfo(collectionName: string): PaginationState {
    return getPaginationState(collectionName);
}

// Prefetch next batch in background
export async function prefetchNextBatch(
    collectionName: 'users' | 'businessUsers',
    swipedIds: string[] = []
): Promise<void> {
    const state = getPaginationState(collectionName);

    if (!state.hasMore || state.isLoading) {
        return;
    }

    console.log(`Prefetching next batch for ${collectionName}...`);

    // Fetch in background without awaiting
    fetchProfilesBatch(collectionName, swipedIds).catch(error => {
        console.warn('Prefetch failed:', error);
    });
}

// Enhanced job ad fetching with better error handling and caching
export async function fetchJobAdsBatch(
    skills: string = "",
    offset: number = 0,
    limit: number = 20
): Promise<{
    jobAds: any[];
    hasMore: boolean;
    error: string | null;
}> {
    try {
        const sanitizedQuery = skills
            .split(',')
            .map(skill => skill.trim())
            .filter(Boolean)
            .join(' OR '); // Use OR for better matching

        const url = `https://jobsearch.api.jobtechdev.se/search?q=${encodeURIComponent(sanitizedQuery)}&limit=${limit}&offset=${offset}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(url, {
            headers: {
                "accept": "application/json",
                "User-Agent": "TinderJobApp/1.0"
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();

        const jobAds = data?.hits || [];
        const hasMore = jobAds.length === limit;

        console.log(`Fetched ${jobAds.length} job ads for skills: ${sanitizedQuery}`);

        return {
            jobAds,
            hasMore,
            error: null
        };

    } catch (error: any) {
        console.error('Error fetching job ads:', error);

        if (error.name === 'AbortError') {
            return { jobAds: [], hasMore: false, error: 'Request timeout' };
        }

        return {
            jobAds: [],
            hasMore: false,
            error: error.message || 'Failed to fetch job ads'
        };
    }
}

// Utility to clear all caches
export function clearAllCaches(): void {
    paginationCache.clear();
    console.log('Cleared all pagination caches');
}