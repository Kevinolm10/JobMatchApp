    // GoogleAuth.ts

    import * as AuthSession from 'expo-auth-session';
    import * as WebBrowser from 'expo-web-browser';
    import { useEffect } from 'react';
    import { useAuthRequest } from 'expo-auth-session/providers/google';
    import { makeRedirectUri } from 'expo-auth-session';

    WebBrowser.maybeCompleteAuthSession();

    const GOOGLE_CLIENT_ID = '531495949144-t89fqp38qmf57p5k470q6o0c11bhqcvj.apps.googleusercontent.com';

    export function useGoogleAuth() {
    const redirectUri = makeRedirectUri({
        useProxy: true, // Explicitly cast to bypass TypeScript error
    } as any);

        console.log("🔁 Using redirect URI:", redirectUri);

    const [request, response, promptAsync] = useAuthRequest({
        clientId: GOOGLE_CLIENT_ID,
        redirectUri,
        scopes: ['profile', 'email'],
    });

    useEffect(() => {
        if (response?.type === 'success') {
        const { authentication } = response;
        console.log('Google token:', authentication?.accessToken);
        // You can now use this token to authenticate with Firebase or fetch profile info
        }
    }, [response]);

    return {
        promptAsync,
        request,
    };
    }
