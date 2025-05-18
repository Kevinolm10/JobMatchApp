import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage'; // React Native AsyncStorage
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { firebaseConfig } from './firebaseConfig'; // Adjust path if needed

// Initialize Firebase App once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth and Firestore instances
const auth = getAuth(app);
const db = getFirestore(app);

// Google Auth Provider instance
const googleProvider = new GoogleAuthProvider();

// Set persistence for React Native
setPersistence(auth, browserLocalPersistence);

// Sign in with email/password
export const signInUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('User signed in:', userCredential.user);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in user:', error);
    throw error;
  }
};

// Register user with email/password
export const registerUser = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('User registered:', userCredential.user);
    return userCredential.user;
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
};

// Monitor auth state changes
export const monitorAuthState = (callback: (user: any) => void) => {
  const unsubscribe = onAuthStateChanged(auth, callback);
  return unsubscribe;
};

// Sign in business user and verify existence in businessUsers collection
export const signInBusinessUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('User signed in:', user);

    const businessUsersCollection = collection(db, 'businessUsers');
    const businessUserQuery = query(businessUsersCollection, where('email', '==', email));
    const businessUserSnapshot = await getDocs(businessUserQuery);

    if (!businessUserSnapshot.empty) {
      const businessUser = businessUserSnapshot.docs[0].data();
      console.log('Business user found:', businessUser);
      return businessUser;
    } else {
      throw new Error('Not a registered business user');
    }
  } catch (error) {
    console.error('Error signing in business user:', error);
    throw error;
  }
};

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    console.log('User signed in with Google:', user);
    return user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export { auth, db };
