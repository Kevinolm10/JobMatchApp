import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "../types";
import { StackNavigationProp } from "@react-navigation/stack";
import { auth, db } from '../firebaseAuth';  // Import auth and db from firebaseConfig
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { StatusBar } from 'expo-status-bar'; // To control status bar

type SignUpScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignUpScreen'>;

const { width, height } = Dimensions.get('window');

const SignUpScreen: React.FC = () => {
  const navigation = useNavigation<SignUpScreenNavigationProp>();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Handle Sign Up using Firebase
  const handleSignUp = async () => {
    try {
      // Step 1: Create a user using Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Step 2: Save additional user details to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        firstName,
        lastName,
        email,
      });

      // Step 3: Navigate to the next screen
      navigation.navigate('SignUpCardScreen', { userId: user.uid });
    } catch (error) {
      Alert.alert('Error', (error as any).message);
    }
  };

  return (
    <View style={styles.container}>
      {/* StatusBar Styling */}
      <StatusBar style="light" />

      {/* Background */}
      <View style={styles.backgroundOverlay} />

      {/* Sign Up Form */}
      <View style={styles.content}>
        <Text style={styles.title}>Registrera dig!</Text>

        <TextInput
          style={styles.input}
          placeholder="Förnamn"
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          value={firstName}
          onChangeText={(text) => setFirstName(text)}
        />

        <TextInput
          style={styles.input}
          placeholder="Efternamn"
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          value={lastName}
          onChangeText={(text) => setLastName(text)}
        /> 

        <TextInput
          style={styles.input}
          placeholder="Mail Adress"
          placeholderTextColor="#aaa"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(text) => setEmail(text)}
        />

        <TextInput
          style={styles.input}
          placeholder="Lösenord"
          placeholderTextColor="#aaa"
          secureTextEntry
          value={password}
          onChangeText={(text) => setPassword(text)}
        />

        <TouchableOpacity style={styles.button} onPress={handleSignUp}>
          <Text style={styles.buttonText}>Registrera dig nu</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Gå tillbaka</Text>
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

export default SignUpScreen;
