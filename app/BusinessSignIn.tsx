import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { signInBusinessUser, AuthError } from '../frontend/services/firebaseAuth';

type BusinessSignInNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessSignIn'>;

const { width, height } = Dimensions.get('window');

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export const BusinessSignIn: React.FC = () => {
  const navigation = useNavigation<BusinessSignInNavigationProp>();

  // Enhanced state management
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [attemptCount, setAttemptCount] = useState(0);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Input refs for better UX
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Clear errors when user starts typing
  useEffect(() => {
    if (errors.email || errors.password) {
      setErrors(prev => ({
        ...prev,
        email: undefined,
        password: undefined,
      }));
    }
  }, [email, password]);

  // Enhanced input validation
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'E-postadress krävs';
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Ogiltig e-postadress';
    }

    // Password validation
    if (!password) {
      newErrors.password = 'Lösenord krävs';
    } else if (password.length < 6) {
      newErrors.password = 'Lösenordet måste vara minst 6 tecken';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password]);

  // Shake animation for errors
  const triggerShakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // Enhanced business sign in handler
  const handleSignIn = useCallback(async () => {
    if (loading) return;

    // Clear previous general errors
    setErrors(prev => ({ ...prev, general: undefined }));

    // Validate form
    if (!validateForm()) {
      triggerShakeAnimation();
      return;
    }

    setLoading(true);
    setAttemptCount(prev => prev + 1);

    try {
      console.log('🏢 Attempting business sign in:', email.trim());

      const result = await signInBusinessUser(email.trim(), password);
      console.log('✅ Business sign in successful:', result.user.email);

      // Navigate to MainSwipe
      navigation.navigate('MainSwipe', { userId: result.user.uid });

    } catch (error: any) {
      console.error('❌ Business sign in error:', error);

      let errorMessage = 'Ett oväntat fel inträffade. Försök igen.';
      let alertTitle = 'Inloggning misslyckades';

      if (error instanceof AuthError) {
        // Map Firebase errors to Swedish with business-specific messages
        const errorMap: { [key: string]: { message: string; title: string } } = {
          'auth/user-not-found': {
            message: 'Ingen användare hittades med denna e-postadress.',
            title: 'Användare ej hittad'
          },
          'auth/wrong-password': {
            message: 'Felaktigt lösenord. Försök igen.',
            title: 'Felaktigt lösenord'
          },
          'auth/invalid-email': {
            message: 'Ogiltig e-postadress.',
            title: 'Ogiltig e-post'
          },
          'auth/user-disabled': {
            message: 'Detta företagskonto har inaktiverats. Kontakta support.',
            title: 'Konto inaktiverat'
          },
          'auth/too-many-requests': {
            message: 'För många misslyckade försök. Vänta och försök igen.',
            title: 'För många försök'
          },
          'auth/network-request-failed': {
            message: 'Nätverksfel. Kontrollera din internetanslutning.',
            title: 'Nätverksfel'
          },
          'unauthorized-business-user': {
            message: 'Detta konto är inte registrerat som ett företagskonto. Kontakta administratören eller använd vanlig inloggning.',
            title: 'Ej företagskonto'
          },
        };

        const errorInfo = errorMap[error.code] || {
          message: error.message,
          title: 'Inloggning misslyckades'
        };

        errorMessage = errorInfo.message;
        alertTitle = errorInfo.title;
      }

      setErrors({ general: errorMessage });
      triggerShakeAnimation();

      // Show specific alert for business authorization errors
      if (error.code === 'unauthorized-business-user') {
        Alert.alert(
          alertTitle,
          `${errorMessage}\n\nVill du logga in som vanlig användare istället?`,
          [
            { text: 'Avbryt', style: 'cancel' },
            {
              text: 'Vanlig inloggning',
              onPress: () => navigation.navigate('SignInScreen'),
            },
            {
              text: 'Kontakta support',
              onPress: () => {
                Alert.alert(
                  'Kontakta support',
                  'E-post: support@jobfinder.se\nTelefon: 08-123 456 78',
                  [{ text: 'OK', style: 'default' }]
                );
              },
            },
          ]
        );
      } else if (attemptCount >= 2) {
        // Show help options after repeated failures
        Alert.alert(
          alertTitle,
          `${errorMessage}\n\nBehöver du hjälp?`,
          [
            { text: 'Försök igen', style: 'cancel' },
            {
              text: 'Glömt lösenord',
              onPress: () => {
                Alert.alert('Info', 'Funktionen för återställning av lösenord kommer snart.');
              },
            },
            {
              text: 'Kontakta support',
              onPress: () => {
                Alert.alert(
                  'Kontakta support',
                  'För företagskonton:\nE-post: business@jobfinder.se\nTelefon: 08-123 456 78',
                  [{ text: 'OK', style: 'default' }]
                );
              },
            },
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, loading, validateForm, triggerShakeAnimation, attemptCount, navigation]);

  // Enhanced input component
  const EnhancedInput = useCallback(({
    placeholder,
    value,
    onChangeText,
    secureTextEntry = false,
    keyboardType = 'default',
    autoCapitalize = 'none',
    error,
    inputRef,
    onSubmitEditing,
    icon,
  }: {
    placeholder: string;
    value: string;
    onChangeText: (text: string) => void;
    secureTextEntry?: boolean;
    keyboardType?: any;
    autoCapitalize?: any;
    error?: string;
    inputRef?: React.RefObject<TextInput | null>;
    onSubmitEditing?: () => void;
    icon: string;
  }) => (
    <Animated.View style={[
      styles.inputContainer,
      error && styles.inputContainerError,
      { transform: [{ translateX: shakeAnim }] }
    ]}>
      <View style={styles.inputWrapper}>
        <Icon name={icon} size={20} color={error ? '#e74c3c' : '#666'} style={styles.inputIcon} />
        <TextInput
          ref={inputRef}
          style={[styles.input, error && styles.inputError]}
          placeholder={placeholder}
          placeholderTextColor={error ? '#e74c3c' : '#999'}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={secureTextEntry ? 'done' : 'next'}
          editable={!loading}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
            disabled={loading}
          >
            <Icon
              name={showPassword ? 'visibility-off' : 'visibility'}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={styles.errorText}>
          <Icon name="error" size={12} color="#e74c3c" /> {error}
        </Text>
      )}
    </Animated.View>
  ), [shakeAnim, showPassword, loading]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#8456ad" />

      {/* Background */}
      <View style={styles.backgroundOverlay} />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Title Section */}
            <View style={styles.titleContainer}>
              <Icon name="business" size={48} color="#fff" style={styles.titleIcon} />
              <Text style={styles.title}>Företagsinloggning</Text>
              <Text style={styles.subtitle}>
                Logga in med ditt företagskonto för att komma åt företagsfunktioner
              </Text>
            </View>

            {/* Business Info Section */}
            <View style={styles.infoContainer}>
              <View style={styles.infoItem}>
                <Icon name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.infoText}>Tillgång till kandidatprofiler</Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.infoText}>Hantera jobbannonser</Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.infoText}>Avancerad matchning</Text>
              </View>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* General Error */}
              {errors.general && (
                <View style={styles.generalErrorContainer}>
                  <Icon name="error" size={20} color="#e74c3c" />
                  <Text style={styles.generalErrorText}>{errors.general}</Text>
                </View>
              )}

              <EnhancedInput
                placeholder="Företags e-postadress"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                error={errors.email}
                inputRef={emailRef}
                onSubmitEditing={() => passwordRef.current?.focus()}
                icon="business"
              />

              <EnhancedInput
                placeholder="Lösenord"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                error={errors.password}
                inputRef={passwordRef}
                onSubmitEditing={handleSignIn}
                icon="lock"
              />

              {/* Forgot Password Link */}
              <TouchableOpacity
                style={styles.forgotPasswordButton}
                onPress={() => {
                  Alert.alert(
                    'Återställ lösenord',
                    'För företagskonton, kontakta vår support:\n\nE-post: business@jobfinder.se\nTelefon: 08-123 456 78',
                    [{ text: 'OK', style: 'default' }]
                  );
                }}
                disabled={loading}
              >
                <Text style={styles.forgotPasswordText}>Glömt lösenord?</Text>
              </TouchableOpacity>

              {/* Sign In Button */}
              <TouchableOpacity
                style={[styles.signInButton, loading && styles.signInButtonDisabled]}
                onPress={handleSignIn}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="business" size={20} color="#fff" />
                    <Text style={styles.signInButtonText}>Logga in som företag</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Regular Sign In Link */}
              <View style={styles.regularSignInContainer}>
                <Text style={styles.regularSignInText}>Inte ett företag? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('SignInScreen')}
                  disabled={loading}
                >
                  <Text style={styles.regularSignInLink}>Vanlig inloggning</Text>
                </TouchableOpacity>
              </View>

              {/* Support Link */}
              <TouchableOpacity
                style={styles.supportButton}
                onPress={() => {
                  Alert.alert(
                    'Företagssupport',
                    'Behöver du hjälp med ditt företagskonto?\n\nE-post: business@jobfinder.se\nTelefon: 08-123 456 78\n\nÖppettider: Mån-Fre 08:00-17:00',
                    [{ text: 'OK', style: 'default' }]
                  );
                }}
                disabled={loading}
              >
                <Icon name="support" size={16} color="#fff" />
                <Text style={styles.supportButtonText}>Kontakta företagssupport</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8456ad',
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#8456ad',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  titleIcon: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  infoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
    opacity: 0.9,
  },
  form: {
    width: '100%',
  },
  generalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  generalErrorText: {
    color: '#e74c3c',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputContainerError: {
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    height: '100%',
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 16,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    padding: 4,
  },
  forgotPasswordText: {
    color: '#fff',
    fontSize: 14,
    textDecorationLine: 'underline',
    opacity: 0.9,
  },
  signInButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  regularSignInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  regularSignInText: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  regularSignInLink: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  supportButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 6,
    opacity: 0.9,
  },
});

export default BusinessSignIn;