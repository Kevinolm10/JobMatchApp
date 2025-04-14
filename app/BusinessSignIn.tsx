import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../types'; // Import the RootStackParamList
import { StackNavigationProp } from '@react-navigation/stack';
import { getFirestore, doc, getDoc } from 'firebase/firestore'; // Firestore imports
import { signInWithEmailAndPassword } from 'firebase/auth'; // Firebase Auth import
import { getAuth } from 'firebase/auth'; // Firebase Auth import
import { StatusBar } from 'expo-status-bar'; // For status bar control

type BusinessSignInNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessSignIn'>;

const { width, height } = Dimensions.get('window');

const BusinessSignIn: React.FC = () => {
  const navigation = useNavigation<BusinessSignInNavigationProp>();

  // State for email and password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Firebase instances
  const db = getFirestore();
  const auth = getAuth();

  const handleSignIn = async () => {
    try {
      // Sign in the user using Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Fetch the user from Firestore to check if they are a business user
      const userDocRef = doc(db, 'users', user.uid); // Assuming 'users' collection
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();

        // Check if the user is a business user
        if (userData?.role === 'business') {
          console.log('Business user logged in:', user);
          // Navigate to the business dashboard
          navigation.navigate('MainSwipe', { userId: user.uid });
        } else {
          Alert.alert('Access Denied', 'You are not a business user.');
        }
      } else {
        Alert.alert('Error', 'User data not found.');
      }
    } catch (error) {
      console.error('Error signing in:', error);
      Alert.alert('Sign-In Failed', 'Please check your credentials and try again.');
    }
  };

  return (
    <View style={styles.container}>
      {/* StatusBar Styling */}
      <StatusBar style="light" />

      {/* Background */}
      <View style={styles.backgroundOverlay} />

      {/* Sign-In Form */}
      <View style={styles.content}>
        <Text style={styles.title}>Business Sign-In</Text>

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#aaa"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(text) => setEmail(text)}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#aaa"
          secureTextEntry
          value={password}
          onChangeText={(text) => setPassword(text)}
        />

        <TouchableOpacity style={styles.button} onPress={handleSignIn}>
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative', // Allows for background overlay
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
    backgroundColor: '#8456ad', // Background color (you can replace it with an image if needed)
    zIndex: -1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 30, // Space from the top to avoid overlap with the status bar
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
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

export default BusinessSignIn;
