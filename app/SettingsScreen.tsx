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

    // Monitor auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return unsubscribe;
    }, []);

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
            // TODO: Save to AsyncStorage or user preferences
            console.log('Notifications:', newValue ? 'enabled' : 'disabled');
            return newValue;
        });
    }, []);

    const handleDarkModeToggle = useCallback(() => {
        setDarkModeEnabled(prev => {
            const newValue = !prev;
            // TODO: Apply theme changes and save preference
            console.log('Dark mode:', newValue ? 'enabled' : 'disabled');
            return newValue;
        });
    }, []);

    const handleLocationToggle = useCallback(() => {
        setLocationEnabled(prev => {
            const newValue = !prev;
            // TODO: Update location permissions and save preference
            console.log('Location:', newValue ? 'enabled' : 'disabled');
            return newValue;
        });
    }, []);

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

    // Enhanced sign out with better UX and cleanup
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
                            console.log('🚪 Attempting to sign out...');

                            // Clear all cached data
                            await clearAllCache();
                            console.log('🧹 Cleared app cache');

                            // Sign out from Firebase
                            await signOut(auth);
                            console.log('✅ Signed out successfully!');

                            // Navigate to auth screen
                            router.replace('/');

                        } catch (error: any) {
                            console.error('❌ Error signing out:', error);
                            Alert.alert(
                                'Sign Out Failed',
                                error.message || 'Please try again.',
                                [{ text: 'OK', style: 'default' }]
                            );
                        } finally {
                            setSigningOut(false);
                        }
                    },
                },
            ],
            { cancelable: true }
        );
    }, []);

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

    // Enhanced toggle setting component
    const ToggleSetting = useCallback(({
        title,
        description,
        value,
        onToggle,
        icon
    }: {
        title: string;
        description: string;
        value: boolean;
        onToggle: () => void;
        icon: string;
    }) => (
        <View style={styles.toggleContainer}>
            <View style={styles.toggleIconContainer}>
                <Icon name={icon} size={24} color="#8456ad" />
            </View>
            <View style={styles.toggleTextContainer}>
                <Text style={styles.toggleTitle}>{title}</Text>
                <Text style={styles.toggleDescription}>{description}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: '#e0e0e0', true: '#8456ad' }}
                thumbColor={value ? '#ffffff' : '#f4f4f4'}
                ios_backgroundColor="#e0e0e0"
            />
        </View>
    ), []);

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
                        />

                        <ToggleSetting
                            title="Dark Mode"
                            description="Use dark theme throughout the app"
                            value={darkModeEnabled}
                            onToggle={handleDarkModeToggle}
                            icon="dark-mode"
                        />

                        <ToggleSetting
                            title="Location Services"
                            description="Allow location-based matching"
                            value={locationEnabled}
                            onToggle={handleLocationToggle}
                            icon="location-on"
                        />

                        {/* Account Actions Section */}
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Account</Text>
                        </View>

                        {/* Sign Out Button */}
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
                                TinderJob v1.0.0
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
    toggleDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
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
});

export default SettingsScreen;