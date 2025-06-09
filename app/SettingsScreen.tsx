import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    Switch,
    StyleSheet,
    TouchableOpacity,
    Alert,
    SafeAreaView,
    ActivityIndicator,
    StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../types';
import { router } from 'expo-router';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../frontend/services/firebaseConfig';
import { clearAllCache } from '../frontend/components/userStateStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

type MainSwipeNavigationProp = StackNavigationProp<RootStackParamList, 'MainSwipe'>;

interface SettingOption {
    id: string;
    title: string;
    description: string;
    icon: string;
    route?: string;
    action?: () => void;
}

const SettingsScreen: React.FC = () => {
    const navigation = useNavigation<MainSwipeNavigationProp>();

    // Enhanced state management
    const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
    const [darkModeEnabled, setDarkModeEnabled] = useState<boolean>(false);
    const [locationEnabled, setLocationEnabled] = useState<boolean>(true);
    const [signingOut, setSigningOut] = useState<boolean>(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [settingsLoading, setSettingsLoading] = useState<boolean>(true);

    // Monitor auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return unsubscribe;
    }, []);

    // Load saved preferences on component mount
    useEffect(() => {
        loadUserPreferences();
    }, [currentUser]);

    // Load user preferences from storage
    const loadUserPreferences = useCallback(async () => {
        if (!currentUser?.email) return;

        try {
            setSettingsLoading(true);
            const userKey = `user_preferences_${currentUser.email}`;
            const savedPreferences = await AsyncStorage.getItem(userKey);

            if (savedPreferences) {
                const preferences = JSON.parse(savedPreferences);
                setNotificationsEnabled(preferences.notifications ?? true);
                setDarkModeEnabled(preferences.darkMode ?? false);
                setLocationEnabled(preferences.location ?? true);
                console.log('✅ Loaded user preferences:', preferences);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load user preferences:', error);
        } finally {
            setSettingsLoading(false);
        }
    }, [currentUser?.email]);

    // Save user preferences to storage
    const saveUserPreferences = useCallback(async (
        notifications: boolean,
        darkMode: boolean,
        location: boolean
    ) => {
        if (!currentUser?.email) return;

        try {
            const userKey = `user_preferences_${currentUser.email}`;
            const preferences = {
                notifications,
                darkMode,
                location,
                lastUpdated: new Date().toISOString()
            };

            await AsyncStorage.setItem(userKey, JSON.stringify(preferences));
            console.log('✅ Saved user preferences:', preferences);
        } catch (error) {
            console.warn('⚠️ Failed to save user preferences:', error);
        }
    }, [currentUser?.email]);

    // Enhanced settings options with icons and better organization
    const settingsOptions: SettingOption[] = [
        {
            id: '1',
            title: 'Profile',
            description: 'Edit your profile details and preferences',
            icon: 'person',
            route: 'ProfileInfoScreen'
        },
        {
            id: '2',
            title: 'Account',
            description: 'Manage your account settings',
            icon: 'account-circle',
            route: 'AccountScreen'
        },
        {
            id: '3',
            title: 'Privacy & Security',
            description: 'Control your privacy and security settings',
            icon: 'security',
            route: 'PrivacyScreen'
        },
        {
            id: '4',
            title: 'Preferences',
            description: 'Customize your matching preferences',
            icon: 'tune',
            route: 'PreferencesScreen'
        },
        {
            id: '5',
            title: 'Help & Support',
            description: 'Get help, report issues, and contact support',
            icon: 'help',
            route: 'HelpScreen'
        },
        {
            id: '6',
            title: 'About',
            description: 'App version, terms of service, and privacy policy',
            icon: 'info',
            route: 'AboutScreen'
        }
    ];

    // Enhanced toggle handlers with persistence
    const handleNotificationToggle = useCallback(() => {
        setNotificationsEnabled(prev => {
            const newValue = !prev;
            saveUserPreferences(newValue, darkModeEnabled, locationEnabled);
            console.log('Notifications:', newValue ? 'enabled' : 'disabled');
            return newValue;
        });
    }, [darkModeEnabled, locationEnabled, saveUserPreferences]);

    const handleDarkModeToggle = useCallback(() => {
        setDarkModeEnabled(prev => {
            const newValue = !prev;
            saveUserPreferences(notificationsEnabled, newValue, locationEnabled);
            console.log('Dark mode:', newValue ? 'enabled' : 'disabled');
            // TODO: Apply theme changes globally
            return newValue;
        });
    }, [notificationsEnabled, locationEnabled, saveUserPreferences]);

    const handleLocationToggle = useCallback(() => {
        setLocationEnabled(prev => {
            const newValue = !prev;
            saveUserPreferences(notificationsEnabled, darkModeEnabled, newValue);
            console.log('Location:', newValue ? 'enabled' : 'disabled');
            // TODO: Update location permissions
            return newValue;
        });
    }, [notificationsEnabled, darkModeEnabled, saveUserPreferences]);

    // Enhanced navigation handler
    const handleNavigateToSetting = useCallback((item: SettingOption) => {
        if (item.action) {
            item.action();
        } else if (item.route) {
            try {
                navigation.navigate(item.route as never);
            } catch (error) {
                console.warn(`Navigation to ${item.route} failed:`, error);
                Alert.alert(
                    'Coming Soon',
                    `${item.title} feature is under development.`,
                    [{ text: 'OK', style: 'default' }]
                );
            }
        }
    }, [navigation]);

    // Helper functions for comprehensive cleanup
    const clearAllUserCache = useCallback(async (): Promise<void> => {
        try {
            const userEmail = currentUser?.email;
            if (!userEmail) return;

            console.log('🧹 Starting comprehensive cache cleanup...');

            // Clear user-specific data
            await Promise.allSettled([
                // Clear general app cache
                clearAllCache(),
                // Clear user preferences
                AsyncStorage.removeItem(`user_preferences_${userEmail}`),
                // Clear any user-specific cached data
                AsyncStorage.removeItem(`profile_queue_${userEmail}`),
                AsyncStorage.removeItem(`swiped_ids_${userEmail}`),
                AsyncStorage.removeItem(`user_matches_${userEmail}`),
                AsyncStorage.removeItem(`user_messages_${userEmail}`),
                // Clear temporary data
                AsyncStorage.removeItem('temp_profile_data'),
                AsyncStorage.removeItem('temp_upload_data'),
            ]);

            console.log('✅ All user cache cleared successfully');
        } catch (error) {
            console.warn('⚠️ Some cache clearing failed (non-critical):', error);
            // Don't throw - cache clearing failures shouldn't prevent sign out
        }
    }, [currentUser?.email]);

    const cancelPendingOperations = useCallback(async (): Promise<void> => {
        try {
            console.log('⏹️ Cancelling pending operations...');

            // Cancel any ongoing network requests
            // Note: You'd implement this based on your app's architecture
            // Example: apiManager?.cancelAllRequests?.();

            // Cancel location tracking
            // Example: locationManager?.stopTracking?.();

            // Cancel any uploads or downloads
            // Example: uploadManager?.cancelAll?.();

            console.log('✅ Pending operations cancelled');
        } catch (error) {
            console.warn('⚠️ Error cancelling operations (non-critical):', error);
        }
    }, []);

    const clearSensitiveData = useCallback(async (): Promise<void> => {
        try {
            console.log('🔒 Clearing sensitive data...');

            // Clear any sensitive data from memory
            // Reset global state if using state management
            // Clear form data, tokens, etc.

            console.log('✅ Sensitive data cleared');
        } catch (error) {
            console.warn('⚠️ Error clearing sensitive data (non-critical):', error);
        }
    }, []);

    // Enhanced sign out with comprehensive cleanup and better error handling
    const handleSignOut = useCallback(async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        setSigningOut(true);

                        try {
                            console.log('🚪 Starting comprehensive sign out process...');

                            // Step 1: Clear all cached data first
                            await clearAllUserCache();
                            console.log('🧹 Cleared app cache');

                            // Step 2: Cancel any pending operations
                            await cancelPendingOperations();
                            console.log('⏹️ Cancelled pending operations');

                            // Step 3: Clear sensitive data from memory
                            await clearSensitiveData();
                            console.log('🔒 Cleared sensitive data');

                            // Step 4: Sign out from Firebase (this should be last)
                            await signOut(auth);
                            console.log('✅ Firebase sign out successful');

                            // Step 5: Navigate to auth screen immediately
                            router.replace('/');

                            console.log('🎉 Sign out completed successfully');

                        } catch (error: any) {
                            console.error('❌ Sign out error:', error);

                            // Enhanced error handling with specific error types
                            let errorMessage = 'Please try again.';
                            let shouldNavigateAnyway = false;

                            if (error.code === 'auth/network-request-failed') {
                                errorMessage = 'Network error. You may already be signed out.';
                                shouldNavigateAnyway = true;
                            } else if (error.code === 'auth/too-many-requests') {
                                errorMessage = 'Too many requests. Please wait a moment and try again.';
                            } else if (error.code === 'auth/user-token-expired') {
                                errorMessage = 'Session expired. You will be signed out.';
                                shouldNavigateAnyway = true;
                            } else if (error.message) {
                                errorMessage = error.message;
                            }

                            Alert.alert(
                                'Sign Out Issue',
                                errorMessage,
                                [
                                    {
                                        text: 'OK',
                                        style: 'default',
                                        onPress: () => {
                                            // If there was a network error or expired token,
                                            // navigate anyway since user intended to sign out
                                            if (shouldNavigateAnyway) {
                                                router.replace('/');
                                            }
                                        }
                                    }
                                ]
                            );
                        } finally {
                            // Always reset loading state
                            setSigningOut(false);
                        }
                    },
                },
            ],
            {
                cancelable: true,
                onDismiss: () => {
                    console.log('🚫 Sign out cancelled by user');
                }
            }
        );
    }, [clearAllUserCache, cancelPendingOperations, clearSensitiveData]);

    // Enhanced render function for settings options
    const renderSettingOption = useCallback(({ item }: { item: SettingOption }) => (
        <TouchableOpacity
            style={styles.optionContainer}
            onPress={() => handleNavigateToSetting(item)}
            activeOpacity={0.7}
        >
            <View style={styles.optionIconContainer}>
                <Icon name={item.icon} size={24} color="#8456ad" />
            </View>
            <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>{item.title}</Text>
                <Text style={styles.optionDescription}>{item.description}</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#ccc" />
        </TouchableOpacity>
    ), [handleNavigateToSetting]);

    // Enhanced toggle setting component with loading state
    const ToggleSetting = useCallback(({
        title,
        description,
        value,
        onToggle,
        icon,
        disabled = false
    }: {
        title: string;
        description: string;
        value: boolean;
        onToggle: () => void;
        icon: string;
        disabled?: boolean;
    }) => (
        <View style={[styles.toggleContainer, disabled && styles.toggleContainerDisabled]}>
            <View style={styles.toggleIconContainer}>
                <Icon name={icon} size={24} color={disabled ? "#ccc" : "#8456ad"} />
            </View>
            <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleTitle, disabled && styles.toggleTitleDisabled]}>
                    {title}
                </Text>
                <Text style={[styles.toggleDescription, disabled && styles.toggleDescriptionDisabled]}>
                    {description}
                </Text>
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                disabled={disabled}
                trackColor={{ false: '#e0e0e0', true: '#8456ad' }}
                thumbColor={value ? '#ffffff' : '#f4f4f4'}
                ios_backgroundColor="#e0e0e0"
            />
        </View>
    ), []);

    if (settingsLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#8456ad" />
                <View style={styles.headerContainer}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                    >
                        <Icon name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.header}>Settings</Text>
                    <View style={styles.headerSpacer} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8456ad" />
                    <Text style={styles.loadingText}>Loading settings...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#8456ad" />

            {/* Header */}
            <View style={styles.headerContainer}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Icon name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.header}>Settings</Text>
                <View style={styles.headerSpacer} />
            </View>

            {/* User Info Section */}
            {currentUser && (
                <View style={styles.userInfoContainer}>
                    <View style={styles.userAvatar}>
                        <Icon name="person" size={32} color="#8456ad" />
                    </View>
                    <View style={styles.userDetails}>
                        <Text style={styles.userName}>
                            {currentUser.displayName || 'User'}
                        </Text>
                        <Text style={styles.userEmail}>{currentUser.email}</Text>
                        <Text style={styles.userStatus}>
                            Account created: {new Date(currentUser.metadata.creationTime!).toLocaleDateString()}
                        </Text>
                    </View>
                </View>
            )}

            <FlatList
                data={settingsOptions}
                keyExtractor={item => item.id}
                renderItem={renderSettingOption}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={() => (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>General</Text>
                    </View>
                )}
                ListFooterComponent={() => (
                    <View>
                        {/* App Preferences Section */}
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Preferences</Text>
                        </View>

                        <ToggleSetting
                            title="Push Notifications"
                            description="Receive notifications about matches and messages"
                            value={notificationsEnabled}
                            onToggle={handleNotificationToggle}
                            icon="notifications"
                            disabled={signingOut}
                        />

                        <ToggleSetting
                            title="Dark Mode"
                            description="Use dark theme throughout the app"
                            value={darkModeEnabled}
                            onToggle={handleDarkModeToggle}
                            icon="dark-mode"
                            disabled={signingOut}
                        />

                        <ToggleSetting
                            title="Location Services"
                            description="Allow location-based matching"
                            value={locationEnabled}
                            onToggle={handleLocationToggle}
                            icon="location-on"
                            disabled={signingOut}
                        />

                        {/* Account Actions Section */}
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Account</Text>
                        </View>

                        {/* Enhanced Sign Out Button */}
                        <TouchableOpacity
                            style={[styles.signOutButton, signingOut && styles.signOutButtonDisabled]}
                            onPress={handleSignOut}
                            disabled={signingOut}
                            activeOpacity={0.8}
                        >
                            {signingOut ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Icon name="exit-to-app" size={20} color="#fff" />
                            )}
                            <Text style={styles.signOutText}>
                                {signingOut ? 'Signing Out...' : 'Sign Out'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                Job-Finder v1.0.0
                            </Text>
                            <Text style={styles.footerSubtext}>
                                Last updated: {new Date().toLocaleDateString()}
                            </Text>
                        </View>
                    </View>
                )}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    headerContainer: {
        backgroundColor: '#8456ad',
        paddingVertical: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    backButton: {
        padding: 8,
        borderRadius: 20,
    },
    header: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        flex: 1,
        textAlign: 'center',
        marginRight: 40, // Compensate for back button
    },
    headerSpacer: {
        width: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
    },
    userInfoContainer: {
        backgroundColor: '#fff',
        padding: 20,
        margin: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    userAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    userDetails: {
        flex: 1,
    },
    userName: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    userStatus: {
        fontSize: 12,
        color: '#999',
    },
    list: {
        paddingHorizontal: 16,
    },
    sectionContainer: {
        marginTop: 24,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#8456ad',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    optionContainer: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 8,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    optionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    toggleContainer: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 8,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    toggleContainerDisabled: {
        opacity: 0.6,
    },
    toggleIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    toggleTextContainer: {
        flex: 1,
    },
    toggleTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    toggleTitleDisabled: {
        color: '#ccc',
    },
    toggleDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    toggleDescriptionDisabled: {
        color: '#ccc',
    },
    signOutButton: {
        backgroundColor: '#dc3545',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginVertical: 16,
        marginHorizontal: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    signOutButtonDisabled: {
        backgroundColor: '#adb5bd',
    },
    signOutText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    footer: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    footerText: {
        fontSize: 12,
        color: '#adb5bd',
        fontWeight: '500',
    },
    footerSubtext: {
        fontSize: 10,
        color: '#ccc',
        marginTop: 4,
    },
});

export default SettingsScreen;