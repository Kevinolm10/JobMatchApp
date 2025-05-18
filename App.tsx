import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { monitorAuthState } from "./firebaseAuth"; 
import Ionicons from "@expo/vector-icons/Ionicons";
import { TouchableOpacity } from 'react-native';
import 'dotenv/config'; // Ensure this is at the top to load the .env variables

// Import screens
import HomeScreen from "./app/index";
import SignInScreen from "./app/SignInScreen"; 
import SignUpScreen from "./app/SignUpScreen"; 
import SignUpCardScreen from "./app/SignUpCardScreen";
import MainSwipe from "./app/MainSwipe";
import BusinessSignIn from "./app/BusinessSignIn";
import MessagesScreen from "./app/MessagesScreen"; // Importera MessagesScreen
import SettingsScreen from "./app/SettingsScreen"; // Import SettingsScreen
import ProfileInfoScreen from "./app/ProfileInfoScreen"; // Import ProfileInfoScreen

// Import types
import { RootStackParamList } from './types'; 

// Create stack navigator
const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = monitorAuthState((user) => {
      setUser(user);
    });
    return unsubscribe;
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="HomeScreen"
        screenOptions={{
          headerShown: true, // Ensure header is displayed
        }}
      >
        {/* HomeScreen - No Back Arrow */}
        <Stack.Screen 
          name="HomeScreen" 
          component={HomeScreen} 
          options={{
            headerLeft: () => null, // Hide back arrow
          }}
        />

        <Stack.Screen 
          name="SettingsScreen" 
          component={SettingsScreen} 
          options={{
            headerShown: true,
            headerLeft: () => null, // Hide back button
          }}
        />

        <Stack.Screen
          name="ProfileInfoScreen"
          component={ProfileInfoScreen}
          options={{
            headerShown: true,
            headerLeft: () => null, // Hide back button
          }}
        />

        
        {/* Auth Screens with Back Arrow */}
        {(
          [
            { name: "SignInScreen", component: SignInScreen },
            { name: "SignUpScreen", component: SignUpScreen },
            { name: "SignUpCardScreen", component: SignUpCardScreen },
            { name: "BusinessSignIn", component: BusinessSignIn },

          ] as { name: keyof RootStackParamList; component: React.ComponentType<any> }[] 
        ).map(({ name, component }) => (
          <Stack.Screen 
            key={name}
            name={name}
            component={component}
            options={({ navigation }) => ({
              headerShown: true, // Ensure header is visible
              headerBackTitleVisible: false, // Hide back button text
              headerLeft: () => (
                <TouchableOpacity 
                  onPress={() => navigation.goBack()} 
                  style={{ marginLeft: 15 }} // Add spacing
                >
                  <Ionicons name="arrow-back" size={30} color="black" />
                </TouchableOpacity>
              ),
              headerLeftContainerStyle: {
                paddingLeft: 10, // Ensure the button isn't too far left
              },
            })}
          />
        ))}

        {/* MainSwipe screen - No Back Arrow */}
        <Stack.Screen 
          name="MainSwipe" 
          component={MainSwipe} 
          options={{
            headerShown: false, // Hide header for MainSwipe
          }}
        />

        {/* Add MessagesScreen here */}
        <Stack.Screen 
          name="MessagesScreen" 
          component={MessagesScreen} 
          options={{ headerShown: true }} // Optionally show a header
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
