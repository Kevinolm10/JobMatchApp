import 'dotenv/config';

export default {
  expo: {
    name: "frontend",
    slug: "frontend",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./frontend/assets/images/icon.png", // <--- fix here
    scheme: "myapp",
    jsEngine: "hermes",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "com.anonymous.frontend",
      supportsTablet: true,
      icon: "./frontend/assets/images/icon.png", // <--- fix here
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./frontend/assets/images/foreground.png", // <--- fix here
        backgroundImage: "./frontend/assets/images/background.png", // <--- fix here
      },
      package: "com.anonymous.frontend",
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
          image: "./frontend/assets/images/splash.png", // <--- fix here
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
    },
  },
};
