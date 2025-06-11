import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  User,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';

import { auth as defaultAuth, firestore, app } from './firebaseConfig';
import {
  query,
  collection,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  enableNetwork,
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus, Platform } from 'react-native';

// Initialize auth with proper persistence for Expo
let auth = defaultAuth;

// Enhanced interfaces for better type safety
interface AuthResult {
  user: User;
  isNewUser?: boolean;
  userType?: 'regular' | 'business';
}

interface UserProfile {
  email: string;
  firstName?: string;
  lastName?: string;
  userType: 'regular' | 'business';
  createdAt: any;
  lastLoginAt: any;
}

// Custom error class for better error handling
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// Network state manager
class NetworkManager {
  private static instance: NetworkManager;
  private isConnected: boolean = true;
  private listeners: ((isConnected: boolean) => void)[] = [];
  private appState: AppStateStatus = 'active';
  private retryTimeouts: Set<NodeJS.Timeout> = new Set();

  private constructor() {
    this.initializeNetworkMonitoring();
    this.initializeAppStateMonitoring();
  }

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  private initializeNetworkMonitoring() {
    NetInfo.addEventListener(state => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected ?? false;

      console.log('🌐 Network state changed:', {
        connected: this.isConnected,
        type: state.type,
        details: state.details
      });

      // Notify listeners
      this.listeners.forEach(listener => listener(this.isConnected));

      // Handle reconnection
      if (!wasConnected && this.isConnected && this.appState === 'active') {
        console.log('📡 Network reconnected, refreshing Firebase connection...');
        this.refreshFirebaseConnection();
      }
    });
  }

  private initializeAppStateMonitoring() {
    AppState.addEventListener('change', (nextAppState) => {
      const previousState = this.appState;
      this.appState = nextAppState;

      console.log('📱 App state changed:', { from: previousState, to: nextAppState });

      if (nextAppState === 'active' && previousState !== 'active') {
        console.log('🔄 App became active, refreshing connections...');
        this.handleAppBecameActive();
      } else if (nextAppState === 'background') {
        console.log('💤 App going to background...');
        this.handleAppGoingToBackground();
      }
    });
  }

  private async handleAppBecameActive() {
    // Clear any pending retry timeouts
    this.clearRetryTimeouts();

    // Check network status
    const netInfo = await NetInfo.fetch();
    this.isConnected = netInfo.isConnected ?? false;

    if (this.isConnected) {
      await this.refreshFirebaseConnection();
    }
  }

  private handleAppGoingToBackground() {
    // Clear any pending operations
    this.clearRetryTimeouts();
  }

  private clearRetryTimeouts() {
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }

  private async refreshFirebaseConnection() {
    try {
      // Re-enable Firestore network
      await enableNetwork(firestore);

      // Force auth token refresh if user is logged in
      const currentUser = auth.currentUser;
      if (currentUser) {
        await currentUser.reload();
        await currentUser.getIdToken(true);
        console.log('✅ Firebase connection refreshed');
      }
    } catch (error) {
      console.error('❌ Error refreshing Firebase connection:', error);
    }
  }

  async waitForConnection(timeoutMs: number = 10000): Promise<boolean> {
    if (this.isConnected) return true;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, timeoutMs);

      const unsubscribe = this.addListener((isConnected) => {
        if (isConnected) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }

  addListener(listener: (isConnected: boolean) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  get connected(): boolean {
    return this.isConnected;
  }

  addRetryTimeout(timeout: NodeJS.Timeout) {
    this.retryTimeouts.add(timeout);
  }

  removeRetryTimeout(timeout: NodeJS.Timeout) {
    this.retryTimeouts.delete(timeout);
  }
}

// Get network manager instance
const networkManager = NetworkManager.getInstance();

// Enhanced retry logic for auth operations
async function retryAuthOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Check network before attempting
      if (!networkManager.connected) {
        console.log('⏳ Waiting for network connection...');
        const connected = await networkManager.waitForConnection(5000);
        if (!connected) {
          throw new AuthError('No network connection available', 'network-unavailable');
        }
      }

      // Attempt the operation
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.log(`🔄 Auth operation failed (attempt ${attempt + 1}/${maxRetries}):`, error.code);

      // Don't retry for certain errors
      const nonRetryableErrors = [
        'auth/user-not-found',
        'auth/wrong-password',
        'auth/invalid-email',
        'auth/user-disabled',
        'auth/email-already-in-use',
      ];

      if (nonRetryableErrors.includes(error.code)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);

      if (attempt < maxRetries - 1) {
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => {
          const timeout = setTimeout(resolve, delay);
          networkManager.addRetryTimeout(timeout);
        });
      }
    }
  }

  throw lastError;
}

