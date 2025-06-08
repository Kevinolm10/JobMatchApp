import firestore from '@react-native-firebase/firestore';
import haversine from 'haversine-distance';
import mapJobAdsToProfiles from '../services/mapJobAdsToProfiles';
import getJobAds, { JobAdProfile, getJobAdsEnhanced } from '../services/fetchJobAds';

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
  source?: 'user' | 'business' | 'jobAd'; // Track source
}

// Enhanced state management for pagination
interface PaginationState {
  users: {
    lastVisible: any;
    hasMore: boolean;
    offset: number;
  };
  businessUsers: {
    lastVisible: any;
    hasMore: boolean;
    offset: number;
  };
  jobAds: {
    offset: number;
    hasMore: boolean;
    lastQuery: string;
  };
}

// Global pagination state
let paginationState: PaginationState = {
  users: { lastVisible: null, hasMore: true, offset: 0 },
  businessUsers: { lastVisible: null, hasMore: true, offset: 0 },
  jobAds: { offset: 0, hasMore: true, lastQuery: '' }
};

const defaultLocation = { latitude: 59.3293, longitude: 18.0686 };

const parseLocation = (
  location: string | { latitude: number; longitude: number } | undefined
): { latitude: number; longitude: number } => {
  if (typeof location === 'string') {
    console.warn(`Expected coordinates but received address: "${location}"`);
    return defaultLocation;
  }
  if (
    !location ||
    location.latitude === undefined ||
    location.latitude === null ||
    location.longitude === undefined ||
    location.longitude === null
  ) {
    return defaultLocation;
  }
  return location;
};

const skillMatchScore = (skillsA: string, skillsB: string): number => {
  const setA = new Set(skillsA.toLowerCase().split(',').map(s => s.trim()));
  const setB = new Set(skillsB.toLowerCase().split(',').map(s => s.trim()));
  const intersection = [...setA].filter(skill => setB.has(skill));
  return intersection.length / (setA.size || 1);
};

