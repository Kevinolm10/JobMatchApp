// App.tsx
import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { monitorAuthState } from "./frontend/services/firebaseAuth";
import Ionicons from "@expo/vector-icons/Ionicons";
import { TouchableOpacity } from "react-native";
import 'dotenv/config'; // If you’re loading environment variables this way

// ————————————————
import HomeScreen from "./app/index";             // must be default‐exported
import SignInScreen from "./app/SignInScreen";   // must be default‐exported
import SignUpScreen from "./app/SignUpScreen";   // must be default‐exported
import SignUpCardScreen from "./app/SignUpCardScreen"; // must be default‐exported
import MainSwipe from "./app/MainSwipe";          // must be default‐exported
import BusinessSignIn from "./app/BusinessSignIn";// must be default‐exported
import MessagesScreen from "./app/MessagesScreen";// must be default‐exported
import SettingsScreen from "./app/SettingsScreen";// must be default‐exported
import ProfileInfoScreen from "./app/ProfileInfoScreen"; // must be default‐exported


import { RootStackParamList } from "./types";

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {

  const [user, setUser] = useState<any>(null);

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
          headerShown: true,
        }}
      >
        {/* HomeScreen – no back arrow */}
        <Stack.Screen
          name="HomeScreen"
          component={HomeScreen}
          options={{ headerLeft: () => null }}
        />

        {/* Settings & Profile Info – no back arrow */}
        <Stack.Screen
          name="SettingsScreen"
          component={SettingsScreen}
          options={{ headerLeft: () => null }}
        />
        <Stack.Screen
          name="ProfileInfoScreen"
          component={ProfileInfoScreen}
          options={{ headerLeft: () => null }}
        />

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
              headerBackTitleVisible: false,
              headerLeft: () => (
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={{ marginLeft: 15 }}
                >
                  <Ionicons name="arrow-back" size={30} color="black" />
                </TouchableOpacity>
              ),
              headerLeftContainerStyle: {
                paddingLeft: 10,
              },
            })}
          />
        ))}

        {/* MainSwipe – hide header entirely */}
        <Stack.Screen
          name="MainSwipe"
          component={MainSwipe}
          options={{ headerShown: false }}
        />

        {/* MessagesScreen – regular header */}
        <Stack.Screen
          name="MessagesScreen"
          component={MessagesScreen}
          options={{ headerShown: true }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
