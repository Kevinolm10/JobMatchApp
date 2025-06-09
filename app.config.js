import 'dotenv/config';

export default {
  expo: {
    name: "frontend",
    slug: "frontend",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./frontend/assets/images/icon.png",
    scheme: "com.anonymous.frontend",
    jsEngine: "hermes",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "com.anonymous.frontend",
      supportsTablet: true,
      icon: "./frontend/assets/images/icon.png",
      // Add iOS network configuration for Firebase
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSExceptionDomains: {
            "firebaseapp.com": {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSExceptionMinimumTLSVersion: "1.0",
              NSIncludesSubdomains: true
            },
            "googleapis.com": {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSExceptionMinimumTLSVersion: "1.0",
              NSIncludesSubdomains: true
            },
            "identitytoolkit.googleapis.com": {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSExceptionMinimumTLSVersion: "1.0"
            }
          }
        }
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./frontend/assets/images/foreground.png",
        backgroundImage: "./frontend/assets/images/background.png",
      },
      package: "com.anonymous.frontend",
      // Add Android network config for completeness
      usesCleartextTraffic: true,
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    },
    web: {
      bundler: "metro",
      output: "static",
    },
    plugins: [
      "expo-router",
      "expo-font",
      [
        "expo-splash-screen",
        {
          image: "./frontend/assets/images/splash.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      // Add build properties for better network handling
      [
        "expo-build-properties",
        {
          ios: {
            networkingEnabled: true
          },
          android: {
            usesCleartextTraffic: true
          }
        }
      ]
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      // Add Firebase config validation
      firebaseApiKey: process.env.FIREBASE_API_KEY || "AIzaSyBvy5QxC36HFMBGriZcThZkLS-qzhJlhho",
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || "jobfinder-8b8d3.firebaseapp.com",
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "jobfinder-8b8d3"
    },
  },
};