const matchProfiles = (userProfile: Profile, profiles: Profile[]): Profile[] => {
  return profiles
    .map(profile => {
      const userLoc = parseLocation(userProfile.location);
      const profileLoc = parseLocation(profile.location);

      const distanceKm = haversine(userLoc, profileLoc) / 1000;
      const skillMatch = skillMatchScore(userProfile.skills, profile.skills);
      const commitmentMatch = userProfile.workCommitment === profile.workCommitment ? 1 : 0;

      // Boost job ads slightly as they might be more relevant
      const sourceBoost = profile.source === 'jobAd' ? 0.1 : 0;
      const score = (1 / (1 + distanceKm)) + skillMatch + commitmentMatch + sourceBoost;

      return { ...profile, score };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
};

// Enhanced function to fetch users with pagination
const fetchUserProfiles = async (
  targetCollection: 'users' | 'businessUsers',
  excludeIds: string[] = [],
  limit: number = 10
): Promise<{ profiles: Profile[]; hasMore: boolean }> => {
  try {
    const state = paginationState[targetCollection];

    if (!state.hasMore) {
      console.log(`No more ${targetCollection} to fetch`);
      return { profiles: [], hasMore: false };
    }

    let query = firestore()
      .collection(targetCollection)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (state.lastVisible) {
      query = query.startAfter(state.lastVisible);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      state.hasMore = false;
      return { profiles: [], hasMore: false };
    }

    state.lastVisible = snapshot.docs[snapshot.docs.length - 1];
    state.hasMore = snapshot.docs.length === limit;

    const profiles: Profile[] = snapshot.docs
      .map(doc => {
        const raw = doc.data();
        let skills: string = raw.skills ?? '';

        if ((!skills || skills.trim().length === 0) && Array.isArray(raw.requirements)) {
          skills = raw.requirements.join(', ');
        }

        return {
          ...(raw as Profile),
          id: doc.id,
          skills,
          source: targetCollection === 'users' ? 'user' as const : 'business' as const
        };
      })
      .filter(profile =>
        typeof profile.skills === 'string' &&
        profile.skills.trim().length > 0 &&
        !excludeIds.includes(profile.id)
      );

    console.log(`Fetched ${profiles.length} ${targetCollection} profiles`);
    return { profiles, hasMore: state.hasMore };

  } catch (error) {
    console.error(`Error fetching ${targetCollection}:`, error);
    return { profiles: [], hasMore: false };
  }
};

// Enhanced function to fetch job ads with pagination
const fetchJobAdProfiles = async (
  userSkills: string,
  excludeIds: string[] = [],
  limit: number = 20
): Promise<{ profiles: Profile[]; hasMore: boolean }> => {
  try {
    const jobState = paginationState.jobAds;

    // Reset offset if query changed
    if (jobState.lastQuery !== userSkills) {
      jobState.offset = 0;
      jobState.hasMore = true;
      jobState.lastQuery = userSkills;
    }

    if (!jobState.hasMore) {
      console.log('No more job ads to fetch');
      return { profiles: [], hasMore: false };
    }

    console.log(`🔍 Fetching job ads with offset: ${jobState.offset}, limit: ${limit}`);

    const response = await getJobAdsEnhanced(userSkills, jobState.offset, limit);

    if (response.error) {
      console.error('Job ads API error:', response.error);
      return { profiles: [], hasMore: false };
    }

    const jobAds = response.jobAds;
    jobState.hasMore = response.hasMore && jobAds.length === limit;
    jobState.offset += jobAds.length;

    // Convert job ads to profiles
    const jobProfiles: Profile[] = mapJobAdsToProfiles(jobAds)
      .filter(profile => !excludeIds.includes(profile.id))
      .map(profile => ({
        ...profile,
        source: 'jobAd' as const
      }));

    console.log(`✅ Converted ${jobProfiles.length} job ads to profiles`);
    return { profiles: jobProfiles, hasMore: jobState.hasMore };

  } catch (error) {
    console.error('Error fetching job ad profiles:', error);
    paginationState.jobAds.hasMore = false;
    return { profiles: [], hasMore: false };
  }
};

interface User {
  email: string;
}

// MAIN ENHANCED FUNCTION with comprehensive pagination
export const fetchAndMatchProfiles = async (
  user: User,
  excludeIds: string[] = [],
  cachedJobAds: JobAdProfile[] | null = null,
  requestedCount: number = 20
): Promise<{ profiles: Profile[]; updatedCache: JobAdProfile[] }> => {
  try {
    if (!user?.email) throw new Error("User not authenticated");

    console.log(`🔄 Fetching profiles for ${user.email}, excluding ${excludeIds.length} IDs`);

    // Get user profile and determine user type
    let userProfileSnapshot = await firestore()
      .collection('users')
      .where('email', '==', user.email)
      .limit(1)
      .get();

    let isUserFromUsersCollection = true;
    if (userProfileSnapshot.empty) {
      userProfileSnapshot = await firestore()
        .collection('businessUsers')
        .where('email', '==', user.email)
        .limit(1)
        .get();
      isUserFromUsersCollection = false;
      if (userProfileSnapshot.empty) {
        throw new Error("User profile not found in Firestore");
      }
    }

    const userProfile = userProfileSnapshot.docs[0].data() as Profile;
    const targetCollection = isUserFromUsersCollection ? 'businessUsers' : 'users';

    // Collect profiles from multiple sources
    let allProfiles: Profile[] = [];
    let attempts = 0;
    const maxAttempts = 5; // Prevent infinite loops

    console.log(`👤 User type: ${isUserFromUsersCollection ? 'regular' : 'business'}`);
    console.log(`🎯 Target collection: ${targetCollection}`);

    // Keep fetching until we have enough profiles or exhaust all sources
    while (allProfiles.length < requestedCount && attempts < maxAttempts) {
      attempts++;
      console.log(`\n🔄 Fetch attempt ${attempts}/${maxAttempts}, current profiles: ${allProfiles.length}`);

      const batchResults = await Promise.allSettled([
        // Fetch opposite user type (main targets)
        fetchUserProfiles(targetCollection, excludeIds, 10),

        // For regular users, also fetch job ads
        isUserFromUsersCollection
          ? fetchJobAdProfiles(userProfile.skills, excludeIds, 15)
          : Promise.resolve({ profiles: [], hasMore: false })
      ]);

      // Process user profiles
      if (batchResults[0].status === 'fulfilled') {
        const userResult = batchResults[0].value;
        if (userResult.profiles.length > 0) {
          allProfiles.push(...userResult.profiles);
          console.log(`➕ Added ${userResult.profiles.length} ${targetCollection} profiles`);
        }

        if (!userResult.hasMore) {
          console.log(`⚠️ No more ${targetCollection} available`);
        }
      }

      // Process job ads (only for regular users)
      if (isUserFromUsersCollection && batchResults[1].status === 'fulfilled') {
        const jobResult = batchResults[1].value;
        if (jobResult.profiles.length > 0) {
          allProfiles.push(...jobResult.profiles);
          console.log(`➕ Added ${jobResult.profiles.length} job ad profiles`);
        }

        if (!jobResult.hasMore) {
          console.log(`⚠️ No more job ads available`);
        }
      }

      // Check if we can get more profiles
      const canGetMoreUsers = paginationState[targetCollection].hasMore;
      const canGetMoreJobs = isUserFromUsersCollection && paginationState.jobAds.hasMore;

      if (!canGetMoreUsers && !canGetMoreJobs) {
        console.log(`🏁 Exhausted all sources after ${attempts} attempts`);
        break;
      }

      // If we got some profiles this round, continue
      if (batchResults.some(result =>
        result.status === 'fulfilled' && result.value.profiles.length > 0
      )) {
        continue;
      } else {
        console.log(`⚠️ No new profiles in attempt ${attempts}, stopping`);
        break;
      }
    }

    // Remove duplicates and excluded IDs
    const uniqueProfiles = allProfiles.filter((profile, index, self) => {
      const isUnique = index === self.findIndex(p => p.id === profile.id);
      const notExcluded = !excludeIds.includes(profile.id);
      return isUnique && notExcluded;
    });

    console.log(`🔍 Total unique profiles before matching: ${uniqueProfiles.length}`);

    // Apply matching algorithm
    const matchedProfiles = matchProfiles(userProfile, uniqueProfiles);

    // Log source breakdown
    const sourceStats = matchedProfiles.reduce((acc, profile) => {
      acc[profile.source || 'unknown'] = (acc[profile.source || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📊 Profile sources:', sourceStats);
    console.log(`✅ Returning ${matchedProfiles.length} matched profiles`);

    return {
      profiles: matchedProfiles,
      updatedCache: cachedJobAds || []
    };

  } catch (error) {
    console.error("❌ Failed to fetch and match profiles:", error);
    return { profiles: [], updatedCache: cachedJobAds || [] };
  }
};

// Reset pagination (useful for refresh)
export const resetPagination = (): void => {
  paginationState = {
    users: { lastVisible: null, hasMore: true, offset: 0 },
    businessUsers: { lastVisible: null, hasMore: true, offset: 0 },
    jobAds: { offset: 0, hasMore: true, lastQuery: '' }
  };
  console.log('🔄 Reset all pagination state');
};

// Get pagination status for debugging
export const getPaginationStatus = () => {
  return {
    users: {
      hasMore: paginationState.users.hasMore,
      offset: paginationState.users.offset
    },
    businessUsers: {
      hasMore: paginationState.businessUsers.hasMore,
      offset: paginationState.businessUsers.offset
    },
    jobAds: {
      hasMore: paginationState.jobAds.hasMore,
      offset: paginationState.jobAds.offset,
      lastQuery: paginationState.jobAds.lastQuery
    }
  };
};