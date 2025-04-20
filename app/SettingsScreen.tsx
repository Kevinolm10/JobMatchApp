import { StackNavigationProp } from '@react-navigation/stack';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import React from 'react';
import { View, Text, FlatList, TextInput, Button, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, Keyboard, Switch } from 'react-native';
import { getAuth } from 'firebase/auth'; // Import Firebase Auth to handle sign out
import { RootStackParamList } from '../types';

type MainSwipeNavigationProp = StackNavigationProp<RootStackParamList, 'MainSwipe'>;

const SettingsScreen: React.FC = () => {
    const navigation = useNavigation<MainSwipeNavigationProp>();
    const auth = getAuth();

    const [notificationsEnabled, setNotificationsEnabled] = React.useState<boolean>(true);

    const handleToggleSwitch = () => setNotificationsEnabled(previousState => !previousState);

    const settingsOptions = [
        { id: '1', title: 'Profile', description: 'Edit your profile details' },
        { id: '2', title: 'Notifications', description: 'Manage your notifications' },
        { id: '3', title: 'Privacy', description: 'Control your privacy settings' },
        { id: '4', title: 'Help', description: 'Get help and support' },
    ];

    const renderSettingOption = ({ item }: { item: { id: string; title: string; description: string } }) => (
        <TouchableOpacity style={styles.optionContainer} onPress={() => console.log(`Navigating to ${item.title}`)}>
            <Text style={styles.optionTitle}>{item.title}</Text>
            <Text style={styles.optionDescription}>{item.description}</Text>
        </TouchableOpacity>
    );

    // Handle sign out
const handleSignOut = async () => {
    try {
        console.log("Attempting to sign out...");
        await auth.signOut();
        console.log("Signed out successfully!");
        navigation.navigate("HomeScreen");  // Ensure this is the correct route name
    } catch (error) {
        console.error("Error signing out: ", error);
    }
};


    return (
        <View style={styles.container}>
            {/* Header with some background and padding */}
            <View style={styles.headerContainer}>
                <Text style={styles.header}>Settings</Text>
            </View>

            {/* Settings List */}
            <FlatList
                data={settingsOptions}
                keyExtractor={(item) => item.id}
                renderItem={renderSettingOption}
                contentContainerStyle={styles.list}
            />

            {/* Notifications Toggle */}
            <View style={styles.notificationsContainer}>
                <Text style={styles.notificationsText}>Enable Notifications</Text>
                <Switch
                    value={notificationsEnabled}
                    onValueChange={handleToggleSwitch}
                    trackColor={{ false: '#ccc', true: '#4C4C9D' }}
                    thumbColor={notificationsEnabled ? '#fff' : '#f4f4f4'}
                />
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9f9f9',
    },
    headerContainer: {
        backgroundColor: '#4C4C9D',
        paddingVertical: 20,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    header: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    list: {
        paddingHorizontal: 16,
        marginTop: 20,
    },
    optionContainer: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        elevation: 3, // Adds shadow for Android
        shadowColor: '#000', // Shadow for iOS
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
    },
    optionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    optionDescription: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    notificationsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#ccc',
        backgroundColor: '#fff',
    },
    notificationsText: {
        fontSize: 16,
        color: '#333',
        flex: 1,
    },
    signOutButton: {
        backgroundColor: '#f44336', // Red color for sign-out button
        paddingVertical: 10,
        paddingHorizontal: 25,
        borderRadius: 25,
        marginTop: 20,
        marginBottom: 20,
        alignSelf: 'center',
    },
    signOutText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    backButton: {
        backgroundColor: '#4C4C9D',
        paddingVertical: 10,
        paddingHorizontal: 25,
        borderRadius: 25,
        marginTop: 10,
        marginBottom: 20,
        alignSelf: 'center',
    },
    backButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default SettingsScreen;