// References
const db = firestore;
const googleProvider = new GoogleAuthProvider();

// Input validation helpers
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

const validatePassword = (password: string): { isValid: boolean; message?: string } => {
  if (!password || password.length < 6) {
    return { isValid: false, message: 'Password must be at least 6 characters long' };
  }
  return { isValid: true };
};

// Enhanced error handling with user-friendly messages
const handleAuthError = (error: any): AuthError => {
  console.error('Auth error:', error);

  const errorMessages: { [key: string]: string } = {
    'auth/user-not-found': 'No account found with this email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-email': 'Invalid email address format.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password is too weak. Please choose a stronger password.',
    'auth/network-request-failed': 'Network error. Please check your connection and try again.',
    'auth/invalid-credential': 'Invalid login credentials.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled.',
    'network-unavailable': 'No network connection. Please check your internet connection.',
  };

  const message = errorMessages[error.code] || 'An unexpected error occurred. Please try again.';
  return new AuthError(message, error.code, error);
};

// Enhanced sign-in with validation, network checking, and retry logic
export const signInUser = async (email: string, password: string): Promise<AuthResult> => {
  try {
    // Input validation
    const trimmedEmail = email.trim();
    if (!validateEmail(trimmedEmail)) {
      throw new AuthError('Please enter a valid email address.', 'invalid-email');
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new AuthError(passwordValidation.message!, 'invalid-password');
    }

    console.log('🔐 Attempting to sign in user:', trimmedEmail);

    // Use retry logic for sign in
    const userCredential = await retryAuthOperation(async () => {
      return await signInWithEmailAndPassword(auth, trimmedEmail, password);
    });

    const user = userCredential.user;

    // Update last login timestamp
    await updateUserLastLogin(user.uid);

    // Determine user type
    const userType = await getUserType(trimmedEmail);

    console.log('✅ User signed in successfully:', user.email);
    return { user, userType };
  } catch (error: any) {
    throw handleAuthError(error);
  }
};

// Enhanced registration with profile creation and retry logic
export const registerUser = async (
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  userType: 'regular' | 'business' = 'regular'
): Promise<AuthResult> => {
  try {
    // Input validation
    const trimmedEmail = email.trim();
    if (!validateEmail(trimmedEmail)) {
      throw new AuthError('Please enter a valid email address.', 'invalid-email');
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new AuthError(passwordValidation.message!, 'weak-password');
    }

    console.log('📝 Registering new user:', trimmedEmail);

    // Use retry logic for registration
    const userCredential = await retryAuthOperation(async () => {
      return await createUserWithEmailAndPassword(auth, trimmedEmail, password);
    });

    const user = userCredential.user;

    // Update display name if provided
    if (firstName && lastName) {
      await updateProfile(user, {
        displayName: `${firstName.trim()} ${lastName.trim()}`
      });
    }

    // Create user profile in Firestore
    await createUserProfile(user, {
      email: trimmedEmail,
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
      userType
    });

    console.log('✅ User registered successfully:', user.email);
    return { user, isNewUser: true, userType };
  } catch (error: any) {
    throw handleAuthError(error);
  }
};

// Enhanced business user sign-in with proper verification
export const signInBusinessUser = async (email: string, password: string): Promise<AuthResult> => {
  try {
    // First, authenticate the user normally
    const result = await signInUser(email, password);

    // Then verify they are actually a business user
    const businessUsersDoc = await getDoc(doc(db, 'businessUsers', result.user.uid));

    if (!businessUsersDoc.exists()) {
      // Sign out the user since they're not authorized as business user
      await signOut(auth);
      throw new AuthError(
        'This account is not registered as a business user. Please contact support if you believe this is an error.',
        'unauthorized-business-user'
      );
    }

    const businessUserData = businessUsersDoc.data();
    console.log('✅ Business user signed in successfully:', businessUserData.email);

    return { ...result, userType: 'business' };
  } catch (error: any) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw handleAuthError(error);
  }
};

