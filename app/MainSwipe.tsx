import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Alert, ActivityIndicator, Animated } from 'react-native';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { matchProfiles } from '../frontend/components/SwipeAlgorithm';
import { fetchLocationName } from '../frontend/components/Location';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { StackNavigationProp } from '@react-navigation/stack';
import { mapJobAdsToProfiles } from '../mapJobAdsToProfiles';
import getJobAds, { JobAdProfile } from '../fetchJobAds';
import { useSwipe } from '../frontend/components/useSwipe';

import AsyncStorage from '@react-native-async-storage/async-storage';

export type MainSwipeNavigationProp = StackNavigationProp<RootStackParamList, 'MainSwipe'>;

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
  locationName?: string; // optional field
}

const QUEUE_KEY = 'PROFILE_QUEUE_CACHE';
const SWIPED_KEY = 'SWIPED_PROFILE_IDS';

const MainSwipe: React.FC = () => {
  const navigation = useNavigation<MainSwipeNavigationProp>();
  const [profileQueue, setProfileQueue] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [swipedIds, setSwipedIds] = useState<string[]>([]);
  const allProfiles = useRef<Profile[]>([]);
  const db = getFirestore();
  const auth = getAuth();
  const cachedJobAds = useRef<JobAdProfile[] | null>(null);

  const saveQueueToStorage = async (queue: Profile[]) => {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to save queue', e);
    }
  };

  const loadQueueFromStorage = async (): Promise<Profile[] | null> => {
    try {
      const json = await AsyncStorage.getItem(QUEUE_KEY);
      return json ? JSON.parse(json) : null;
    } catch (e) {
      console.error('Failed to load queue', e);
      return null;
    }
  };

  const saveSwipedIdsToStorage = async (ids: string[]) => {
    try {
      await AsyncStorage.setItem(SWIPED_KEY, JSON.stringify(ids));
    } catch (e) {
      console.error('Failed to save swiped IDs', e);
    }
  };

  const loadSwipedIdsFromStorage = async (): Promise<string[]> => {
    try {
      const json = await AsyncStorage.getItem(SWIPED_KEY);
      return json ? JSON.parse(json) : [];
    } catch (e) {
      console.error('Failed to load swiped IDs', e);
      return [];
    }
  };

  const fetchProfiles = async (excludeIds: string[] = []) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.warn("No authenticated user");
        return [];
      }

      const usersCollection = collection(db, 'users');
      const profileSnapshot = await getDocs(usersCollection);
      const firestoreProfiles = profileSnapshot.docs.map((doc) => ({
        ...(doc.data() as Profile),
        id: doc.id,
      }));

      const userProfileDoc = profileSnapshot.docs.find((doc) => doc.data().email === user.email);
      if (!userProfileDoc) {
        console.warn("No user profile found for current user");
        return [];
      }

      const userProfile = userProfileDoc.data() as Profile;

      let jobAds: JobAdProfile[] = [];
      if (cachedJobAds.current) {
        jobAds = cachedJobAds.current;
      } else {
        jobAds = await getJobAds(userProfile.skills);
        cachedJobAds.current = jobAds;
      }

      const jobProfiles = mapJobAdsToProfiles(jobAds);
      const combinedProfiles = [...firestoreProfiles, ...jobProfiles];

      // Match profiles using your algorithm
      let matchedProfiles = matchProfiles(userProfile, combinedProfiles) as Profile[];

      // Filter out swiped profiles
      matchedProfiles = matchedProfiles.filter((p: Profile) => !excludeIds.includes(p.id));

      return matchedProfiles;
    } catch (error) {
      console.error("Error fetching profiles: ", error);
      Alert.alert("Error", "Unable to fetch profiles.");
      return [];
    }
  };

  // Initialize: load cached queue and swiped IDs or fetch fresh profiles
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      const cachedQueue = await loadQueueFromStorage();
      const cachedSwiped = await loadSwipedIdsFromStorage();

      if (cachedQueue && cachedQueue.length > 0) {
        setProfileQueue(cachedQueue);
        setSwipedIds(cachedSwiped);
        allProfiles.current = cachedQueue;
      } else {
        const profiles = await fetchProfiles(cachedSwiped);
        setProfileQueue(profiles.slice(0, 10)); // Load initial batch (adjust size if needed)
        allProfiles.current = profiles;
        setSwipedIds(cachedSwiped);
      }
      setLoading(false);
    };
    initialize();
  }, []);

  // Save queue and swiped IDs whenever they change
  useEffect(() => {
    if (profileQueue.length > 0) saveQueueToStorage(profileQueue);
  }, [profileQueue]);

  useEffect(() => {
    saveSwipedIdsToStorage(swipedIds);
  }, [swipedIds]);

  // Swipe handler - removes first profile, adds more if queue short
  const { pan, panResponder } = useSwipe(async (direction) => {
    if (profileQueue.length === 0) return;

    const swipedProfile = profileQueue[0];
    setSwipedIds(prev => [...prev, swipedProfile.id]);

    setProfileQueue(prev => prev.slice(1)); // Remove swiped profile from front

    // Prefetch if queue running low (e.g., less than 3 profiles)
    if (profileQueue.length <= 3) {
      setLoading(true);
      const moreProfiles = await fetchProfiles([...swipedIds, swipedProfile.id]);
      const filtered = moreProfiles.filter(p => !profileQueue.some(q => q.id === p.id));
      setProfileQueue(prev => [...prev, ...filtered]);
      allProfiles.current = [...allProfiles.current, ...filtered];
      setLoading(false);
    }
  });

  // Fetch location name for current (first) profile if missing
  useEffect(() => {
    const currentProfile = profileQueue[0];
    if (
      currentProfile &&
      !currentProfile.locationName &&
      currentProfile.location &&
      typeof currentProfile.location.latitude === 'number' &&
      typeof currentProfile.location.longitude === 'number'
    ) {
      fetchLocationName(
        currentProfile.location.latitude,
        currentProfile.location.longitude
      ).then((name) => {
        setProfileQueue((prev) => {
          const updated = [...prev];
          updated[0] = { ...currentProfile, locationName: name };
          return updated;
        });
      });
    }
  }, [profileQueue]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  const currentProfile = profileQueue[0];

  return (
    <View style={styles.container}>
      {currentProfile && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.card, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
        >
          <Image source={{ uri: currentProfile.image }} style={styles.profileImage} />
          <View style={styles.cardInfo}>
            <Text style={styles.name}>{currentProfile.firstName} {currentProfile.lastName}</Text>
            <Text style={styles.experience}>Experience: {currentProfile.experience || "Not specified"}</Text>
            <Text style={styles.skills}>Skills: {currentProfile.skills || "N/A"}</Text>
            <Text style={styles.location}>Location: {currentProfile.locationName || "Loading..."}</Text>
            <Text style={styles.phone}>Phone: {currentProfile.phoneNumber || "N/A"}</Text>
            <Text style={styles.workCommitment}>Work Commitment: {currentProfile.workCommitment || "N/A"}</Text>
          </View>
        </Animated.View>
      )}

      <View style={styles.bottomMenu}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate("MessagesScreen")}>
          <Icon name="envelope" size={24} color="black" />
          <Text style={styles.menuText}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton}>
          <Icon name="home" size={24} color="black" />
          <Text style={styles.menuText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate("SettingsScreen")}>
          <Icon name="cog" size={24} color="black" />
          <Text style={styles.menuText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Styles unchanged
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#8456ad',
  },
  card: {
    width: 300,
    height: 500,
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    position: 'absolute',
    bottom: 150,
  },
  profileImage: {
    width: "100%",
    height: "50%",
  },
  cardInfo: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f9f9f9",
  },
  name: { fontSize: 22, fontWeight: "bold", marginBottom: 5 },
  email: { fontSize: 16, color: "#888", marginBottom: 5 },
  skills: { fontSize: 16, marginBottom: 5 },
  experience: { fontSize: 16, marginBottom: 5 },
  location: { fontSize: 14, color: "#888", marginBottom: 5 },
  phone: { fontSize: 14, marginBottom: 5 },
  workCommitment: { fontSize: 14, marginBottom: 5 },
  bottomMenu: {
    position: "absolute",
    bottom: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 50,
    paddingVertical: 10,
    borderRadius: 35,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 10,
    shadowOpacity: 0.1,
  },
  menuButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  menuText: { fontSize: 16, color: "black" },
});

export default MainSwipe;
