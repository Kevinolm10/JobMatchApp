// GoogleAuth.ts
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, useCallback } from 'react';
import { useAuthRequest } from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { signInWithGoogle, AuthError } from '../services/firebaseAuth';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../types'; // Adjust the import path as needed

WebBrowser.maybeCompleteAuthSession();

// Your Google OAuth client ID
const GOOGLE_CLIENT_ID = '531495949144-t89fqp38qmf57p5k470q6o0c11bhqcvj.apps.googleusercontent.com';

interface GoogleAuthState {
    loading: boolean;
    error: string | null;
    user: any | null;
}

type NavigationProp = StackNavigationProp<RootStackParamList>;

export function useGoogleAuth() {
    const navigation = useNavigation<NavigationProp>();
    const [authState, setAuthState] = useState<GoogleAuthState>({
        loading: false,
        error: null,
        user: null,
    });

    // Fixed redirect URI configuration
    const redirectUri = makeRedirectUri({
        scheme: 'your-app-scheme', // Replace with your app's scheme
    });

    console.log("🔁 Using redirect URI:", redirectUri);

    const [request, response, promptAsync] = useAuthRequest({
        clientId: GOOGLE_CLIENT_ID,
        scopes: ['profile', 'email', 'openid'],
    });

    // Enhanced Google sign-in handler
    const handleGoogleSignIn = useCallback(async (authentication: any) => {
        if (!authentication?.accessToken || !authentication?.idToken) {
            console.error('❌ Missing Google authentication tokens');
            setAuthState(prev => ({
                ...prev,
                loading: false,
                error: 'Misslyckades med att få Google-tokens'
            }));
            return;
        }

        setAuthState(prev => ({ ...prev, loading: true, error: null }));

        try {
            console.log('🔐 Signing in with Google tokens...');
            console.log('Access Token:', authentication.accessToken.substring(0, 20) + '...');
            console.log('ID Token:', authentication.idToken.substring(0, 20) + '...');

            // Sign in to Firebase with Google tokens
            const result = await signInWithGoogle(
                authentication.idToken,
                authentication.accessToken,
                'regular' // Default to regular user
            );

            console.log('✅ Google sign-in successful:', result.user.email);

            setAuthState(prev => ({
                ...prev,
                loading: false,
                user: result.user,
                error: null
            }));

            // Fixed navigation - use proper type casting
            navigation.navigate('MainSwipe', { userId: result.user.uid });

            // Show welcome message for new users
            if (result.isNewUser) {
                Alert.alert(
                    'Välkommen!',
                    'Ditt konto har skapats med Google. Välkommen till Job-Finder!',
                    [{ text: 'Tack!', style: 'default' }]
                );
            }

        } catch (error: any) {
            console.error('❌ Google sign-in error:', error);

            let errorMessage = 'Ett oväntat fel inträffade vid Google-inloggning.';

            if (error instanceof AuthError) {
                // Map Firebase Google auth errors to Swedish
                const errorMap: { [key: string]: string } = {
                    'auth/account-exists-with-different-credential': 'Ett konto med denna e-post finns redan med annan inloggningsmetod.',
                    'auth/invalid-credential': 'Ogiltiga Google-inloggningsuppgifter.',
                    'auth/operation-not-allowed': 'Google-inloggning är inte aktiverat.',
                    'auth/user-disabled': 'Detta konto har inaktiverats.',
                    'auth/user-not-found': 'Ingen användare hittades.',
                    'auth/network-request-failed': 'Nätverksfel. Kontrollera din internetanslutning.',
                    'missing-tokens': 'Kunde inte hämta Google-tokens.',
                };

                errorMessage = errorMap[error.code] || error.message;
            }

            setAuthState(prev => ({
                ...prev,
                loading: false,
                error: errorMessage
            }));

            Alert.alert(
                'Google-inloggning misslyckades',
                errorMessage,
                [{ text: 'OK', style: 'default' }]
            );
        }
    }, [navigation]);

    // Enhanced response handler
    useEffect(() => {
        if (response?.type === 'success') {
            const { authentication } = response;
            console.log('🎉 Google OAuth successful');
            handleGoogleSignIn(authentication);
        } else if (response?.type === 'error') {
            console.error('❌ Google OAuth error:', response.error);
            setAuthState(prev => ({
                ...prev,
                loading: false,
                error: 'Google-inloggning avbröts eller misslyckades'
            }));

            Alert.alert(
                'Google-inloggning misslyckades',
                'Inloggningen avbröts eller misslyckades. Försök igen.',
                [{ text: 'OK', style: 'default' }]
            );
        } else if (response?.type === 'cancel') {
            console.log('ℹ️ Google OAuth cancelled by user');
            setAuthState(prev => ({
                ...prev,
                loading: false,
                error: null
            }));
        }
    }, [response, handleGoogleSignIn]);

    // Enhanced prompt function with loading state
    const enhancedPromptAsync = useCallback(async () => {
        if (!request) {
            Alert.alert(
                'Google-inloggning ej tillgänglig',
                'Google-inloggning kunde inte initialiseras. Försök igen senare.',
                [{ text: 'OK', style: 'default' }]
            );
            return;
        }

        if (authState.loading) {
            console.log('🔄 Google sign-in already in progress');
            return;
        }

        try {
            setAuthState(prev => ({ ...prev, loading: true, error: null }));
            console.log('🚀 Starting Google OAuth flow...');

            await promptAsync();
        } catch (error) {
            console.error('❌ Error starting Google OAuth:', error);
            setAuthState(prev => ({
                ...prev,
                loading: false,
                error: 'Kunde inte starta Google-inloggning'
            }));

            Alert.alert(
                'Fel',
                'Kunde inte starta Google-inloggning. Försök igen.',
                [{ text: 'OK', style: 'default' }]
            );
        }
    }, [request, promptAsync, authState.loading]);

    // Debug information (only in development)
    useEffect(() => {
        if (__DEV__) {
            console.log('🔧 Google Auth Debug Info:');
            console.log('- Request ready:', !!request);
            console.log('- Loading:', authState.loading);
            console.log('- Error:', authState.error);
            console.log('- User:', authState.user?.email || 'none');
        }
    }, [request, authState]);

    return {
        promptAsync: enhancedPromptAsync,
        request,
        loading: authState.loading,
        error: authState.error,
        user: authState.user,
        // Legacy support for your existing code
        response,
    };
}

// Utility to check Google sign-in availability
export const isGoogleSignInAvailable = (): boolean => {
    try {
        // Check if running in a supported environment
        return true; // Expo supports Google sign-in on all platforms
    } catch {
        return false;
    }
};

export default useGoogleAuth;