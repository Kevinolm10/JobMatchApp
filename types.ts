export type RootStackParamList = {
  HomeScreen: undefined;
  SignInScreen: undefined;
  SignUpScreen: undefined;
  SignUpCardScreen: { userId: string };
  BusinessSignIn: undefined;
  MainSwipe: {
    mockUser?: {
      image: string;
      firstName: string;
      lastName: string;
      email: string;
      skills: string;
      experience: string;
      location: {
        latitude: number;
        longitude: number;
      };
      phoneNumber: string;
      workCommitment: string;
    };
    userId?: string; // Add userId as an optional parameter
  };
  MessagesScreen: undefined;  // Lägg till den här raden för MessagesScreen
  SettingsScreen: undefined;  // Lägg till den här raden för SettingsScreen
};
