import React from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Dimensions, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { StackNavigationProp } from '@react-navigation/stack';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseAuth';
import { Video, ResizeMode } from 'expo-av';


type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HomeScreen'>;

const { width, height } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();

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
      {/* Video Background */}
<Video
  source={require('../frontend/assets/videos/work.mp4')} // byt till din video
  style={styles.backgroundVideo}
  shouldPlay
  isMuted
  isLooping
  resizeMode={ResizeMode.COVER}
/>



      {/* Overlay for better readability */}
      <View style={styles.overlay} />

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Job-Finder!</Text>

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
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#8456ad',
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

export default HomeScreen;
