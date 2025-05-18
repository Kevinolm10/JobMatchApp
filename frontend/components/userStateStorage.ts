    import AsyncStorage from '@react-native-async-storage/async-storage';

    const QUEUE_KEY = 'PROFILE_QUEUE_CACHE';
    const SWIPED_KEY = 'SWIPED_PROFILE_IDS';

    export const saveQueueToStorage = async (queue: any[]) => {
    try {
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
        console.error('Failed to save queue', e);
    }
    };

    export const loadQueueFromStorage = async (): Promise<any[] | null> => {
    try {
        const json = await AsyncStorage.getItem(QUEUE_KEY);
        return json ? JSON.parse(json) : null;
    } catch (e) {
        console.error('Failed to load queue', e);
        return null;
    }
    };

    export const saveSwipedIdsToStorage = async (ids: string[]) => {
    try {
        await AsyncStorage.setItem(SWIPED_KEY, JSON.stringify(ids));
    } catch (e) {
        console.error('Failed to save swiped IDs', e);
    }
    };

    export const loadSwipedIdsFromStorage = async (): Promise<string[]> => {
    try {
        const json = await AsyncStorage.getItem(SWIPED_KEY);
        return json ? JSON.parse(json) : [];
    } catch (e) {
        console.error('Failed to load swiped IDs', e);
        return [];
    }
    };
