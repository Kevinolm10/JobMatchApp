import { FirebaseOptions } from 'firebase/app';
import Constants from 'expo-constants';

// Create the config object using the values from .env via Expo constants
const firebaseConfig: FirebaseOptions = {
  apiKey: Constants.expoConfig?.extra?.FIREBASE_API_KEY || '',
  authDomain: Constants.expoConfig?.extra?.FIREBASE_AUTH_DOMAIN || '',
  projectId: Constants.expoConfig?.extra?.FIREBASE_PROJECT_ID || '',
  storageBucket: Constants.expoConfig?.extra?.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: Constants.expoConfig?.extra?.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: Constants.expoConfig?.extra?.FIREBASE_APP_ID || '',
  measurementId: Constants.expoConfig?.extra?.FIREBASE_MEASUREMENT_ID || '',
};

export { firebaseConfig };
