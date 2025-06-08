import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';

type ProfileInfoScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainSwipe'>;

const ProfileInfoScreen: React.FC = () => {
    const navigation = useNavigation<ProfileInfoScreenNavigationProp>();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Update Profile Information</Text>
            {/* Add your form fields here, like TextInput for location, phone, etc. */}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
});

export default ProfileInfoScreen;