// Helper function to determine user type efficiently
const getUserType = async (email: string): Promise<'regular' | 'business'> => {
  try {
    // Check in businessUsers collection first (likely smaller collection)
    const businessQuery = query(
      collection(db, 'businessUsers'),
      where('email', '==', email)
    );
    const businessSnapshot = await getDocs(businessQuery);

    return businessSnapshot.empty ? 'regular' : 'business';
  } catch (error) {
    console.warn('Error determining user type:', error);
    return 'regular'; // Default to regular user on error
  }
};

// Create user profile in appropriate collection
const createUserProfile = async (
  user: User,
  profileData: Partial<UserProfile>
): Promise<void> => {
  try {
    const profile: UserProfile = {
      email: user.email!,
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      userType: profileData.userType || 'regular',
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    };

    const collectionName = profileData.userType === 'business' ? 'businessUsers' : 'users';

    await retryAuthOperation(async () => {
      await setDoc(doc(db, collectionName, user.uid), profile);
    });

    console.log(`✅ User profile created in ${collectionName} collection`);
  } catch (error) {
    console.error('❌ Error creating user profile:', error);
    throw new AuthError('Failed to create user profile.', 'profile-creation-failed', error);
  }
};

// Update last login timestamp efficiently
const updateUserLastLogin = async (uid: string): Promise<void> => {
  try {
    await retryAuthOperation(async () => {
      // Try business users first (usually smaller dataset)
      const businessUserRef = doc(db, 'businessUsers', uid);
      const businessUserDoc = await getDoc(businessUserRef);

      if (businessUserDoc.exists()) {
        await setDoc(businessUserRef, { lastLoginAt: serverTimestamp() }, { merge: true });
        return;
      }

      // Try regular users if not found in business users
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
    }, 1); // Only retry once for non-critical operations
  } catch (error) {
    console.warn('⚠️ Error updating last login (non-critical):', error);
    // Don't throw error for this non-critical operation
  }
};

// Enhanced Google Sign-In with better error handling
export const signInWithGoogle = async (
  idToken: string,
  accessToken: string,
  userType: 'regular' | 'business' = 'regular'
): Promise<AuthResult> => {
  try {
    if (!idToken || !accessToken) {
      throw new AuthError('Google authentication tokens are required.', 'missing-tokens');
    }

    console.log('🔐 Signing in with Google...');

    const credential = GoogleAuthProvider.credential(idToken, accessToken);

    const userCredential = await retryAuthOperation(async () => {
      return await signInWithCredential(auth, credential);
    });

    const user = userCredential.user;

    // Check if this is a new user (creation time equals last sign-in time)
    const isNewUser = userCredential.user.metadata.creationTime === userCredential.user.metadata.lastSignInTime;

    if (isNewUser) {
      // Create profile for new Google users
      const displayName = user.displayName || '';
      const [firstName, lastName] = displayName.split(' ');

      await createUserProfile(user, {
        email: user.email!,
        firstName: firstName?.trim(),
        lastName: lastName?.trim() || '',
        userType
      });

      console.log('✅ New Google user profile created');
    } else {
      // Update last login for existing users
      await updateUserLastLogin(user.uid);
    }

    const finalUserType = isNewUser ? userType : await getUserType(user.email!);

    console.log('✅ User signed in with Google:', user.email);
    return { user, isNewUser, userType: finalUserType };
  } catch (error: any) {
    throw handleAuthError(error);
  }
};

// Password reset functionality
export const resetPassword = async (email: string): Promise<void> => {
  try {
    const trimmedEmail = email.trim();
    if (!validateEmail(trimmedEmail)) {
      throw new AuthError('Please enter a valid email address.', 'invalid-email');
    }

    await retryAuthOperation(async () => {
      await sendPasswordResetEmail(auth, trimmedEmail);
    });

    console.log('📧 Password reset email sent to:', trimmedEmail);
  } catch (error: any) {
    throw handleAuthError(error);
  }
};

// Enhanced sign out with cleanup
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
    console.log('👋 User signed out successfully');

    // Clear any cached data here if needed
    // Note: AsyncStorage cleanup should be handled by the app
  } catch (error: any) {
    throw handleAuthError(error);
  }
};

