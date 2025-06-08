import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const QUEUE_KEY = 'PROFILE_QUEUE_CACHE';
const SWIPED_KEY = 'SWIPED_PROFILE_IDS';

// Enhanced configuration
const CACHE_EXPIRY_HOURS = 2; // Cache expires after 2 hours
const MAX_SWIPED_IDS = 1000; // Limit stored swiped IDs
const MAX_QUEUE_SIZE = 100; // Limit cached queue size

interface CacheMetadata {
    timestamp: number;
    version: string;
    userEmail?: string;
}

interface StoredData<T> {
    data: T;
    metadata: CacheMetadata;
}

// Create cache metadata
const createMetadata = (userEmail?: string): CacheMetadata => ({
    timestamp: Date.now(),
    version: '1.0.0',
    userEmail
});

// Check if cache is expired
const isCacheExpired = (metadata: CacheMetadata): boolean => {
    const now = Date.now();
    const expiryTime = metadata.timestamp + (CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
    return now > expiryTime;
};

// Generic storage function with enhanced error handling
const setStorageItem = async <T>(key: string, data: T, userEmail?: string): Promise<boolean> => {
    try {
        const storedData: StoredData<T> = {
            data,
            metadata: createMetadata(userEmail)
        };

        const jsonString = JSON.stringify(storedData);

        // Check data size (AsyncStorage limit is ~6MB on iOS)
        if (jsonString.length > 5 * 1024 * 1024) { // 5MB limit
            console.warn(`⚠️ Data too large for ${key}, truncating...`);

            if (Array.isArray(data)) {
                const truncatedData = (data as any[]).slice(0, Math.floor((data as any[]).length / 2));
                return setStorageItem(key, truncatedData as T, userEmail);
            }

            throw new Error('Data too large for storage');
        }

        await AsyncStorage.setItem(key, jsonString);
        console.log(`✅ Saved ${key} (${(jsonString.length / 1024).toFixed(1)}KB)`);
        return true;

    } catch (error) {
        console.error(`❌ Failed to save ${key}:`, error);
        return false;
    }
};

const getStorageItem = async <T>(key: string, userEmail?: string): Promise<T | null> => {
    try {
        const jsonString = await AsyncStorage.getItem(key);
        if (!jsonString) return null;

        const storedData: StoredData<T> = JSON.parse(jsonString);

        // Check if cache is expired
        if (isCacheExpired(storedData.metadata)) {
            console.log(`⏰ Cache expired for ${key}, removing...`);
            await AsyncStorage.removeItem(key);
            return null;
        }

        // Check if cache belongs to different user
        if (userEmail && storedData.metadata.userEmail && storedData.metadata.userEmail !== userEmail) {
            console.log(`👤 Cache belongs to different user for ${key}, removing...`);
            await AsyncStorage.removeItem(key);
            return null;
        }

        console.log(`📖 Loaded ${key} from storage`);
        return storedData.data;

    } catch (error) {
        console.error(`❌ Failed to load ${key}:`, error);
        // Clean up corrupted data
        await AsyncStorage.removeItem(key).catch(() => { });
        return null;
    }
};

// Enhanced queue management with size limits
export const saveQueueToStorage = async (queue: any[], userEmail?: string): Promise<boolean> => {
    try {
        if (!Array.isArray(queue)) {
            console.warn('Queue must be an array');
            return false;
        }

        // Limit queue size to prevent storage bloat
        const limitedQueue = queue.slice(0, MAX_QUEUE_SIZE);

        if (limitedQueue.length !== queue.length) {
            console.warn(`⚠️ Queue truncated from ${queue.length} to ${limitedQueue.length} items`);
        }

        return await setStorageItem(QUEUE_KEY, limitedQueue, userEmail);
    } catch (error) {
        console.error('Failed to save queue:', error);
        return false;
    }
};

export const loadQueueFromStorage = async (userEmail?: string): Promise<any[] | null> => {
    try {
        const queue = await getStorageItem<any[]>(QUEUE_KEY, userEmail);
        if (queue && Array.isArray(queue)) {
            console.log(`📦 Loaded queue with ${queue.length} items`);
            return queue;
        }
        return null;
    } catch (error) {
        console.error('Failed to load queue:', error);
        return null;
    }
};

// Enhanced swiped IDs management with rotation
export const saveSwipedIdsToStorage = async (ids: string[], userEmail?: string): Promise<boolean> => {
    try {
        if (!Array.isArray(ids)) {
            console.warn('Swiped IDs must be an array');
            return false;
        }

        // Remove duplicates
        const uniqueIds = [...new Set(ids)];

        // Implement rotation to prevent unlimited growth
        let limitedIds = uniqueIds;

        if (uniqueIds.length > MAX_SWIPED_IDS) {
            // Keep only the most recent swiped IDs
            limitedIds = uniqueIds.slice(-MAX_SWIPED_IDS);
            console.log(`🔄 Rotated swiped IDs: kept ${limitedIds.length} most recent from ${uniqueIds.length} total`);
        }

        return await setStorageItem(SWIPED_KEY, limitedIds, userEmail);
    } catch (error) {
        console.error('Failed to save swiped IDs:', error);
        return false;
    }
};

export const loadSwipedIdsFromStorage = async (userEmail?: string): Promise<string[]> => {
    try {
        const ids = await getStorageItem<string[]>(SWIPED_KEY, userEmail);
        if (ids && Array.isArray(ids)) {
            console.log(`📦 Loaded ${ids.length} swiped IDs`);
            return ids;
        }
        return [];
    } catch (error) {
        console.error('Failed to load swiped IDs:', error);
        return [];
    }
};

// NEW: Add swiped ID without reloading entire array (performance optimization)
export const addSwipedId = async (id: string, userEmail?: string): Promise<boolean> => {
    try {
        if (!id || typeof id !== 'string') {
            console.warn('Invalid swiped ID provided');
            return false;
        }

        const existingIds = await loadSwipedIdsFromStorage(userEmail);

        // Avoid duplicates
        if (existingIds.includes(id)) {
            return true; // Already exists, no need to save
        }

        const updatedIds = [...existingIds, id];
        return await saveSwipedIdsToStorage(updatedIds, userEmail);
    } catch (error) {
        console.error('Failed to add swiped ID:', error);
        return false;
    }
};

// NEW: Remove specific swiped ID (useful for testing or undo functionality)
export const removeSwipedId = async (id: string, userEmail?: string): Promise<boolean> => {
    try {
        const existingIds = await loadSwipedIdsFromStorage(userEmail);
        const filteredIds = existingIds.filter(existingId => existingId !== id);

        if (filteredIds.length === existingIds.length) {
            return true; // ID wasn't found, nothing to remove
        }

        return await saveSwipedIdsToStorage(filteredIds, userEmail);
    } catch (error) {
        console.error('Failed to remove swiped ID:', error);
        return false;
    }
};

// Storage health check and cleanup utilities
export const getStorageStats = async (): Promise<{
    queueSize: number;
    swipedIdsCount: number;
    totalSizeKB: number;
}> => {
    try {
        const [queueData, swipedData] = await Promise.all([
            AsyncStorage.getItem(QUEUE_KEY),
            AsyncStorage.getItem(SWIPED_KEY)
        ]);

        const queueSize = queueData ? JSON.parse(queueData).data?.length || 0 : 0;
        const swipedIdsCount = swipedData ? JSON.parse(swipedData).data?.length || 0 : 0;
        const totalSizeKB = ((queueData?.length || 0) + (swipedData?.length || 0)) / 1024;

        return {
            queueSize,
            swipedIdsCount,
            totalSizeKB: Math.round(totalSizeKB * 100) / 100
        };
    } catch (error) {
        console.error('Failed to get storage stats:', error);
        return { queueSize: 0, swipedIdsCount: 0, totalSizeKB: 0 };
    }
};

// Clear cache for specific user
export const clearUserCache = async (userEmail?: string): Promise<boolean> => {
    try {
        console.log(`🧹 Clearing cache for user: ${userEmail || 'anonymous'}`);

        // If no userEmail provided, clear everything
        if (!userEmail) {
            await Promise.all([
                AsyncStorage.removeItem(QUEUE_KEY),
                AsyncStorage.removeItem(SWIPED_KEY)
            ]);
            console.log('✅ Cleared all user cache');
            return true;
        }

        // Clear only if it belongs to the specified user
        const [queueData, swipedData] = await Promise.all([
            AsyncStorage.getItem(QUEUE_KEY),
            AsyncStorage.getItem(SWIPED_KEY)
        ]);

        const clearPromises: Promise<void>[] = [];

        if (queueData) {
            try {
                const parsedQueue = JSON.parse(queueData);
                if (parsedQueue.metadata?.userEmail === userEmail) {
                    clearPromises.push(AsyncStorage.removeItem(QUEUE_KEY));
                }
            } catch (error) {
                // If parsing fails, remove corrupted data
                clearPromises.push(AsyncStorage.removeItem(QUEUE_KEY));
            }
        }

        if (swipedData) {
            try {
                const parsedSwiped = JSON.parse(swipedData);
                if (parsedSwiped.metadata?.userEmail === userEmail) {
                    clearPromises.push(AsyncStorage.removeItem(SWIPED_KEY));
                }
            } catch (error) {
                // If parsing fails, remove corrupted data
                clearPromises.push(AsyncStorage.removeItem(SWIPED_KEY));
            }
        }

        await Promise.all(clearPromises);
        console.log('✅ Cleared user-specific cache');
        return true;

    } catch (error) {
        console.error('Failed to clear user cache:', error);
        return false;
    }
};

// Clear all storage (useful for logout or reset)
export const clearAllCache = async (): Promise<boolean> => {
    try {
        await AsyncStorage.multiRemove([QUEUE_KEY, SWIPED_KEY]);
        console.log('🧹 Cleared all storage');
        return true;
    } catch (error) {
        console.error('Failed to clear all cache:', error);
        return false;
    }
};

// Check if storage needs cleanup (expired or corrupted data)
export const performStorageHealthCheck = async (): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
}> => {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
        const stats = await getStorageStats();

        // Check storage size
        if (stats.totalSizeKB > 5000) { // 5MB
            issues.push('Storage usage is high');
            recommendations.push('Consider clearing old cache data');
        }

        // Check for corrupted data
        const keys = [QUEUE_KEY, SWIPED_KEY];
        for (const key of keys) {
            try {
                const data = await AsyncStorage.getItem(key);
                if (data) {
                    const parsed = JSON.parse(data);
                    if (!parsed.data || !parsed.metadata) {
                        issues.push(`Invalid data structure in ${key}`);
                        recommendations.push(`Clear ${key} storage`);
                    }
                }
            } catch (error) {
                issues.push(`Corrupted data found in ${key}`);
                recommendations.push(`Clear ${key} storage`);
            }
        }

        // Check for oversized arrays
        if (stats.queueSize > MAX_QUEUE_SIZE) {
            issues.push('Queue size exceeds maximum');
            recommendations.push('Queue will be automatically truncated');
        }

        if (stats.swipedIdsCount > MAX_SWIPED_IDS) {
            issues.push('Swiped IDs count exceeds maximum');
            recommendations.push('Old swiped IDs will be automatically rotated');
        }

        return {
            healthy: issues.length === 0,
            issues,
            recommendations
        };

    } catch (error) {
        return {
            healthy: false,
            issues: ['Storage health check failed'],
            recommendations: ['Restart app and check storage permissions']
        };
    }
};

