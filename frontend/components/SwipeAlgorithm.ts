import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseAuth'; // <-- Corrected relative path to firebaseAuth.ts
import haversine from 'haversine-distance';
import mapJobAdsToProfiles from '../../mapJobAdsToProfiles';
import getJobAds, { JobAdProfile } from '../../fetchJobAds';

export interface Profile {
  id: string;
  image: string;
  firstName: string;
  lastName: string;
  email: string;
  skills: string;
  experience: string;
  location: {
    latitude: number;
    longitude: number;
  };
  phoneNumber: string;
  workCommitment: string;
  locationName?: string;
  score?: number;
}

const defaultLocation = { latitude: 59.3293, longitude: 18.0686 }; // Stockholm fallback

const parseLocation = (
  location: string | { latitude: number; longitude: number }
): { latitude: number; longitude: number } => {
  if (typeof location === 'string') {
    console.warn(`Expected coordinates but received address: "${location}"`);
    return defaultLocation;
  }
  return location ?? defaultLocation;
};

const matchProfiles = (userProfile: Profile, profiles: Profile[]): Profile[] => {
  return profiles
    .map(profile => {
      const userLoc = parseLocation(userProfile.location);
      const profileLoc = parseLocation(profile.location);

      const distance = haversine(userLoc, profileLoc) / 1000; // in km
      const skillMatch = userProfile.skills === profile.skills ? 1 : 0;
      const commitmentMatch = userProfile.workCommitment === profile.workCommitment ? 1 : 0;
      const score = (1 / (1 + distance)) + skillMatch + commitmentMatch;

      return { ...profile, score };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
};

export const fetchAndMatchProfiles = async (
  user: any,
  excludeIds: string[] = [],
  cachedJobAds: JobAdProfile[] | null = null
): Promise<{ profiles: Profile[], updatedCache: JobAdProfile[] }> => {
  try {
    if (!user?.email) throw new Error("User not authenticated");

    // Fetch users and businessUsers collections separately
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const businessUsersSnapshot = await getDocs(collection(db, 'businessUsers'));

    // Check which collection user belongs to:
    let userProfileDoc = usersSnapshot.docs.find(doc => (doc.data() as Profile).email === user.email);
    let isUserFromUsersCollection = true;

    if (!userProfileDoc) {
      userProfileDoc = businessUsersSnapshot.docs.find(doc => (doc.data() as Profile).email === user.email);
      isUserFromUsersCollection = false;
    }

    if (!userProfileDoc) throw new Error("User profile not found in Firestore");

    const userProfile = userProfileDoc.data() as Profile;

    // Match against the opposite collection
    const profilesToMatch: Profile[] = isUserFromUsersCollection
      ? businessUsersSnapshot.docs.map(doc => ({ ...(doc.data() as Profile), id: doc.id }))
      : usersSnapshot.docs.map(doc => ({ ...(doc.data() as Profile), id: doc.id }));

    // Get job ads (cached or fresh)
    let jobAds = cachedJobAds;
    if (!jobAds) {
      jobAds = await getJobAds(userProfile.skills);
    }

    const jobProfiles = mapJobAdsToProfiles(jobAds);

    // Combine opposite collection profiles with job ads
    const combinedProfiles = [...profilesToMatch, ...jobProfiles];

    // Match and filter
    let matchedProfiles = matchProfiles(userProfile, combinedProfiles);
    matchedProfiles = matchedProfiles.filter(p => !excludeIds.includes(p.id));

    return { profiles: matchedProfiles, updatedCache: jobAds };
  } catch (error) {
    console.error("Failed to fetch and match profiles:", error);
    return { profiles: [], updatedCache: cachedJobAds || [] };
  }
};
