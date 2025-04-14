import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { StackNavigationProp } from '@react-navigation/stack';
import { signInUser } from '../firebaseAuth'; // Import the Firebase sign-in function
import { StatusBar } from 'expo-status-bar'; // To control status bar

type SignInScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignInScreen'>;

const { width, height } = Dimensions.get('window');

const SignInScreen: React.FC = () => {
  const navigation = useNavigation<SignInScreenNavigationProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Handle Sign In using Firebase
  const handleSignIn = async () => {
    try {
      const user = await signInUser(email, password); // Sign in using Firebase
      console.log("User signed in:", user);

      // Navigate to MainSwipe with userId
      navigation.navigate('MainSwipe', { userId: user.uid });
    } catch (error) {
      console.error("Error signing in:", error);
      Alert.alert("Sign-In Failed", "Please check your credentials and try again.");
    }
  };

  return (
    <View style={styles.container}>
      {/* StatusBar Styling */}
      <StatusBar style="light" />

      {/* Background (for demonstration, use a background color or image) */}
      <View style={styles.backgroundOverlay} />

      {/* Sign In Form */}
      <View style={styles.content}>
        <Text style={styles.title}>Inloggning</Text>

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

        <TouchableOpacity style={styles.button} onPress={handleSignIn}>
          <Text style={styles.buttonText}>Logga in</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Gå tillbaka</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative', // Allows for overlay
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
    backgroundColor: '#8456ad',  // Background color, or you can use a background image here
    zIndex: -1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 30, // Add space from the top to avoid status bar overlap
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

export default SignInScreen;
