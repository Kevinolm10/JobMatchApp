import React, { useState, useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, Alert, ActivityIndicator, TouchableWithoutFeedback } from "react-native";
import Swiper from "react-native-deck-swiper";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { matchProfiles } from "../frontend/components/SwipeAlgorithm"; 
import { fetchLocationName } from "../frontend/components/Location"; 
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../types'; 
import { StackNavigationProp } from '@react-navigation/stack';
import { mapJobAdsToProfiles } from "../mapJobAdsToProfiles";  // Import the mapping function
import getJobAds, { JobAdProfile } from "../fetchJobAds"; // Import the job ad fetching function


type MainSwipeNavigationProp = StackNavigationProp<RootStackParamList, 'MainSwipe'>;

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
  const cachedJobAds = useRef<JobAdProfile[] | null>(null);  // Cache for job ads

  // Fetch user profiles from Firestore and combine them with job ad profiles
  const fetchProfiles = async () => {
    try {
      const user = getAuth().currentUser;
      if (!user) {
        console.warn("No authenticated user");
        return;
      }

      // Fetch user profiles from Firestore
      const usersCollection = collection(db, "users");
      const profileSnapshot = await getDocs(usersCollection);
      console.log("Users fetched:", profileSnapshot.docs.length);

      let firestoreProfiles = profileSnapshot.docs.map((doc) => doc.data() as Profile);

      // Find the current user profile
      const userProfileDoc = profileSnapshot.docs.find((doc) => doc.data().email === user.email);
      if (!userProfileDoc) {
        console.warn("No user profile found for current user");
        return;
      }

      const userProfile = userProfileDoc.data() as Profile;

      // Fetch job ads (cache if available)
      let jobAds: JobAdProfile[] = [];
      if (cachedJobAds.current) {
        console.log("Using cached job ads");
        jobAds = cachedJobAds.current;
      } else {
        jobAds = await getJobAds(userProfile.skills);  // Fetch job ads based on user's skills
        cachedJobAds.current = jobAds;  // Cache job ads for later use
      }

      // Map job ads to profiles
      const jobProfiles = mapJobAdsToProfiles(jobAds);
      console.log("Mapped job profiles:", jobProfiles?.length);

      // Combine Firestore profiles and job profiles
      const combinedProfiles = [...firestoreProfiles, ...jobProfiles];

      // Fetch location names for profiles
      await Promise.all(
        combinedProfiles.map(async (profile) => {
          if (profile.location && typeof profile.location !== "string") {
            const locationName = await fetchLocationName(profile.location.latitude, profile.location.longitude);
            (profile as any).locationName = locationName;  // Store location name in profile
          }
        })
      );

      // Match profiles based on user profile
      const matchedProfiles = matchProfiles(userProfile, combinedProfiles);
      console.log("Matched profiles:", matchedProfiles?.length);

      setProfiles(matchedProfiles);
    } catch (error) {
      console.error("Error fetching profiles: ", error);
      Alert.alert("Error", "Unable to fetch profiles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchProfiles();
    };
    fetchData();
    console.log("Fetching profiles from Firestore...");
  }, []);

  useEffect(() => {
    console.log("Profiles state updated:", profiles);
  }, [profiles]);

  const handleSwipeLeft = () => {
    console.log("Profile rejected!");
    setCurrentIndex((prevIndex) => prevIndex + 1);
  };

  const handleSwipeRight = () => {
    console.log("Profile accepted!");
    setCurrentIndex((prevIndex) => prevIndex + 1);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Begränsa swipe-området */}
      <TouchableWithoutFeedback>
        <View style={styles.swipeContainer}>
          <Swiper
            cards={profiles}
            renderCard={(card) =>
              card ? (
                <View style={styles.card}>
                  <Image source={{ uri: card.image }} style={styles.profileImage} />
                  <View style={styles.cardInfo}>
                    <Text style={styles.name}>{card.firstName} {card.lastName}</Text>
                    <Text style={styles.email}>{card.email}</Text>
                    <Text style={styles.experience}>
                      Experience: {typeof card.experience === "string" ? card.experience : "Not specified"}
                    </Text>
                    <Text style={styles.skills}>
                      Skills: {card.skills || "N/A"}
                    </Text>
                    <Text style={styles.location}>
                      Location: {typeof card.location === "string" ? card.location : "Unknown"}
                    </Text>

                    <Text style={styles.phone}>Phone: {card.phoneNumber || "N/A"}</Text>
                    <Text style={styles.workCommitment}>
                      Work Commitment: {card.workCommitment || "N/A"}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.noMoreCards}>
                  <Text>No more profiles</Text>
                </View>
              )
            }
            onSwipedLeft={handleSwipeLeft}
            onSwipedRight={handleSwipeRight}
            cardIndex={currentIndex}
            backgroundColor="#f1f1f1"
            stackSize={3}
            overlayLabels={{
              left: {
                title: "AVSTÅ",
                style: { label: { backgroundColor: "red", color: "white", fontSize: 18, fontWeight: "bold" } },
              },
              right: {
                title: "ACCEPTERA",
                style: { label: { backgroundColor: "green", color: "white", fontSize: 18, fontWeight: "bold" } },
              },
            }}
            verticalSwipe={false}
            horizontalSwipe={true}
            animateOverlayLabelsOpacity
            animateCardOpacity
            disableBottomSwipe
            disableTopSwipe
            horizontalThreshold={120}
          />
        </View>
      </TouchableWithoutFeedback>

      {/* Bottom Menu Bar */}
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  swipeContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  // Swiper Card Styles
  card: {
    flex: 0.8,
    justifyContent: "flex-start",
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#fff",
    elevation: 5,
    margin: 10,
    padding: 0.3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden', // Ensure content inside doesn't overflow the card bounds
  },
  profileImage: {
    width: '100%',
    height: '50%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  cardInfo: {
    flex: 1,
    alignItems: "flex-start",
    padding: 20,
    width: '100%',
    justifyContent: 'flex-start', // Ensures content starts from top
    backgroundColor: '#f9f9f9', // Adds a slightly lighter background color for the text area
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 5,
    color: '#333', // Darker text for better readability
  },
  email: {
    fontSize: 16,
    color: "#888",
    marginBottom: 5,
  },
  skills: {
    fontSize: 16,
    marginBottom: 5,
    color: '#555', // Slightly darker text for better readability
  },
  experience: {
    fontSize: 16,
    marginBottom: 5,
    color: '#555',
  },
  location: {
    fontSize: 14,
    color: "#888",
    marginBottom: 5,
  },
  phone: {
    fontSize: 14,
    marginBottom: 5,
  },
  workCommitment: {
    fontSize: 14,
    marginBottom: 5,
  },
  noMoreCards: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    elevation: 5,
    margin: 10,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  // Adjusted Bottom Menu Styles
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
    color: 'black',
  },
  menuText: {
    fontSize: 16,
    color: 'black'
  }
});



export default MainSwipe;