/*
import { db } from "./firebaseConfig";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { collection, setDoc, doc } from "firebase/firestore";

const auth = getAuth();

// Funktion för att generera slumpmässiga användare
const generateRandomUser = (index: number) => ({
  address: `Randomgatan ${index}`,
  email: `test${index}@gmail.com`,
  password: "password123", // Fast lösenord för testning
  experience: `${Math.floor(Math.random() * 10) + 1} år som utvecklare`,
  firstName: ["Erik", "Anna", "Oskar", "Lisa", "Johan", "Emma", "David", "Karin", "Magnus", "Sara"][index % 10],
  image: `https://randomuser.me/api/portraits/${index % 2 === 0 ? "men" : "women"}/${index}.jpg`,
  lastName: ["Svensson", "Johansson", "Andersson", "Karlsson", "Nilsson", "Bengtsson", "Larsson", "Hansson", "Persson", "Eriksson"][index % 10],
  location: {
    accuracy: Math.random() * 20,
    altitude: Math.random() * 50,
    altitudeAccuracy: Math.random() * 15,
    heading: -1,
    latitude: 57 + Math.random() * 3,
    longitude: 11 + Math.random() * 5,
    speed: -1,
  },
  phoneNumber: `+4670${Math.floor(1000000 + Math.random() * 9000000)}`,
  skills: ["JavaScript", "React", "Node.js", "Python", "Java", "Swift", "C#", "Ruby", "Go", "PHP"][index % 10],
  workCommitment: `${Math.floor(Math.random() * 100) + 1}%`,
});

// Skapa 10 slumpmässiga användare
const users = Array.from({ length: 10 }, (_, i) => generateRandomUser(i));

const addUsersToFirestore = async () => {
  for (const user of users) {
    try {
      let userId;

      try {
        // Försök skapa användaren
        const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
        userId = userCredential.user.uid;
        console.log(`✅ Ny användare skapad: ${user.email}`);
      } catch (error: any) {
        if (error.code === "auth/email-already-in-use") {
          // Om e-postadressen redan används, logga in användaren och hämta UID
          const userCredential = await signInWithEmailAndPassword(auth, user.email, user.password);
          userId = userCredential.user.uid;
          console.log(`🔄 Användaren fanns redan, inloggad: ${user.email}`);
        } else {
          throw error;
        }
      }

      // Skapa referens till Firestore-kollektionen
      const userDocRef = doc(db, "users", userId);
      await setDoc(userDocRef, {
        address: user.address,
        email: user.email,
        experience: user.experience,
        firstName: user.firstName,
        image: user.image,
        lastName: user.lastName,
        location: user.location,
        phoneNumber: user.phoneNumber,
        skills: user.skills,
        workCommitment: user.workCommitment,
      });

      console.log(`🔥 Användare ${user.email} har lagts till i Firestore!`);
    } catch (error) {
      console.error(`❌ Fel vid uppladdning av användare ${user.email}:`, error);
    }
  }
};

// Starta uppladdning
addUsersToFirestore(); */

import { deleteDoc, doc, getDoc, setDoc } from "@react-native-firebase/firestore";
import { db } from "./firebaseAuth";


// Run this once to fix existing business users
