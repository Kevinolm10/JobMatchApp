import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { View, Text, FlatList, TextInput, Button, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { RootStackParamList } from '../types';

type MainSwipeNavigationProp = StackNavigationProp<RootStackParamList, 'MainSwipe'>;

const MessagesScreen: React.FC = () => {

    const navigation = useNavigation<MainSwipeNavigationProp>();

    const matches = [
        { id: '1', name: 'John Doe', lastMessage: 'Hey, how are you?' },
        { id: '2', name: 'Jane Smith', lastMessage: 'Looking forward to working with you!' },
    ];

    const handleReply = (id: string) => {
        console.log(`Replying to match with id: ${id}`);
    };

    const renderMatch = ({ item }: { item: { id: string; name: string; lastMessage: string } }) => (
        <TouchableOpacity style={styles.matchContainer} onPress={() => handleReply(item.id)}>
            <Text style={styles.matchName}>{item.name}</Text>
            <Text style={styles.lastMessage}>{item.lastMessage}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Header with some background and padding */}
            <View style={styles.headerContainer}>
                <Text style={styles.header}>Messages</Text>
            </View>

            {/* Match List */}
            <FlatList
                data={matches}
                keyExtractor={(item) => item.id}
                renderItem={renderMatch}
                contentContainerStyle={styles.list}
            />

            {/* Reply Section */}
            <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
                <View style={styles.replyContainer}>
                    <TextInput style={styles.input} placeholder="Type your message..." />
                    <TouchableOpacity style={styles.sendButton} onPress={() => console.log('Message sent')}>
                        <Text style={styles.sendButtonText}>Send</Text>
                    </TouchableOpacity>
                </View>
            </TouchableWithoutFeedback>

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
    matchContainer: {
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
    matchName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    lastMessage: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    replyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#ccc',
        backgroundColor: '#fff',
    },
    input: {
        flex: 1,
        height: 45,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 25,
        paddingHorizontal: 16,
        fontSize: 16,
        marginRight: 10,
        backgroundColor: '#f1f1f1',
    },
    sendButton: {
        backgroundColor: '#4C4C9D',
        borderRadius: 25,
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    sendButtonText: {
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

export default MessagesScreen;
