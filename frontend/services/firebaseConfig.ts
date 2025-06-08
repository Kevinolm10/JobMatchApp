import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBvy5QxC36HFMBGriZcThZkLS-qzhJlhho",
  authDomain: "jobfinder-8b8d3.firebaseapp.com",
  projectId: "jobfinder-8b8d3",
  storageBucket: "jobfinder-8b8d3.appspot.com",
  messagingSenderId: "229617242049",
  appId: "1:229617242049:web:d203c20a55f2767422e940",
  measurementId: "G-3G2TNCP33B"
};

// Initialize app only if not already initialized
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const firestore = getFirestore(app);
const auth = getAuth(app);

export { app, firestore, auth };
