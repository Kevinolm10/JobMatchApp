import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, Image, StyleSheet, Alert, ActivityIndicator, Animated } from 'react-native';
import { TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';

import { auth, firestore } from '../frontend/services/firebaseConfig';
import { RootStackParamList } from '../types';
// UPDATED IMPORTS - Replace old Profile with new types
import {
  MatchableProfile,
  UserProfile,
  BusinessProfile,
  JobProfile,
} from '../frontend/types/profiles';
import { fetchAndMatchProfiles, resetPagination, getPaginationStatus } from '../frontend/components/SwipeAlgorithm';
import { fetchLocationName } from '../frontend/components/Location';
import { useSwipe } from '../frontend/components/useSwipe';
import {
  saveQueueToStorage,
  loadQueueFromStorage,
  saveSwipedIdsToStorage,
  loadSwipedIdsFromStorage,
  addSwipedId,
  debugStorage
} from '../frontend/components/userStateStorage';
import { JobAdProfile, debugJobAdsAPI, quickJobAdsTest } from '../frontend/services/fetchJobAds';

export type MainSwipeNavigationProp = StackNavigationProp<RootStackParamList, 'MainSwipe'>;

// Enhanced constants for better performance
const PREFETCH_THRESHOLD = 2;
const MAX_QUEUE_SIZE = 100;
const LOCATION_FETCH_TIMEOUT = 8000;
const DEBOUNCE_DELAY = 300;
const MIN_PROFILES_BEFORE_FETCH = 30;

export const MainSwipe: React.FC = () => {
  const navigation = useNavigation<MainSwipeNavigationProp>();

  // UPDATED STATE - Use MatchableProfile instead of Profile
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [profileQueue, setProfileQueue] = useState<MatchableProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [swipedIds, setSwipedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [prefetching, setPrefetching] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  // UPDATED REFS
  const allProfiles = useRef<MatchableProfile[]>([]);
  const cachedJobAds = useRef<JobAdProfile[] | null>(null);
  const locationController = useRef<AbortController | null>(null);
  const isInitialized = useRef(false);
  const isMounted = useRef(true);
  const fetchAttempts = useRef(0);
  const maxFetchAttempts = 3;

  // Memoized current profile to prevent unnecessary re-renders
  const currentProfile = useMemo(() => profileQueue[0], [profileQueue]);

  // Helper function to get profile display data using new structure
  const getProfileDisplayData = useCallback((profile: MatchableProfile) => {
    if (!profile) return null;

    switch (profile.source) {
      case 'user':
        const user = profile as UserProfile;
        return {
          name: `${user.firstName} ${user.lastName}`,
          image: user.image,
          skills: user.skills.map(s => s.name).join(', '),
          experience: user.experienceLevel,
          workCommitment: user.workCommitment.join(', '),
          location: user.location,
          locationName: user.location.name,
          email: user.email
        };

      case 'business':
        const business = profile as BusinessProfile;
        return {
          name: business.companyName,
          image: business.image,
          skills: business.typicalRequirements.skills.map(s => s.name).join(', '),
          experience: `${business.industry} • ${business.companySize} company`,
          workCommitment: business.workArrangement.join(', '),
          location: business.location,
          locationName: business.location.name,
          email: business.email
        };

      case 'jobAd':
        const job = profile as JobProfile;
        return {
          name: job.companyName,
          image: job.image,
          skills: job.requirements.skills.map(s => s.name).join(', '),
          experience: job.title,
          workCommitment: `${job.workCommitment} • ${job.workArrangement}`,
          location: job.location,
          locationName: job.location.name,
          email: job.email
        };

      default:
        return {
          name: 'Unknown',
          image: '',
          skills: '',
          experience: '',
          workCommitment: '',
          location: { latitude: 0, longitude: 0, name: '' },
          locationName: '',
          email: ''
        };
    }
  }, []);

  // Enhanced auth state listener (unchanged)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (isMounted.current) {
        setCurrentUser(user);
        setError(null);
        console.log('Auth state changed:', user ? user.email : 'No user');

        if (user?.email !== currentUser?.email) {
          isInitialized.current = false;
          fetchAttempts.current = 0;
          resetPagination();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.email]);

  // UPDATED debug function to work with new profile structure
  const debugCurrentState = useCallback(async () => {
    if (!currentUser?.email) return;

    console.log('\n=== MAIN SWIPE DEBUG ===');
    console.log('Current user:', currentUser.email);
    console.log('Profile queue length:', profileQueue.length);
    console.log('Swiped IDs count:', swipedIds.length);
    console.log('Is initialized:', isInitialized.current);
    console.log('Fetch attempts:', fetchAttempts.current);

    // Log profile sources breakdown
    const sourceBreakdown = profileQueue.reduce((acc, profile) => {
      acc[profile.source] = (acc[profile.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('Profile sources:', sourceBreakdown);

    const paginationStatus = getPaginationStatus();
    console.log('Pagination status:', paginationStatus);

    await debugStorage();

    // Test job ads if user is from users collection
    try {
      const userDoc = await getDocs(
        query(
          collection(firestore, 'users'),
          where('email', '==', currentUser.email),
          limit(1)
        )
      );

      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data();
        // Handle both old and new skill formats
        const userSkills = Array.isArray(userData.skills)
          ? userData.skills.map((s: any) => typeof s === 'string' ? s : s.name).join(', ')
          : userData.skills || '';

        console.log('User skills:', userSkills);

        if (userSkills) {
          console.log('Testing job ads API...');
          const testResult = await quickJobAdsTest(userSkills);
          console.log('Job ads test:', testResult);

          if (debugMode) {
            await debugJobAdsAPI(userSkills);
          }
        }
      }
    } catch (error) {
      console.error('Debug error:', error);
    }

    console.log('=== DEBUG COMPLETE ===\n');
  }, [currentUser, profileQueue, swipedIds.length, debugMode]);

  // UPDATED initialization function
  const initializeProfiles = useCallback(async () => {
    if (!currentUser?.email || isInitialized.current) return;

    try {
      setLoading(true);
      setError(null);
      fetchAttempts.current++;

      console.log(`🚀 Initializing profiles for: ${currentUser.email} (attempt ${fetchAttempts.current})`);

      // Try loading from cache first
      const [cachedQueue, cachedSwiped] = await Promise.allSettled([
        loadQueueFromStorage(currentUser.email),
        loadSwipedIdsFromStorage(currentUser.email)
      ]);

      const queueResult = cachedQueue.status === 'fulfilled' ? cachedQueue.value : null;
      const swipedResult = cachedSwiped.status === 'fulfilled' ? cachedSwiped.value : [];

      // Use cache if it has sufficient profiles
      if (queueResult && queueResult.length >= PREFETCH_THRESHOLD) {
        console.log('📦 Using cached profiles:', queueResult.length);
        setProfileQueue(queueResult.slice(0, MAX_QUEUE_SIZE));
        setSwipedIds(swipedResult);
        allProfiles.current = queueResult;
        isInitialized.current = true;

        setTimeout(() => {
          if (queueResult.length < MIN_PROFILES_BEFORE_FETCH) {
            prefetchMoreProfiles();
          }
        }, 1000);
      } else {
        console.log('🔄 Fetching fresh profiles...');
        await loadFreshProfiles(swipedResult);
      }
    } catch (error) {
      console.error('❌ Initialization error:', error);

      if (fetchAttempts.current >= maxFetchAttempts) {
        setError('Failed to load profiles after multiple attempts. Please check your connection and try again.');
      } else {
        setError('Failed to load profiles. Retrying...');
        setTimeout(() => {
          isInitialized.current = false;
          initializeProfiles();
        }, 2000);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [currentUser?.email]);

  // UPDATED loadFreshProfiles function
  const loadFreshProfiles = useCallback(async (excludeIds: string[] = []) => {
    if (!currentUser?.email) return;

    try {
      console.log(`🔄 Loading fresh profiles, excluding ${excludeIds.length} IDs`);

      const safeUser = { email: currentUser.email };
      const { profiles, updatedCache } = await fetchAndMatchProfiles(
        safeUser,
        excludeIds,
        cachedJobAds.current,
        MIN_PROFILES_BEFORE_FETCH
      );

      cachedJobAds.current = updatedCache;

      if (profiles.length > 0) {
        const limitedProfiles = profiles.slice(0, MAX_QUEUE_SIZE);
        setProfileQueue(limitedProfiles);
        allProfiles.current = profiles;
        setSwipedIds(excludeIds);
        isInitialized.current = true;

        console.log(`✅ Loaded ${limitedProfiles.length} fresh profiles`);

        // Debug profile sources with new structure
        const sources = limitedProfiles.reduce((acc, profile) => {
          acc[profile.source] = (acc[profile.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log('📊 Profile sources:', sources);

      } else {
        console.log('⚠️ No profiles returned from fetch');
        await debugCurrentState();
        setError('No profiles available at the moment. This might be because:\n• All available profiles have been swiped\n• Limited profiles match your criteria\n• Temporary service issues');
      }
    } catch (error) {
      console.error('❌ Error loading fresh profiles:', error);
      throw error;
    }
  }, [currentUser?.email, debugCurrentState]);

  // UPDATED prefetchMoreProfiles function
  const prefetchMoreProfiles = useCallback(async () => {
    if (!currentUser?.email || prefetching || loading) return;

    setPrefetching(true);
    try {
      console.log(`🔄 Prefetching more profiles... (current queue: ${profileQueue.length})`);

      const safeUser = { email: currentUser.email };
      const { profiles: moreProfiles, updatedCache } = await fetchAndMatchProfiles(
        safeUser,
        swipedIds,
        cachedJobAds.current,
        20
      );

      cachedJobAds.current = updatedCache;

      if (moreProfiles.length > 0) {
        const newProfiles = moreProfiles.filter(p =>
          !profileQueue.some(q => q.id === p.id) &&
          !swipedIds.includes(p.id)
        );

        if (newProfiles.length > 0) {
          setProfileQueue(prev => {
            const combined = [...prev, ...newProfiles];
            return combined.slice(0, MAX_QUEUE_SIZE);
          });

          allProfiles.current = [...allProfiles.current, ...newProfiles];
          console.log(`✅ Prefetched ${newProfiles.length} new profiles (total queue: ${profileQueue.length + newProfiles.length})`);
        } else {
          console.log('⚠️ No new profiles after filtering duplicates');
        }
      } else {
        console.log('⚠️ No more profiles available for prefetch');

        if (profileQueue.length <= 5) {
          await debugCurrentState();
        }
      }
    } catch (error) {
      console.warn('⚠️ Prefetch failed:', error);
    } finally {
      setPrefetching(false);
    }
  }, [currentUser?.email, swipedIds, profileQueue, prefetching, loading, debugCurrentState]);

  // Initialize when user is ready (unchanged)
  useEffect(() => {
    if (currentUser && !isInitialized.current) {
      initializeProfiles();
    }
  }, [currentUser, initializeProfiles]);

  // Enhanced debug useEffect (unchanged)
  useEffect(() => {
    const debugEmptyQueue = async () => {
      if (currentUser?.email && isInitialized.current && profileQueue.length === 0 && !loading && !prefetching) {
        console.log('🔍 DEBUGGING: Queue is empty but should have profiles');
        setDebugMode(true);
        await debugCurrentState();
        setDebugMode(false);
      }
    };

    debugEmptyQueue();
  }, [currentUser, profileQueue.length, loading, prefetching, isInitialized.current, debugCurrentState]);

  // Debounced storage saves (unchanged)
  const debouncedSaveQueue = useCallback(
    debounce((queue: MatchableProfile[], userEmail: string) => {
      if (queue.length > 0) {
        saveQueueToStorage(queue, userEmail);
      }
    }, DEBOUNCE_DELAY),
    []
  );

  const debouncedSaveSwipedIds = useCallback(
    debounce((ids: string[], userEmail: string) => {
      if (ids.length > 0) {
        saveSwipedIdsToStorage(ids, userEmail);
      }
    }, DEBOUNCE_DELAY),
    []
  );

  // Save to storage effects (unchanged)
  useEffect(() => {
    if (profileQueue.length > 0 && currentUser?.email) {
      debouncedSaveQueue(profileQueue, currentUser.email);
    }
  }, [profileQueue, currentUser?.email, debouncedSaveQueue]);

  useEffect(() => {
    if (swipedIds.length > 0 && currentUser?.email) {
      debouncedSaveSwipedIds(swipedIds, currentUser.email);
    }
  }, [swipedIds, currentUser?.email, debouncedSaveSwipedIds]);

  // UPDATED handleSwipe function
  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    if (!currentUser?.email || profileQueue.length === 0) {
      console.warn('Cannot swipe: no user or empty queue');
      return;
    }

    const swipedProfile = profileQueue[0];
    const displayData = getProfileDisplayData(swipedProfile);
    console.log(`👆 Swiped ${direction} on: ${displayData?.name} (${swipedProfile.source})`);

    // Optimistic updates
    const newSwipedIds = [...swipedIds, swipedProfile.id];
    setSwipedIds(newSwipedIds);
    setProfileQueue(prev => prev.slice(1));

    // Handle match logic for right swipes
    if (direction === 'right') {
      console.log('Potential match with:', displayData?.name);
      // TODO: Implement match detection and notification
    }

    // Save swiped ID immediately for persistence
    try {
      await addSwipedId(swipedProfile.id, currentUser.email);
    } catch (error) {
      console.warn('Failed to save swiped ID:', error);
    }

    // Enhanced prefetch logic
    const remainingProfiles = profileQueue.length - 1;
    if (remainingProfiles <= PREFETCH_THRESHOLD && !prefetching) {
      console.log(`⚡ Triggering prefetch: ${remainingProfiles} profiles remaining`);
      prefetchMoreProfiles();
    }

    if (remainingProfiles <= 1 && !prefetching) {
      console.warn('🚨 Critical: Only 1 profile remaining!');
    }

  }, [currentUser?.email, profileQueue, swipedIds, prefetching, prefetchMoreProfiles, getProfileDisplayData]);

  const { pan, panResponder } = useSwipe(handleSwipe);

  // UPDATED location fetching to work with new structure
  useEffect(() => {
    if (!currentProfile?.location || currentProfile.location.name) return;

    const { latitude, longitude } = currentProfile.location;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;

    // Cancel previous request
    if (locationController.current) {
      locationController.current.abort();
    }

    locationController.current = new AbortController();

    const fetchLocation = async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Location fetch timeout')), LOCATION_FETCH_TIMEOUT)
        );

        const locationPromise = fetchLocationName(latitude, longitude);
        const locationName = await Promise.race([locationPromise, timeoutPromise]);

        // Check if component is still mounted and profile is still current
        if (isMounted.current && !locationController.current?.signal.aborted) {
          setProfileQueue(prev => {
            const updated = [...prev];
            if (updated[0]?.id === currentProfile.id) {
              // Update location name in the profile
              updated[0] = {
                ...updated[0],
                location: {
                  ...updated[0].location,
                  name: locationName
                }
              };
            }
            return updated;
          });
        }
      } catch (error: any) {
        if (error.name !== 'AbortError' && error.message !== 'Location fetch timeout') {
          console.warn('Location fetch failed:', error);
        }
      }
    };

    fetchLocation();
  }, [currentProfile?.id, currentProfile?.location]);

  // Cleanup effects (unchanged)
  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      return () => {
        if (locationController.current) {
          locationController.current.abort();
        }
      };
    }, [])
  );

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (locationController.current) {
        locationController.current.abort();
      }
    };
  }, []);

  // Utility debounce function (unchanged)
  function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // Loading state (unchanged)
  if (loading || !currentUser) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading profiles...</Text>
        {prefetching && (
          <Text style={styles.prefetchingText}>Loading more...</Text>
        )}
      </View>
    );
  }

  // Error state (unchanged)
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            isInitialized.current = false;
            initializeProfiles();
          }}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state (unchanged)
  if (!currentProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No more profiles to show!</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => prefetchMoreProfiles()}
          disabled={prefetching}
        >
          <Text style={styles.retryButtonText}>
            {prefetching ? 'Loading...' : 'Load More'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // UPDATED main render to use new profile structure
  const displayData = getProfileDisplayData(currentProfile);

  if (!displayData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error displaying profile</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Profile Card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              {
                rotate: pan.x.interpolate({
                  inputRange: [-300, 0, 300],
                  outputRange: ['-15deg', '0deg', '15deg'],
                  extrapolate: 'clamp'
                })
              }
            ]
          }
        ]}
      >
        <Image
          source={{
            uri: displayData.image || 'https://via.placeholder.com/300x400/8456ad/ffffff?text=No+Image'
          }}
          style={styles.profileImage}
          resizeMode="cover"
        />

        <View style={styles.cardInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {displayData.name}
          </Text>

          {displayData.experience && (
            <Text style={styles.experience} numberOfLines={1}>
              💼 {displayData.experience}
            </Text>
          )}

          <Text style={styles.skills} numberOfLines={2}>
            🔧 {displayData.skills || "No skills listed"}
          </Text>

          <Text style={styles.location} numberOfLines={1}>
            📍 {displayData.locationName || "Loading location..."}
          </Text>

          {displayData.workCommitment && (
            <Text style={styles.workCommitment} numberOfLines={1}>
              ⏰ {displayData.workCommitment}
            </Text>
          )}

          {(currentProfile as any).score && (
            <View style={styles.matchContainer}>
              <Text style={styles.matchScore}>
                {Math.round((currentProfile as any).score * 100)}% Match
              </Text>
            </View>
          )}

          {/* Add profile type indicator */}
          <View style={styles.typeIndicator}>
            <Text style={styles.typeText}>
              {currentProfile.source === 'user' ? '👤 Job Seeker' :
                currentProfile.source === 'business' ? '🏢 Company' : '💼 Job Ad'}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Queue indicator (unchanged) */}
      <View style={styles.queueIndicator}>
        <Text style={styles.queueText}>
          {profileQueue.length - 1} more profiles
        </Text>
        {prefetching && (
          <ActivityIndicator size="small" color="#fff" style={styles.prefetchIndicator} />
        )}
      </View>

      {/* Bottom Navigation (unchanged) */}
      <View style={styles.bottomMenu}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.navigate("MessagesScreen")}
          activeOpacity={0.7}
        >
          <Icon name="envelope" size={24} color="black" />
          <Text style={styles.menuText}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton} activeOpacity={0.7}>
          <Icon name="home" size={24} color="black" />
          <Text style={styles.menuText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.navigate("SettingsScreen")}
          activeOpacity={0.7}
        >
          <Icon name="cog" size={24} color="black" />
          <Text style={styles.menuText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// UPDATED styles with new type indicator
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#8456ad',
  },
  card: {
    width: 320,
    height: 520,
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    position: 'absolute',
    bottom: 160,
  },
  profileImage: {
    width: "100%",
    height: "55%",
    backgroundColor: '#f0f0f0',
  },
  cardInfo: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
    color: '#333'
  },
  skills: {
    fontSize: 15,
    marginBottom: 6,
    color: '#555',
    lineHeight: 20,
  },
  experience: {
    fontSize: 15,
    marginBottom: 6,
    color: '#555'
  },
  location: {
    fontSize: 14,
    color: "#666",
    marginBottom: 6
  },
  workCommitment: {
    fontSize: 14,
    marginBottom: 8,
    color: '#555'
  },
  matchContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#8456ad',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginBottom: 8,
  },
  matchScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  typeIndicator: {
    alignSelf: 'flex-end',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  queueIndicator: {
    position: 'absolute',
    top: 60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  queueText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  prefetchIndicator: {
    marginLeft: 8,
  },
  bottomMenu: {
    position: "absolute",
    bottom: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 40,
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    shadowOpacity: 0.15,
    elevation: 8,
  },
  menuButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  menuText: {
    fontSize: 12,
    color: "black",
    fontWeight: '600'
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  prefetchingText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
    opacity: 0.8,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginHorizontal: 40,
    marginBottom: 20,
    lineHeight: 24,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 3,
  },
  retryButtonText: {
    color: '#8456ad',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default MainSwipe;