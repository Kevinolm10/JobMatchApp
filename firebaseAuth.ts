import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { firebaseConfig } from './firebaseConfig'; // Ensure the import path is correct
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage for React Native
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

// Check if Firebase is already initialized, if not, initialize it
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth and Firestore
const auth = getAuth(app);
const db = getFirestore(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Set persistence using AsyncStorage for React Native
setPersistence(auth, browserLocalPersistence);

// Function to sign in user
export const signInUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('User signed in:', userCredential.user);
    return userCredential.user; // Return user for further use
  } catch (error) {
    console.error('Error signing in user:', error);
    throw error; // Rethrow error to be handled by caller
  }
};

// Function to register user
export const registerUser = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('User registered:', userCredential.user);
    return userCredential.user; // Return user for further use
  } catch (error) {
    console.error('Error registering user:', error);
    throw error; // Rethrow error to be handled by caller
  }
};

// Function to monitor authentication state changes
export const monitorAuthState = (callback: (user: any) => void) => {
  const unsubscribe = onAuthStateChanged(auth, callback);
  return unsubscribe; // Return the unsubscribe function for cleanup
};

// Function to sign in business user and check if they exist in the businessUsers collection
export const signInBusinessUser = async (email: string, password: string) => {
  try {
    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('User signed in:', user);

    // Check if user is a business user in Firestore
    const businessUsersCollection = collection(db, "businessUsers");
    const businessUserQuery = query(businessUsersCollection, where("email", "==", email));
    const businessUserSnapshot = await getDocs(businessUserQuery);

    if (!businessUserSnapshot.empty) {
      // If the user exists in the "businessUsers" collection, return the business user
      const businessUser = businessUserSnapshot.docs[0].data();
      console.log('Business user found:', businessUser);
      return businessUser; // Return the business user for further use (e.g., navigation)
    } else {
      // If the user is not found in the businessUsers collection, handle the error
      throw new Error('Not a registered business user');
    }
  } catch (error) {
    console.error('Error signing in business user:', error);
    throw error; // Rethrow the error to be handled by the caller
  }
};

// Function to sign in with Google
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log('User signed in with Google:', user);
    return user; // Return user for further use
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error; // Rethrow error to be handled by caller
  }
};
  

export { auth, db };
