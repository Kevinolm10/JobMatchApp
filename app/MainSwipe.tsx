import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Alert, ActivityIndicator, Animated } from 'react-native';
import { getAuth } from 'firebase/auth';
import { TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { StackNavigationProp } from '@react-navigation/stack';
import { Profile } from '../frontend/components/SwipeAlgorithm';

import { fetchAndMatchProfiles } from '../frontend/components/SwipeAlgorithm';
import { fetchLocationName } from '../frontend/components/Location';
import { useSwipe } from '../frontend/components/useSwipe';
import {
  saveQueueToStorage,
  loadQueueFromStorage,
  saveSwipedIdsToStorage,
  loadSwipedIdsFromStorage
} from '../frontend/components/userStateStorage';
import { JobAdProfile } from '../fetchJobAds';

export type MainSwipeNavigationProp = StackNavigationProp<RootStackParamList, 'MainSwipe'>;


const MainSwipe: React.FC = () => {
  const navigation = useNavigation<MainSwipeNavigationProp>();
  const [profileQueue, setProfileQueue] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [swipedIds, setSwipedIds] = useState<string[]>([]);
  const allProfiles = useRef<Profile[]>([]);
  const auth = getAuth();
  const cachedJobAds = useRef<JobAdProfile[] | null>(null);

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
        const user = auth.currentUser;
        const { profiles, updatedCache } = await fetchAndMatchProfiles(user, cachedSwiped);
        cachedJobAds.current = updatedCache;

        setProfileQueue(profiles.slice(0, 10));
        allProfiles.current = profiles;
        setSwipedIds(cachedSwiped);
      }
      setLoading(false);
    };
    initialize();
  }, []);

  useEffect(() => {
    if (profileQueue.length > 0) saveQueueToStorage(profileQueue);
  }, [profileQueue]);

  useEffect(() => {
    saveSwipedIdsToStorage(swipedIds);
  }, [swipedIds]);

  const { pan, panResponder } = useSwipe(async (direction) => {
    if (profileQueue.length === 0) return;

    const swipedProfile = profileQueue[0];
    setSwipedIds(prev => [...prev, swipedProfile.id]);
    setProfileQueue(prev => prev.slice(1));

    if (profileQueue.length <= 3) {
      setLoading(true);
      const user = auth.currentUser;
      const { profiles: moreProfiles, updatedCache } = await fetchAndMatchProfiles(
        user,
        [...swipedIds, swipedProfile.id],
        cachedJobAds.current
      );
      cachedJobAds.current = updatedCache;

      const filtered = moreProfiles.filter(p => !profileQueue.some(q => q.id === p.id));
      setProfileQueue(prev => [...prev, ...filtered]);
      allProfiles.current = [...allProfiles.current, ...filtered];
      setLoading(false);
    }
  });

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
