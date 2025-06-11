import firestore from '@react-native-firebase/firestore';
import haversine from 'haversine-distance';
import mapJobAdsToProfiles from '../services/mapJobAdsToProfiles';
import { JobAdProfile, getJobAdsEnhanced } from '../services/fetchJobAds';
import {
  UserProfile,
  BusinessProfile,
  JobProfile,
  MatchableProfile,
  Skill,
  getProfileSkills,
  getProfileLocation,
  getDisplayName
} from '../types/profiles';

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

const defaultLocation = { latitude: 59.3293, longitude: 18.0686, name: 'Stockholm' };

// Enhanced location parsing with name support
const parseLocation = (
  location: string | { latitude: number; longitude: number; name?: string } | undefined
): { latitude: number; longitude: number; name: string } => {
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
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    name: location.name || 'Unknown location'
  };
};

// Enhanced skill matching with structured skills
const skillMatchScore = (skillsA: Skill[], skillsB: Skill[]): number => {
  if (!skillsA.length || !skillsB.length) return 0;

  let totalScore = 0;
  let maxPossibleScore = 0;

  skillsA.forEach(skillA => {
    maxPossibleScore += 1;
    const matchingSkill = skillsB.find(skillB =>
      skillB.name.toLowerCase() === skillA.name.toLowerCase()
    );

    if (matchingSkill) {
      // Base score for skill match
      let score = 0.5;

      // Bonus for exact level match
      if (matchingSkill.level === skillA.level) {
        score += 0.3;
      } else {
        // Partial score for close level match
        const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
        const levelDiff = Math.abs(
          levels.indexOf(skillA.level) - levels.indexOf(matchingSkill.level)
        );
        score += Math.max(0, 0.3 - (levelDiff * 0.1));
      }

      // Bonus for same category
      if (matchingSkill.category === skillA.category) {
        score += 0.1;
      }

      // Bonus for verified skills
      if (skillA.verified && matchingSkill.verified) {
        score += 0.1;
      }

      totalScore += Math.min(score, 1);
    }
  });

  return maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
};

// Backward compatibility for old string-based skills
const convertLegacySkills = (skills: string): Skill[] => {
  if (!skills || typeof skills !== 'string') return [];

  return skills
    .split(',')
    .map(skill => skill.trim())
    .filter(skill => skill.length > 0)
    .map(skillName => ({
      name: skillName,
      category: 'technical' as const, // Default category
      level: 'intermediate' as const, // Default level
      verified: false
    }));
};