// Get current user profile from Firestore
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('No authenticated user found');
      return null;
    }

    return await retryAuthOperation(async () => {
      // Try business users first
      const businessUserDoc = await getDoc(doc(db, 'businessUsers', currentUser.uid));
      if (businessUserDoc.exists()) {
        return { ...businessUserDoc.data(), userType: 'business' } as UserProfile;
      }

      // Try regular users
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        return { ...userDoc.data(), userType: 'regular' } as UserProfile;
      }

      console.warn('User profile not found in Firestore for:', currentUser.email);
      return null;
    });
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    return null;
  }
};

// Enhanced auth state monitoring with user type detection and network awareness
export const monitorAuthState = (
  callback: (user: User | null, userType?: 'regular' | 'business') => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Force token refresh if network is available
        if (networkManager.connected) {
          try {
            await user.getIdToken(true);
          } catch (error) {
            console.warn('Token refresh failed:', error);
          }
        }

        const userType = await getUserType(user.email!);
        callback(user, userType);
      } catch (error) {
        console.warn('Error detecting user type:', error);
        callback(user, 'regular'); // Default to regular on error
      }
    } else {
      callback(null);
    }
  });
};

// Check if user exists and get their type
export const checkUserExists = async (
  email: string
): Promise<{ exists: boolean; userType?: 'regular' | 'business' }> => {
  try {
    const trimmedEmail = email.trim();
    if (!validateEmail(trimmedEmail)) {
      return { exists: false };
    }

    const userType = await getUserType(trimmedEmail);
    return { exists: true, userType };
  } catch (error) {
    console.error('❌ Error checking user existence:', error);
    return { exists: false };
  }
};

// Utility to check if current user is business user
export const isCurrentUserBusiness = async (): Promise<boolean> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser?.email) return false;

    const userType = await getUserType(currentUser.email);
    return userType === 'business';
  } catch (error) {
    console.error('Error checking if user is business:', error);
    return false;
  }
};

// Enhanced user profile update
export const updateUserProfile = async (
  updates: Partial<UserProfile>
): Promise<void> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new AuthError('No authenticated user found.', 'no-user');
    }

    await retryAuthOperation(async () => {
      // Update Firebase Auth profile if name changed
      if (updates.firstName || updates.lastName) {
        const displayName = `${updates.firstName || ''} ${updates.lastName || ''}`.trim();
        await updateProfile(currentUser, { displayName });
      }

      // Determine which collection to update
      const userType = await getUserType(currentUser.email!);
      const collectionName = userType === 'business' ? 'businessUsers' : 'users';

      // Update Firestore document
      const userRef = doc(db, collectionName, currentUser.uid);
      await setDoc(userRef, {
        ...updates,
        lastLoginAt: serverTimestamp()
      }, { merge: true });
    });

    console.log('✅ User profile updated successfully');
  } catch (error: any) {
    throw handleAuthError(error);
  }
};

// Rate limiting helper
const rateLimitMap = new Map<string, number>();
export const checkRateLimit = async (
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): Promise<boolean> => {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Clean old entries
  for (const [key, timestamp] of rateLimitMap.entries()) {
    if (timestamp < windowStart) {
      rateLimitMap.delete(key);
    }
  }

  // Count attempts in current window
  let attempts = 0;
  for (const [key, timestamp] of rateLimitMap.entries()) {
    if (key.startsWith(identifier) && timestamp >= windowStart) {
      attempts++;
    }
  }

  if (attempts >= maxAttempts) {
    console.warn(`Rate limit exceeded for ${identifier}`);
    return false;
  }

  // Record this attempt
  rateLimitMap.set(`${identifier}_${now}`, now);
  return true;
};

// Force refresh Firebase connection (useful for debugging)
export const forceRefreshConnection = async (): Promise<void> => {
  try {
    console.log('🔄 Forcing Firebase connection refresh...');

    // Re-enable network
    await enableNetwork(firestore);

    // Refresh auth token if logged in
    const user = auth.currentUser;
    if (user) {
      await user.reload();
      await user.getIdToken(true);
    }

    console.log('✅ Firebase connection refreshed');
  } catch (error) {
    console.error('❌ Error refreshing connection:', error);
    throw error;
  }
};

// Export all necessary items
export { auth, db };