// Migration helper for updating from old storage format
export const migrateOldStorage = async (): Promise<boolean> => {
    try {
        console.log('🔄 Checking for old storage format...');

        // Check if old format exists (direct data without metadata)
        const [oldQueue, oldSwiped] = await Promise.all([
            AsyncStorage.getItem(QUEUE_KEY),
            AsyncStorage.getItem(SWIPED_KEY)
        ]);

        let migrated = false;

        if (oldQueue) {
            try {
                const parsed = JSON.parse(oldQueue);
                // If it's an array (old format), migrate it
                if (Array.isArray(parsed)) {
                    await saveQueueToStorage(parsed);
                    migrated = true;
                    console.log('✅ Migrated queue to new format');
                }
            } catch (error) {
                console.warn('Failed to migrate queue:', error);
            }
        }

        if (oldSwiped) {
            try {
                const parsed = JSON.parse(oldSwiped);
                // If it's an array (old format), migrate it
                if (Array.isArray(parsed)) {
                    await saveSwipedIdsToStorage(parsed);
                    migrated = true;
                    console.log('✅ Migrated swiped IDs to new format');
                }
            } catch (error) {
                console.warn('Failed to migrate swiped IDs:', error);
            }
        }

        if (migrated) {
            console.log('✅ Storage migration completed');
        } else {
            console.log('ℹ️ No migration needed');
        }

        return true;
    } catch (error) {
        console.error('Migration failed:', error);
        return false;
    }
};

// Auto-run migration on import (backward compatibility)
migrateOldStorage().catch(error => {
    console.warn('Auto-migration failed:', error);
});

// Export additional utilities for debugging
export const debugStorage = async (): Promise<void> => {
    try {
        const stats = await getStorageStats();
        const healthCheck = await performStorageHealthCheck();

        console.log('=== STORAGE DEBUG INFO ===');
        console.log('Queue size:', stats.queueSize);
        console.log('Swiped IDs count:', stats.swipedIdsCount);
        console.log('Total size (KB):', stats.totalSizeKB);
        console.log('Health status:', healthCheck.healthy ? '✅ Healthy' : '⚠️ Issues found');

        if (healthCheck.issues.length > 0) {
            console.log('Issues:', healthCheck.issues);
            console.log('Recommendations:', healthCheck.recommendations);
        }

        console.log('========================');
    } catch (error) {
        console.error('Debug failed:', error);
    }
};