// firebaseConfig.ts - Alternative without getReactNativePersistence
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  enableNetwork,
  CACHE_SIZE_UNLIMITED,
  initializeFirestore,
  Firestore
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBvy5QxC36HFMBGriZcThZkLS-qzhJlhho",
  authDomain: "jobfinder-8b8d3.firebaseapp.com",
  projectId: "jobfinder-8b8d3",
  storageBucket: "jobfinder-8b8d3.appspot.com",
  messagingSenderId: "229617242049",
  appId: "1:229617242049:web:d203c20a55f2767422e940",
  measurementId: "G-3G2TNCP33B"
};

// Initialize Firebase only once
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  console.log('🔥 Firebase app initialized');
} else {
  app = getApp();
  console.log('🔥 Using existing Firebase app');
}

// Initialize Auth
const auth = getAuth(app);

// Initialize Storage
const storage = getStorage(app);
console.log('📦 Firebase Storage initialized');

// Initialize Firestore with enhanced settings for React Native
let firestore: Firestore;
try {
  if (Platform.OS === 'web') {
    firestore = getFirestore(app);
  } else {
    // React Native specific configuration
    firestore = initializeFirestore(app, {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      experimentalForceLongPolling: true,
      experimentalAutoDetectLongPolling: true,
    });
    console.log('📱 Firestore initialized with React Native optimizations');
  }
} catch (error) {
  // Firestore already initialized
  firestore = getFirestore(app);
}

// Enable network for React Native
if (Platform.OS !== 'web') {
  enableNetwork(firestore).catch(console.error);
}

// Helper function to manually refresh Firebase connections
export const refreshFirebaseConnection = async () => {
  try {
    console.log('🔄 Refreshing Firebase connections...');

    // Re-enable Firestore network
    await enableNetwork(firestore);

    // If user is authenticated, refresh their token
    if (auth.currentUser) {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      console.log('✅ Auth token refreshed');
    }

    console.log('✅ Firebase connections refreshed');
    return true;
  } catch (error) {
    console.error('❌ Error refreshing Firebase connections:', error);
    return false;
  }
};

// Export configured instances
export { app, firestore, auth, storage };