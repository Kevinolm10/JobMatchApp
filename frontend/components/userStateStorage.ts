import { getFirestore, collection, query, where, limit, startAfter, getDocs } from 'firebase/firestore';

const PAGE_SIZE = 10;
const db = getFirestore();

import type { QueryDocumentSnapshot } from 'firebase/firestore';

let lastVisible: QueryDocumentSnapshot | null = null;

export async function fetchProfilesBatch(swipedIds: string[] = []) {
try {
    let q = query(
    collection(db, 'profiles'),
    limit(PAGE_SIZE)
    );

    if (lastVisible) {
    q = query(
        collection(db, 'profiles'),
        startAfter(lastVisible),
        limit(PAGE_SIZE)
    );
    }

    // Filter out swiped profiles by ID
    // Firestore doesn’t allow 'not-in' with arrays bigger than 10, so might need client filtering
    const snapshot = await getDocs(q);
    lastVisible = snapshot.docs[snapshot.docs.length - 1];

    let profiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Client-side filter for swiped IDs
    profiles = profiles.filter(p => !swipedIds.includes(p.id));

    return profiles;
} catch (e) {
    console.error('Error fetching profiles', e);
    return [];
}
}
