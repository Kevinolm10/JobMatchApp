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
import { registerUser, AuthError } from '../frontend/services/firebaseAuth';

type SignUpScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignUpScreen'>;

const { width, height } = Dimensions.get('window');

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

const SignUpScreen: React.FC = () => {
  const navigation = useNavigation<SignUpScreenNavigationProp>();

  // Enhanced state management
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Input refs for better UX
  const firstNameRef = useRef<TextInput>(null as unknown as TextInput);
  const lastNameRef = useRef<TextInput>(null as unknown as TextInput);
  const emailRef = useRef<TextInput>(null as unknown as TextInput);
  const passwordRef = useRef<TextInput>(null as unknown as TextInput);
  const confirmPasswordRef = useRef<TextInput>(null as unknown as TextInput);

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
    const fieldsToCheck = [firstName, lastName, email, password, confirmPassword];
    if (fieldsToCheck.some(field => field.length > 0) && Object.keys(errors).length > 0) {
      setErrors({});
    }
  }, [firstName, lastName, email, password, confirmPassword, errors]);

  // Password strength calculation
  useEffect(() => {
    const calculateStrength = (pwd: string): number => {
      let strength = 0;
      if (pwd.length >= 8) strength += 1;
      if (/[A-Z]/.test(pwd)) strength += 1;
      if (/[a-z]/.test(pwd)) strength += 1;
      if (/[0-9]/.test(pwd)) strength += 1;
      if (/[^A-Za-z0-9]/.test(pwd)) strength += 1;
      return strength;
    };

    setPasswordStrength(calculateStrength(password));
  }, [password]);

  // Enhanced form validation
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Name validation
    if (!firstName.trim()) {
      newErrors.firstName = 'Förnamn krävs';
    } else if (firstName.trim().length < 2) {
      newErrors.firstName = 'Förnamn måste vara minst 2 tecken';
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Efternamn krävs';
    } else if (lastName.trim().length < 2) {
      newErrors.lastName = 'Efternamn måste vara minst 2 tecken';
    }

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
    } else if (password.length < 8) {
      newErrors.password = 'Lösenordet måste vara minst 8 tecken';
    } else if (passwordStrength < 3) {
      newErrors.password = 'Lösenordet är för svagt. Använd stora/små bokstäver, siffror och symboler.';
    }

    // Confirm password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Bekräfta lösenord krävs';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Lösenorden matchar inte';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [firstName, lastName, email, password, confirmPassword, passwordStrength]);

  // Shake animation for errors
  const triggerShakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // Enhanced sign up handler
  const handleSignUp = useCallback(async () => {
    if (loading) return;

    // Clear previous general errors
    setErrors(prev => ({ ...prev, general: undefined }));

    // Validate form
    if (!validateForm()) {
      triggerShakeAnimation();
      return;
    }

    setLoading(true);

    try {
      console.log('📝 Attempting registration:', email.trim());

      const result = await registerUser(
        email.trim(),
        password,
        firstName.trim(),
        lastName.trim(),
        'regular'
      );

      console.log('✅ Registration successful:', result.user.email);

      // Show success message
      Alert.alert(
        'Registrering lyckades!',
        'Ditt konto har skapats. Du kommer nu att dirigeras till nästa steg.',
        [
          {
            text: 'Fortsätt',
            onPress: () => {
              navigation.navigate('SignUpCardScreen', { userId: result.user.uid });
            },
          },
        ]
      );

    } catch (error: any) {
      console.error('❌ Registration error:', error);

      let errorMessage = 'Ett oväntat fel inträffade. Försök igen.';

      if (error instanceof AuthError) {
        // Map Firebase errors to Swedish
        const errorMap: { [key: string]: string } = {
          'auth/email-already-in-use': 'Denna e-postadress används redan av ett annat konto.',
          'auth/weak-password': 'Lösenordet är för svagt. Välj ett starkare lösenord.',
          'auth/invalid-email': 'Ogiltig e-postadress.',
          'auth/operation-not-allowed': 'Kontoregistrering är inte aktiverat.',
          'auth/network-request-failed': 'Nätverksfel. Kontrollera din internetanslutning.',
        };

        errorMessage = errorMap[error.code] || error.message;
      }

      setErrors({ general: errorMessage });
      triggerShakeAnimation();
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    validateForm,
    triggerShakeAnimation,
    email,
    password,
    firstName,
    lastName,
    navigation,
  ]);

  // Enhanced input component
  const EnhancedInput = useCallback(({
    placeholder,
    value,
    onChangeText,
    secureTextEntry = false,
    keyboardType = 'default',
    autoCapitalize = 'words',
    error,
    inputRef,
    onSubmitEditing,
    icon,
    showToggle = false,
    showPassword: showPwd = false,
    onTogglePassword,
  }: {
    placeholder: string;
    value: string;
    onChangeText: (text: string) => void;
    secureTextEntry?: boolean;
    keyboardType?: any;
    autoCapitalize?: any;
    error?: string;
    inputRef?: React.RefObject<TextInput>;
    onSubmitEditing?: () => void;
    icon: string;
    showToggle?: boolean;
    showPassword?: boolean;
    onTogglePassword?: () => void;
  }) => (
    <Animated.View style={[
      styles.inputContainer,
      error && styles.inputContainerError,
      { transform: [{ translateX: shakeAnim }] }
    ]}>
      <View style={[styles.inputWrapper, error && styles.inputWrapperError]}>
        <Icon name={icon} size={20} color={error ? '#e74c3c' : '#666'} style={styles.inputIcon} />
        <TextInput
          ref={inputRef}
          style={[styles.input, error && styles.inputError]}
          placeholder={placeholder}
          placeholderTextColor={error ? '#e74c3c' : '#999'}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !showPwd}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={showToggle ? 'done' : 'next'}
          editable={!loading}
        />
        {showToggle && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={onTogglePassword}
            disabled={loading}
          >
            <Icon
              name={showPwd ? 'visibility-off' : 'visibility'}
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
  ), [shakeAnim, loading]);

  // Password strength indicator
  const PasswordStrengthIndicator = useCallback(() => {
    const getStrengthColor = () => {
      if (passwordStrength < 2) return '#e74c3c';
      if (passwordStrength < 4) return '#f39c12';
      return '#27ae60';
    };

    const getStrengthText = () => {
      if (passwordStrength < 2) return 'Svagt';
      if (passwordStrength < 4) return 'Medel';
      return 'Starkt';
    };

    if (!password) return null;

    return (
      <View style={styles.strengthContainer}>
        <View style={styles.strengthBar}>
          {[1, 2, 3, 4, 5].map(level => (
            <View
              key={level}
              style={[
                styles.strengthSegment,
                {
                  backgroundColor: level <= passwordStrength ? getStrengthColor() : '#e0e0e0',
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.strengthText, { color: getStrengthColor() }]}>
          Lösenordsstyrka: {getStrengthText()}
        </Text>
      </View>
    );
  }, [password, passwordStrength]);

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
              <Icon name="person-add" size={48} color="#fff" style={styles.titleIcon} />
              <Text style={styles.title}>Skapa ditt konto</Text>
              <Text style={styles.subtitle}>Fyll i dina uppgifter för att komma igång</Text>
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
                placeholder="Förnamn"
                value={firstName}
                onChangeText={setFirstName}
                error={errors.firstName}
                inputRef={firstNameRef}
                onSubmitEditing={() => lastNameRef.current?.focus()}
                icon="person"
              />

              <EnhancedInput
                placeholder="Efternamn"
                value={lastName}
                onChangeText={setLastName}
                error={errors.lastName}
                inputRef={lastNameRef}
                onSubmitEditing={() => emailRef.current?.focus()}
                icon="person"
              />

              <EnhancedInput
                placeholder="E-postadress"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
                inputRef={emailRef}
                onSubmitEditing={() => passwordRef.current?.focus()}
                icon="email"
              />

              <EnhancedInput
                placeholder="Lösenord"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                error={errors.password}
                inputRef={passwordRef}
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                icon="lock"
                showToggle
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
              />

              <PasswordStrengthIndicator />

              <EnhancedInput
                placeholder="Bekräfta lösenord"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                error={errors.confirmPassword}
                inputRef={confirmPasswordRef}
                onSubmitEditing={handleSignUp}
                icon="lock"
                showToggle
                showPassword={showConfirmPassword}
                onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
              />

              {/* Terms and Privacy */}
              <View style={styles.termsContainer}>
                <Text style={styles.termsText}>
                  Genom att registrera dig godkänner du våra{' '}
                  <Text style={styles.termsLink}>Användarvillkor</Text>
                  {' '}och{' '}
                  <Text style={styles.termsLink}>Integritetspolicy</Text>
                </Text>
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity
                style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
                onPress={handleSignUp}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="person-add" size={20} color="#fff" />
                    <Text style={styles.signUpButtonText}>Registrera dig nu</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Sign In Link */}
              <View style={styles.signInContainer}>
                <Text style={styles.signInText}>Har du redan ett konto? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('SignInScreen')}
                  disabled={loading}
                >
                  <Text style={styles.signInLink}>Logga in här</Text>
                </TouchableOpacity>
              </View>
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
    paddingVertical: 20,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 32,
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
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
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
  inputWrapperError: {
    borderColor: '#e74c3c',
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
    color: '#e74c3c',
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
  strengthContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  strengthBar: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 4,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '500',
  },
  termsContainer: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  termsText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    opacity: 0.9,
  },
  termsLink: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  signUpButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  signInLink: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default SignUpScreen;