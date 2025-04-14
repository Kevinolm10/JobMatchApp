import React, { useState } from "react";
import { View, Text, TextInput, Button, TouchableOpacity, Image, StyleSheet, Alert, Dimensions } from "react-native";
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native"; 
import { RootStackParamList } from "../types"; 
import { StackNavigationProp } from "@react-navigation/stack";
import { StatusBar } from 'expo-status-bar';

type SignUpCardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignUpCardScreen'>;
type SignUpCardScreenRouteProp = RouteProp<RootStackParamList, 'SignUpCardScreen'>;

const { width, height } = Dimensions.get('window');

const SignUpCardScreen: React.FC = () => {
  const navigation = useNavigation<SignUpCardScreenNavigationProp>();
  const route = useRoute<SignUpCardScreenRouteProp>();
  const { userId } = route.params;

  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [workCommitment, setWorkCommitment] = useState<string>("");
  const [image, setImage] = useState<any>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationString, setLocationString] = useState<string>("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");

  const db = getFirestore();

  // Function to pick image from the device
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // Function to get the user's current location and reverse geocode it
  const getUserLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission to access location was denied');
      return;
    }
    let location = await Location.getCurrentPositionAsync({});
    setLocation(location.coords);

    const geocode = await Location.reverseGeocodeAsync(location.coords);
    if (geocode.length > 0) {
      const address = geocode[0];
      setLocationString(`${address.name}, ${address.city}, ${address.region}, ${address.country}`);
    } else {
      setLocationString('Unable to fetch location');
    }
  };

  // Handle saving additional data
  const handleFinish = async () => {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        phoneNumber,
        address,
        workCommitment,
        image,
        location,
        skills,
        experience,
      });

      navigation.navigate("MainSwipe", { userId });
    } catch (error) {
      Alert.alert("Error", (error as any).message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Background Overlay */}
      <View style={styles.backgroundOverlay} />

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Additional Information</Text>

        {/* Image Picker */}
        <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <Text style={styles.imagePickerText}>Pick an image</Text>
          )}
        </TouchableOpacity>

        {/* Work Commitment */}
        <Text style={styles.label}>How much do you want to work?</Text>
        <View style={styles.workCommitmentContainer}>
          {["25%", "50%", "75%", "100%"].map((commitment) => (
            <TouchableOpacity
              key={commitment}
              style={[styles.commitmentButton, workCommitment === commitment && styles.selectedCommitment]}
              onPress={() => setWorkCommitment(commitment)}
            >
              <Text style={styles.commitmentText}>{commitment}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Location */}
        <Button title="Get Location" onPress={getUserLocation} />
        {locationString && (
          <Text style={styles.locationText}>Location: {locationString}</Text>
        )}

        {/* Skills */}
        <TextInput
          style={styles.input}
          placeholder="Skills"
          placeholderTextColor="#aaa"
          value={skills}
          onChangeText={(text) => setSkills(text)}
        />

        {/* Experience */}
        <TextInput
          style={styles.input}
          placeholder="Experience"
          placeholderTextColor="#aaa"
          value={experience}
          onChangeText={(text) => setExperience(text)}
        />

        {/* Phone Number */}
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#aaa"
          value={phoneNumber}
          onChangeText={(text) => setPhoneNumber(text)}
        />

        {/* Address */}
        <TextInput
          style={styles.input}
          placeholder="Address"
          placeholderTextColor="#aaa"
          value={address}
          onChangeText={(text) => setAddress(text)}
        />

        {/* Finish Button */}
        <TouchableOpacity style={styles.button} onPress={handleFinish}>
          <Text style={styles.buttonText}>Finish</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
    backgroundColor: '#8456ad', // Or use a background image
    zIndex: -1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 30, 
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#fff',
  },
  imagePicker: {
    marginBottom: 20,
    width: 150,
    height: 150,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 75,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 75,
  },
  imagePickerText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  label: {
    fontSize: 18,
    marginBottom: 10,
    color: '#fff',
  },
  workCommitmentContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  commitmentButton: {
    padding: 10,
    margin: 5,
    borderWidth: 1,
    borderRadius: 5,
  },
  selectedCommitment: {
    backgroundColor: '#007BFF',
    borderColor: '#0056b3',
  },
  commitmentText: {
    color: '#000',
  },
  locationText: {
    marginTop: 10,
    fontSize: 16,
    color: '#fff',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#8456ad',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SignUpCardScreen;
