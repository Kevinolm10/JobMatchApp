// MainSwipe.tsx
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

export type MainSwipeNavigationProp = StackNavigationProp<RootStackParamList, 'MainSwipe'>;

export interface Profile {
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
}

const MainSwipe: React.FC = () => {
  const navigation = useNavigation<MainSwipeNavigationProp>();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const db = getFirestore();
  const auth = getAuth();
  const cachedJobAds = useRef<JobAdProfile[] | null>(null);

  const { pan, panResponder } = useSwipe(() => setCurrentIndex((prev) => prev + 1));

  const fetchProfiles = async () => {
    try {
      const user = getAuth().currentUser;
      if (!user) {
        console.warn("No authenticated user");
        return;
      }

      const usersCollection = collection(db, 'users');
      const profileSnapshot = await getDocs(usersCollection);
      const firestoreProfiles = profileSnapshot.docs.map((doc) => doc.data() as Profile);

      const userProfileDoc = profileSnapshot.docs.find((doc) => doc.data().email === user.email);
      if (!userProfileDoc) {
        console.warn("No user profile found for current user");
        return;
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

      await Promise.all(
        combinedProfiles.map(async (profile) => {
          if (profile.location && typeof profile.location !== "string") {
            const locationName = await fetchLocationName(profile.location.latitude, profile.location.longitude);
            (profile as any).locationName = locationName;
          }
        })
      );

      const matchedProfiles = matchProfiles(userProfile, combinedProfiles);
      setProfiles(matchedProfiles);
    } catch (error) {
      console.error("Error fetching profiles: ", error);
      Alert.alert("Error", "Unable to fetch profiles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  const currentProfile = profiles[currentIndex];

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
            <Text style={styles.email}>{currentProfile.email}</Text>
            <Text style={styles.experience}>Experience: {currentProfile.experience || "Not specified"}</Text>
            <Text style={styles.skills}>Skills: {currentProfile.skills || "N/A"}</Text>
            <Text style={styles.location}>Location: {(currentProfile as any).locationName || "Unknown"}</Text>
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
    position: 'absolute'
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
