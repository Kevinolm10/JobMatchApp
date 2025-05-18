import React from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Dimensions, SafeAreaView, Image } from 'react-native';
const google = require('../frontend/assets/images/google.png');
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { StackNavigationProp } from '@react-navigation/stack';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseAuth';
import { Video, ResizeMode } from 'expo-av';
import { useGoogleAuth } from '../frontend/components/useGoogleAuth';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HomeScreen'>;

const { width, height } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { promptAsync } = useGoogleAuth();

  const testUser = {
    email: 'test3@gmail.com',
    password: 'Hammarby10'
  };

  const handleDevSignIn = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, testUser.email, testUser.password);
      navigation.navigate('MainSwipe', { userId: userCredential.user.uid });
    } catch (error) {
      console.error("Error signing in:", error);
      Alert.alert("Sign-In Failed", "Please check your credentials and try again.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Video
        source={require('../frontend/assets/videos/work.mp4')}
        style={styles.backgroundVideo}
        shouldPlay
        isMuted
        isLooping
        resizeMode={ResizeMode.COVER}
      />
      <View style={styles.overlay} />

      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Job-Finder</Text>

        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('SignInScreen')}>
          <Text style={styles.buttonText}>Logga in</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('SignUpScreen')}>
          <Text style={styles.buttonText}>Registrera dig</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleDevSignIn}>
          <Text style={styles.buttonText}>Dev Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('BusinessSignIn')}>
          <Text style={styles.buttonText}>Företagsinlogg</Text>
        </TouchableOpacity>

        {/* Google Sign-In Button */}
        <TouchableOpacity style={styles.googleButton} onPress={() => promptAsync()}>
          <Image source={google} style={styles.googleIcon} />
          <Text style={styles.googleButtonText}>Sign in with Google</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundVideo: { position: 'absolute', top: 0, left: 0, width, height },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    zIndex: -1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 50,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 10,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  button: {
    backgroundColor: '#8456ad',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginVertical: 8,
    width: '85%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 20,
    width: '85%',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    color: '#444',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;