// Enhanced matching algorithm with new profile types
const matchProfiles = (userProfile: MatchableProfile, profiles: MatchableProfile[]): MatchableProfile[] => {
  return profiles
    .map(profile => {
      const userLoc = parseLocation(getProfileLocation(userProfile));
      const profileLoc = parseLocation(getProfileLocation(profile));

      // Distance scoring
      const distanceKm = haversine(userLoc, profileLoc) / 1000;
      const maxDistance = 50; // km
      const distanceScore = Math.max(0, 1 - (distanceKm / maxDistance));

      // Enhanced skill matching
      const userSkills = getProfileSkills(userProfile);
      const profileSkills = getProfileSkills(profile);
      const skillScore = skillMatchScore(userSkills, profileSkills);

      // Work commitment matching (enhanced for new structure)
      let commitmentScore = 0;
      if (userProfile.source === 'user' && profile.source === 'jobAd') {
        const user = userProfile as UserProfile;
        const job = profile as JobProfile;
        commitmentScore = user.workCommitment.includes(job.workCommitment) ? 1 : 0;
      } else if (userProfile.source === 'business' && profile.source === 'user') {
        const business = userProfile as BusinessProfile;
        const user = profile as UserProfile;
        const hasMatchingCommitment = business.typicalRequirements.workCommitment
          .some(commitment => user.workCommitment.includes(commitment));
        commitmentScore = hasMatchingCommitment ? 1 : 0;
      }

      // Experience level matching
      let experienceScore = 0;
      if (userProfile.source === 'user' && profile.source === 'jobAd') {
        const user = userProfile as UserProfile;
        const job = profile as JobProfile;
        experienceScore = job.requirements.experienceLevel.includes(user.experienceLevel) ? 1 : 0;
      }

      // Industry preferences (for users)
      let industryScore = 0;
      if (userProfile.source === 'user' && (profile.source === 'business' || profile.source === 'jobAd')) {
        const user = userProfile as UserProfile;
        const targetIndustry = profile.source === 'business'
          ? (profile as BusinessProfile).industry
          : (profile as JobProfile).industry;
        industryScore = user.preferences.industries.includes(targetIndustry) ? 0.5 : 0;
      }

      // Source-based boost (prioritize business users and job ads for regular users)
      const sourceBoost = profile.source === 'business' ? 0.15 :
        profile.source === 'jobAd' ? 0.1 : 0;

      // Calculate final score with weights
      const finalScore = (
        distanceScore * 0.25 +      // 25% location
        skillScore * 0.40 +         // 40% skills
        commitmentScore * 0.15 +    // 15% work commitment
        experienceScore * 0.10 +    // 10% experience
        industryScore * 0.05 +      // 5% industry preferences
        sourceBoost * 0.05          // 5% source boost
      );

      return {
        ...profile,
        score: finalScore,
        // Add debug info (remove in production)
        _debug: {
          distanceKm: Math.round(distanceKm * 10) / 10,
          distanceScore: Math.round(distanceScore * 100) / 100,
          skillScore: Math.round(skillScore * 100) / 100,
          commitmentScore,
          experienceScore,
          industryScore,
          sourceBoost,
          finalScore: Math.round(finalScore * 100) / 100
        }
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
};

// Enhanced function to fetch users with new profile structure
const fetchUserProfiles = async (
  targetCollection: 'users' | 'businessUsers',
  excludeIds: string[] = [],
  limit: number = 10
): Promise<{ profiles: MatchableProfile[]; hasMore: boolean }> => {
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

    const profiles: MatchableProfile[] = snapshot.docs
      .map(doc => {
        const raw = doc.data();

        // Convert legacy data to new structure
        if (targetCollection === 'users') {
          // Handle legacy user profiles
          const userProfile: UserProfile = {
            ...raw as any,
            id: doc.id,
            source: 'user',
            // Convert legacy skills if needed
            skills: Array.isArray(raw.skills) ? raw.skills : convertLegacySkills(raw.skills || ''),
            // Ensure location has name
            location: {
              ...parseLocation(raw.location),
            },
            // Add default values for new fields if missing
            experienceLevel: raw.experienceLevel || 'intermediate',
            workCommitment: Array.isArray(raw.workCommitment)
              ? raw.workCommitment
              : [raw.workCommitment || 'full-time'],
            preferences: raw.preferences || {
              industries: [],
              companySize: [],
              workArrangement: ['on-site'],
              maxCommute: 25
            }
          };
          return userProfile;
        } else {
          // Handle legacy business profiles
          const businessProfile: BusinessProfile = {
            ...raw as any,
            id: doc.id,
            source: 'business',
            // Convert legacy requirements to typicalRequirements
            typicalRequirements: {
              skills: Array.isArray(raw.requirements)
                ? convertLegacySkills(raw.requirements.join(', '))
                : convertLegacySkills(raw.skills || ''),
              experienceLevel: ['intermediate'], // Default
              workCommitment: ['full-time'] // Default
            },
            // Ensure location has name
            location: {
              ...parseLocation(raw.location),
            },
            // Add default values for new fields
            industry: raw.industry || 'Technology',
            companySize: raw.companySize || 'medium',
            description: raw.description || '',
            contactPerson: raw.contactPerson || {
              firstName: 'Contact',
              lastName: 'Person',
              title: 'Recruiter',
              phoneNumber: raw.phoneNumber || ''
            },
            benefits: raw.benefits || [],
            workArrangement: raw.workArrangement || ['on-site']
          };
          return businessProfile;
        }
      })
      .filter(profile => {
        const skills = getProfileSkills(profile);
        return skills.length > 0 && !excludeIds.includes(profile.id);
      });

    console.log(`Fetched ${profiles.length} ${targetCollection} profiles`);
    return { profiles, hasMore: state.hasMore };

  } catch (error) {
    console.error(`Error fetching ${targetCollection}:`, error);
    return { profiles: [], hasMore: false };
  }
};

// Enhanced function to fetch job ads (keeping similar to original but with new types)
const fetchJobAdProfiles = async (
  userSkills: Skill[],
  excludeIds: string[] = [],
  limit: number = 20
): Promise<{ profiles: JobProfile[]; hasMore: boolean }> => {
  try {
    const jobState = paginationState.jobAds;
    const skillsString = userSkills.map(s => s.name).join(', ');

    // Reset offset if query changed
    if (jobState.lastQuery !== skillsString) {
      jobState.offset = 0;
      jobState.hasMore = true;
      jobState.lastQuery = skillsString;
    }

    if (!jobState.hasMore) {
      console.log('No more job ads to fetch');
      return { profiles: [], hasMore: false };
    }

    console.log(`🔍 Fetching job ads with offset: ${jobState.offset}, limit: ${limit}`);

    const response = await getJobAdsEnhanced(skillsString, jobState.offset, limit);

    if (response.error) {
      console.error('Job ads API error:', response.error);
      return { profiles: [], hasMore: false };
    }

    const jobAds = response.jobAds;
    jobState.hasMore = response.hasMore && jobAds.length === limit;
    jobState.offset += jobAds.length;

    // Convert job ads to new JobProfile structure
    const jobProfiles: JobProfile[] = mapJobAdsToProfiles(jobAds)
      .filter(profile => !excludeIds.includes(profile.id))
      .map(legacyProfile => {
        // Convert legacy job profile to new JobProfile structure
        const jobProfile: JobProfile = {
          id: legacyProfile.id,
          email: legacyProfile.email,
          image: legacyProfile.image,
          location: parseLocation(legacyProfile.location),
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,

          title: legacyProfile.experience, // Job title was stored in experience
          companyName: legacyProfile.firstName, // Company name was in firstName
          description: `Job opportunity at ${legacyProfile.firstName}`,

          requirements: {
            skills: convertLegacySkills(legacyProfile.skills),
            experienceLevel: [], // Default
            education: [],
            certifications: []
          },

          workCommitment: legacyProfile.workCommitment as any || 'full-time',
          workArrangement: 'on-site', // Default
          industry: 'Technology', // Default

          source: 'jobAd',
          score: legacyProfile.score
        };

        return jobProfile;
      });

    console.log(`✅ Converted ${jobProfiles.length} job ads to new profile structure`);
    return { profiles: jobProfiles, hasMore: jobState.hasMore };

  } catch (error) {
    console.error('Error fetching job ad profiles:', error);
    paginationState.jobAds.hasMore = false;
    return { profiles: [], hasMore: false };
  }
};

// Mix profiles function updated for new types
const mixProfiles = (profiles: MatchableProfile[], ratio: { business: number; jobAd: number }): MatchableProfile[] => {
  const businessProfiles = profiles.filter(p => p.source === 'business');
  const jobAdProfiles = profiles.filter(p => p.source === 'jobAd');
  const userProfiles = profiles.filter(p => p.source === 'user');

  console.log(`📊 Mixing profiles - Business: ${businessProfiles.length}, JobAds: ${jobAdProfiles.length}, Users: ${userProfiles.length}`);

  const mixed: MatchableProfile[] = [];
  let businessIndex = 0;
  let jobAdIndex = 0;
  let userIndex = 0;

  // Mix according to ratio
  while (businessIndex < businessProfiles.length ||
    jobAdIndex < jobAdProfiles.length ||
    userIndex < userProfiles.length) {

    // Add business users according to ratio
    for (let i = 0; i < ratio.business && businessIndex < businessProfiles.length; i++) {
      mixed.push(businessProfiles[businessIndex++]);
    }

    // Add job ads according to ratio
    for (let i = 0; i < ratio.jobAd && jobAdIndex < jobAdProfiles.length; i++) {
      mixed.push(jobAdProfiles[jobAdIndex++]);
    }

    // Add any regular users (for business user queries)
    if (userIndex < userProfiles.length) {
      mixed.push(userProfiles[userIndex++]);
    }
  }

  return mixed;
};

interface User {
  email: string;
}

// MAIN ENHANCED FUNCTION updated for new profile types
export const fetchAndMatchProfiles = async (
  user: User,
  excludeIds: string[] = [],
  cachedJobAds: JobAdProfile[] | null = null,
  requestedCount: number = 20
): Promise<{ profiles: MatchableProfile[]; updatedCache: JobAdProfile[] }> => {
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
    let userProfile: MatchableProfile;

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

    // Convert to new profile structure
    const rawUserData = userProfileSnapshot.docs[0].data();
    if (isUserFromUsersCollection) {
      userProfile = {
        ...rawUserData,
        id: userProfileSnapshot.docs[0].id,
        source: 'user',
        skills: Array.isArray(rawUserData.skills) ? rawUserData.skills : convertLegacySkills(rawUserData.skills || ''),
        location: parseLocation(rawUserData.location),
        experienceLevel: rawUserData.experienceLevel || 'intermediate',
        workCommitment: Array.isArray(rawUserData.workCommitment)
          ? rawUserData.workCommitment
          : [rawUserData.workCommitment || 'full-time'],
        preferences: rawUserData.preferences || {
          industries: [],
          companySize: [],
          workArrangement: ['on-site'],
          maxCommute: 25
        }
      } as UserProfile;
    } else {
      userProfile = {
        ...rawUserData,
        id: userProfileSnapshot.docs[0].id,
        source: 'business',
        typicalRequirements: {
          skills: Array.isArray(rawUserData.requirements)
            ? convertLegacySkills(rawUserData.requirements.join(', '))
            : convertLegacySkills(rawUserData.skills || ''),
          experienceLevel: ['intermediate'],
          workCommitment: ['full-time']
        },
        location: parseLocation(rawUserData.location),
        industry: rawUserData.industry || 'Technology',
        companySize: rawUserData.companySize || 'medium',
        description: rawUserData.description || '',
        contactPerson: rawUserData.contactPerson || {
          firstName: 'Contact',
          lastName: 'Person',
          title: 'Recruiter',
          phoneNumber: rawUserData.phoneNumber || ''
        },
        benefits: rawUserData.benefits || [],
        workArrangement: rawUserData.workArrangement || ['on-site']
      } as unknown as BusinessProfile;
    }

    // Rest of the function continues with similar logic but using new profile types...
    // [The rest would follow the same pattern as your original function]

    console.log(`👤 User type: ${isUserFromUsersCollection ? 'regular' : 'business'}`);
    console.log(`🎯 User skills: ${getProfileSkills(userProfile).map(s => s.name).join(', ')}`);

    // Continue with the fetching logic using the updated functions...
    let allProfiles: MatchableProfile[] = [];
    let attempts = 0;
    const maxAttempts = 5;

    // Keep fetching until we have enough profiles or exhaust all sources
    while (allProfiles.length < requestedCount && attempts < maxAttempts) {
      attempts++;
      console.log(`\n🔄 Fetch attempt ${attempts}/${maxAttempts}, current profiles: ${allProfiles.length}`);

      // Different fetching strategy based on user type
      if (isUserFromUsersCollection) {
        // Regular users see both business users and job ads
        const batchResults = await Promise.allSettled([
          // Fetch business users (primary target for regular users)
          fetchUserProfiles('businessUsers', excludeIds, 12),
          // Also fetch job ads
          fetchJobAdProfiles(getProfileSkills(userProfile), excludeIds, 12)
        ]);

        // Process business users
        if (batchResults[0].status === 'fulfilled') {
          const businessResult = batchResults[0].value;
          if (businessResult.profiles.length > 0) {
            allProfiles.push(...businessResult.profiles);
            console.log(`➕ Added ${businessResult.profiles.length} business profiles`);
          }
          if (!businessResult.hasMore) {
            console.log(`⚠️ No more business users available`);
          }
        }

        // Process job ads
        if (batchResults[1].status === 'fulfilled') {
          const jobResult = batchResults[1].value;
          if (jobResult.profiles.length > 0) {
            allProfiles.push(...jobResult.profiles);
            console.log(`➕ Added ${jobResult.profiles.length} job ad profiles`);
          }
          if (!jobResult.hasMore) {
            console.log(`⚠️ No more job ads available`);
          }
        }

        // Check if we can get more
        const canGetMoreBusiness = paginationState.businessUsers.hasMore;
        const canGetMoreJobs = paginationState.jobAds.hasMore;

        if (!canGetMoreBusiness && !canGetMoreJobs) {
          console.log(`🏁 Exhausted all sources for regular user`);
          break;
        }

      } else {
        // Business users primarily see regular users, optionally other businesses
        const batchResults = await Promise.allSettled([
          // Fetch regular users (primary target for business users)
          fetchUserProfiles('users', excludeIds, 15),
          // Optionally fetch other business users (excluding self)
          fetchUserProfiles('businessUsers', [...excludeIds, userProfileSnapshot.docs[0].id], 5)
        ]);

        // Process regular users
        if (batchResults[0].status === 'fulfilled') {
          const userResult = batchResults[0].value;
          if (userResult.profiles.length > 0) {
            allProfiles.push(...userResult.profiles);
            console.log(`➕ Added ${userResult.profiles.length} user profiles`);
          }
          if (!userResult.hasMore) {
            console.log(`⚠️ No more regular users available`);
          }
        }

        // Process other business users
        if (batchResults[1].status === 'fulfilled') {
          const businessResult = batchResults[1].value;
          if (businessResult.profiles.length > 0) {
            allProfiles.push(...businessResult.profiles);
            console.log(`➕ Added ${businessResult.profiles.length} other business profiles`);
          }
        }

        // Check if we can get more
        if (!paginationState.users.hasMore && !paginationState.businessUsers.hasMore) {
          console.log(`🏁 Exhausted all sources for business user`);
          break;
        }
      }

      // If no new profiles were added this round, stop
      if (attempts > 1 && allProfiles.length === 0) {
        console.log(`⚠️ No profiles found after ${attempts} attempts`);
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
    let matchedProfiles = matchProfiles(userProfile, uniqueProfiles);

    // For regular users, apply mixing to ensure business users appear regularly
    if (isUserFromUsersCollection && matchedProfiles.length > 0) {
      // Mix with ratio of 1 business user for every 2 job ads
      matchedProfiles = mixProfiles(matchedProfiles, { business: 1, jobAd: 2 });
    }

    // Log source breakdown
    const sourceStats = matchedProfiles.reduce((acc, profile) => {
      acc[profile.source || 'unknown'] = (acc[profile.source || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📊 Final profile sources:', sourceStats);
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

// Keep your existing helper functions
export const resetPagination = (): void => {
  paginationState = {
    users: { lastVisible: null, hasMore: true, offset: 0 },
    businessUsers: { lastVisible: null, hasMore: true, offset: 0 },
    jobAds: { offset: 0, hasMore: true, lastQuery: '' }
  };
  console.log('🔄 Reset all pagination state');
};

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