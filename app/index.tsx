import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Image,
  ActivityIndicator,
  StatusBar,
  Animated,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useGoogleAuth } from '../frontend/components/useGoogleAuth';
import { signInWithEmailAndPassword, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../frontend/services/firebaseConfig';

const google = require('../frontend/assets/images/google.png');

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HomeScreen'>;

const { width, height } = Dimensions.get('window');

// Development test user
const DEV_USER = {
  email: 'test3@gmail.com',
  password: 'Hammarby10',
};

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { promptAsync } = useGoogleAuth();

  // Enhanced state management
  const [signingIn, setSigningIn] = useState<string | null>(null); // Track which button is loading
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showVideo, setShowVideo] = useState<boolean>(true);

  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        // Auto-navigate if user is already logged in
        navigation.navigate('MainSwipe', { userId: user.uid });
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Enhanced dev sign in with better error handling
  const handleDevSignIn = useCallback(async () => {
    if (signingIn) return; // Prevent multiple calls

    setSigningIn('dev');
    try {
      console.log('🔐 Dev sign in with:', DEV_USER.email);

      const userCredential = await signInWithEmailAndPassword(
        auth,
        DEV_USER.email,
        DEV_USER.password
      );

      console.log('✅ Dev sign in successful');
      navigation.navigate('MainSwipe', { userId: userCredential.user.uid });

    } catch (error: any) {
      console.error('❌ Dev sign in error:', error);

      const errorMessages: { [key: string]: string } = {
        'auth/user-not-found': 'Test user not found. Please contact developer.',
        'auth/wrong-password': 'Invalid test credentials.',
        'auth/network-request-failed': 'Network error. Check your connection.',
        'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
      };

      const message = errorMessages[error.code] || error.message || 'Development sign-in failed.';

      Alert.alert(
        'Dev Sign-In Failed',
        message,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setSigningIn(null);
    }
  }, [navigation, signingIn]);

  // Enhanced Google sign in
  const handleGoogleSignIn = useCallback(async () => {
    if (signingIn) return;

    setSigningIn('google');
    try {
      console.log('🔐 Starting Google sign in...');
      await promptAsync();
    } catch (error: any) {
      console.error('❌ Google sign in error:', error);
      Alert.alert(
        'Google Sign-In Failed',
        'Unable to sign in with Google. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setSigningIn(null);
    }
  }, [promptAsync, signingIn]);

  // Enhanced navigation handlers
  const handleNavigate = useCallback((screen: keyof RootStackParamList) => {
    if (signingIn) return; // Prevent navigation during sign in
    navigation.navigate(screen as any);
  }, [navigation, signingIn]);

  // Enhanced button component
  const AnimatedButton = useCallback(({
    title,
    onPress,
    loading,
    style,
    textStyle,
    icon,
    variant = 'primary'
  }: {
    title: string;
    onPress: () => void;
    loading?: boolean;
    style?: any;
    textStyle?: any;
    icon?: string;
    variant?: 'primary' | 'secondary' | 'google';
  }) => (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'google' && styles.googleButton,
        variant === 'secondary' && styles.secondaryButton,
        loading && styles.buttonDisabled,
        style
      ]}
      onPress={onPress}
      disabled={loading || !!signingIn}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'google' ? '#444' : '#fff'} />
      ) : (
        <View style={styles.buttonContent}>
          {icon && variant === 'google' && (
            <Image source={google} style={styles.googleIcon} />
          )}
          {icon && variant !== 'google' && (
            <Icon name={icon} size={20} color="#fff" style={styles.buttonIcon} />
          )}
          <Text style={[
            styles.buttonText,
            variant === 'google' && styles.googleButtonText,
            variant === 'secondary' && styles.secondaryButtonText,
            textStyle
          ]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  ), [signingIn]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background Video */}
      {showVideo && (
        <Video
          source={require('../frontend/assets/videos/work.mp4')}
          style={styles.backgroundVideo}
          shouldPlay
          isMuted
          isLooping
          resizeMode={ResizeMode.COVER}
          onError={(error) => {
            console.warn('Video error:', error);
            setShowVideo(false);
          }}
        />
      )}

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['rgba(132, 86, 173, 0.4)', 'rgba(0, 0, 0, 0.6)', 'rgba(132, 86, 173, 0.8)']}
        style={styles.overlay}
      />

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {/* Logo/Title Section */}
        <View style={styles.titleContainer}>
          <Icon name="work" size={48} color="#fff" style={styles.logoIcon} />
          <Text style={styles.title}>Job-Finder</Text>
          <Text style={styles.subtitle}>
            Hitta ditt drömjobb med vår intelligenta matchningsteknik
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <AnimatedButton
            title="Logga in"
            onPress={() => handleNavigate('SignInScreen')}
            icon="login"
          />

          <AnimatedButton
            title="Registrera dig"
            onPress={() => handleNavigate('SignUpScreen')}
            icon="person-add"
            variant="secondary"
          />

          <AnimatedButton
            title="Företagsinlogg"
            onPress={() => handleNavigate('BusinessSignIn')}
            icon="business"
          />

          {/* Google Sign-In */}
          <AnimatedButton
            title="Fortsätt med Google"
            onPress={handleGoogleSignIn}
            loading={signingIn === 'google'}
            variant="google"
            icon="google"
          />

          {/* Development Button - Only show in dev mode */}
          {__DEV__ && (
            <AnimatedButton
              title="Dev Sign In"
              onPress={handleDevSignIn}
              loading={signingIn === 'dev'}
              style={styles.devButton}
              textStyle={styles.devButtonText}
            />
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Genom att fortsätta godkänner du våra{' '}
            <Text style={styles.linkText}>Användarvillkor</Text>
            {' '}och{' '}
            <Text style={styles.linkText}>Integritetspolicy</Text>
          </Text>
        </View>
      </Animated.View>

      {/* Current User Indicator (for debugging) */}
      {__DEV__ && currentUser && (
        <View style={styles.userIndicator}>
          <Text style={styles.userIndicatorText}>
            Logged in: {currentUser.email}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8456ad',
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height: height + 50, // Add extra height to cover notch
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: height + 50, // Add extra height to cover notch
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  logoIcon: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 24,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonContainer: {
    alignItems: 'center',
    gap: 12,
  },
  button: {
    backgroundColor: '#8456ad',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    width: '90%',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  googleButton: {
    backgroundColor: '#fff',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginTop: 8,
  },
  devButton: {
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    borderColor: 'rgba(255, 193, 7, 0.5)',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#fff',
  },
  googleButtonText: {
    color: '#444',
  },
  devButtonText: {
    color: '#000',
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.8,
  },
  linkText: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  userIndicator: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
  },
  userIndicatorText: {
    color: '#fff',
    fontSize: 10,
  },
});

export default HomeScreen;