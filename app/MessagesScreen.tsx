import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    FlatList,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
    StatusBar,
    Animated,
    Platform,
    KeyboardAvoidingView,
    Dimensions,
    Alert,
    RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../types';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../frontend/services/firebaseConfig';

type MessagesNavigationProp = StackNavigationProp<RootStackParamList, 'MessagesScreen'>;

Dimensions.get('window');

// Enhanced interfaces for better type safety
interface Match {
    id: string;
    name: string;
    company?: string;
    position?: string;
    lastMessage: string;
    timestamp: string;
    unreadCount: number;
    avatar?: string;
    isOnline: boolean;
    userType: 'regular' | 'business';
    matchedAt: string;
}

interface Message {
    id: string;
    matchId: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: string;
    type: 'text' | 'interview_request' | 'interview_response' | 'system';
    metadata?: {
        interviewDate?: string;
        interviewTime?: string;
        status?: 'pending' | 'accepted' | 'declined';
    };
}

const MessagesScreen: React.FC = () => {
    const navigation = useNavigation<MessagesNavigationProp>();

    // Enhanced state management
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Animation refs
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const messageFadeAnim = useRef(new Animated.Value(0)).current;

    // Refs for performance
    const messageInputRef = useRef<TextInput>(null);
    const flatListRef = useRef<FlatList>(null);

    // Monitor auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return unsubscribe;
    }, []);

    // Entrance animations
    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim]);

    // Message animation when chat opens
    useEffect(() => {
        if (selectedMatch) {
            messageFadeAnim.setValue(0);
            Animated.timing(messageFadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        }
    }, [selectedMatch, messageFadeAnim]);

    // Load initial data
    useEffect(() => {
        if (currentUser) {
            loadMatches();
        }
    }, [currentUser]);

    // Mock data loading - replace with real Firebase queries
    const loadMatches = useCallback(async () => {
        try {
            setLoading(true);

            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 800));

            // Mock data - replace with actual Firebase queries
            const mockMatches: Match[] = [
                {
                    id: '1',
                    name: 'John Andersson',
                    company: 'Tech Solutions AB',
                    position: 'Senior Developer',
                    lastMessage: 'Hej! Jag såg din profil och skulle gärna vilja träffa dig för en intervju.',
                    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                    unreadCount: 2,
                    isOnline: true,
                    userType: 'business',
                    matchedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
                },
                {
                    id: '2',
                    name: 'Emma Larsson',
                    company: 'Creative Agency',
                    position: 'UI/UX Designer',
                    lastMessage: 'Perfekt! Vilken dag passar dig bäst nästa vecka?',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
                    unreadCount: 0,
                    isOnline: false,
                    userType: 'business',
                    matchedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
                },
                {
                    id: '3',
                    name: 'Sara Johansson',
                    lastMessage: 'Tack för matchen! Ser fram emot att höra från dig.',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
                    unreadCount: 1,
                    isOnline: true,
                    userType: 'regular',
                    matchedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
                },
            ];

            setMatches(mockMatches);
        } catch (error) {
            console.error('Error loading matches:', error);
            Alert.alert('Fel', 'Kunde inte ladda meddelanden. Försök igen.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Load messages for selected match
    const loadMessages = useCallback(async (matchId: string) => {
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 300));

            // Mock messages
            const mockMessages: Message[] = [
                {
                    id: '1',
                    matchId,
                    senderId: 'other-user',
                    senderName: 'John Andersson',
                    content: 'Hej! Jag såg din profil och skulle gärna vilja träffa dig för en intervju.',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
                    type: 'text',
                },
                {
                    id: '2',
                    matchId,
                    senderId: currentUser?.uid || '',
                    senderName: 'Du',
                    content: 'Hej! Det låter intressant. Berätta mer om rollen.',
                    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                    type: 'text',
                },
                {
                    id: '3',
                    matchId,
                    senderId: 'other-user',
                    senderName: 'John Andersson',
                    content: 'Skulle du kunna träffa oss imorgon kl 14:00?',
                    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
                    type: 'interview_request',
                    metadata: {
                        interviewDate: '2025-06-10',
                        interviewTime: '14:00',
                        status: 'pending',
                    },
                },
            ];

            setMessages(mockMessages);
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }, [currentUser?.uid]);

    // Filtered matches based on search
    const filteredMatches = useMemo(() => {
        if (!searchQuery.trim()) return matches;

        return matches.filter(match =>
            match.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            match.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            match.position?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [matches, searchQuery]);

    // Handle match selection
    const handleSelectMatch = useCallback((match: Match) => {
        setSelectedMatch(match);
        loadMessages(match.id);

        // Mark messages as read
        setMatches(prev =>
            prev.map(m =>
                m.id === match.id ? { ...m, unreadCount: 0 } : m
            )
        );
    }, [loadMessages]);

    // Handle sending message
    const handleSendMessage = useCallback(async () => {
        if (!newMessage.trim() || !selectedMatch || sending) return;

        const messageText = newMessage.trim();
        setNewMessage('');
        setSending(true);

        try {
            // Optimistic update
            const tempMessage: Message = {
                id: `temp-${Date.now()}`,
                matchId: selectedMatch.id,
                senderId: currentUser?.uid || '',
                senderName: 'Du',
                content: messageText,
                timestamp: new Date().toISOString(),
                type: 'text',
            };

            setMessages(prev => [...prev, tempMessage]);

            // Update match's last message
            setMatches(prev =>
                prev.map(match =>
                    match.id === selectedMatch.id
                        ? { ...match, lastMessage: messageText, timestamp: new Date().toISOString() }
                        : match
                )
            );

            // Scroll to bottom
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));

            // Replace temp message with real one
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === tempMessage.id
                        ? { ...msg, id: `real-${Date.now()}` }
                        : msg
                )
            );

        } catch (error) {
            console.error('Error sending message:', error);
            Alert.alert('Fel', 'Kunde inte skicka meddelandet. Försök igen.');

            // Remove failed message
            setMessages(prev => prev.filter(msg => msg.id !== `temp-${Date.now()}`));
        } finally {
            setSending(false);
        }
    }, [newMessage, selectedMatch, currentUser?.uid, sending]);

    // Handle interview request response
    const handleInterviewResponse = useCallback((messageId: string, response: 'accepted' | 'declined') => {
        Alert.alert(
            response === 'accepted' ? 'Acceptera intervju' : 'Avböj intervju',
            response === 'accepted'
                ? 'Är du säker på att du vill acceptera denna intervju?'
                : 'Är du säker på att du vill avböja denna intervju?',
            [
                { text: 'Avbryt', style: 'cancel' },
                {
                    text: response === 'accepted' ? 'Acceptera' : 'Avböj',
                    style: response === 'accepted' ? 'default' : 'destructive',
                    onPress: () => {
                        setMessages(prev =>
                            prev.map(msg =>
                                msg.id === messageId && msg.metadata
                                    ? { ...msg, metadata: { ...msg.metadata, status: response } }
                                    : msg
                            )
                        );
                    },
                },
            ]
        );
    }, []);

    // Refresh handler
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadMatches();
        setRefreshing(false);
    }, [loadMatches]);

    // Format timestamp
    const formatTimestamp = useCallback((timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffHours < 1) {
            return `${Math.floor(diffMs / (1000 * 60))} min`;
        } else if (diffHours < 24) {
            return `${Math.floor(diffHours)} tim`;
        } else if (diffDays < 7) {
            return `${Math.floor(diffDays)} dag${Math.floor(diffDays) > 1 ? 'ar' : ''}`;
        } else {
            return date.toLocaleDateString('sv-SE');
        }
    }, []);

    // Render match item
    const renderMatch = useCallback(({ item }: { item: Match }) => (
        <TouchableOpacity
            style={[
                styles.matchContainer,
                selectedMatch?.id === item.id && styles.matchContainerSelected
            ]}
            onPress={() => handleSelectMatch(item)}
            activeOpacity={0.7}
        >
            <View style={styles.matchHeader}>
                <View style={styles.avatarContainer}>
                    <Icon
                        name={item.userType === 'business' ? 'business' : 'person'}
                        size={24}
                        color="#8456ad"
                    />
                    {item.isOnline && <View style={styles.onlineIndicator} />}
                </View>

                <View style={styles.matchContent}>
                    <View style={styles.matchTop}>
                        <Text style={styles.matchName} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Text style={styles.matchTime}>
                            {formatTimestamp(item.timestamp)}
                        </Text>
                    </View>

                    {item.company && (
                        <Text style={styles.matchCompany} numberOfLines={1}>
                            {item.company} • {item.position}
                        </Text>
                    )}

                    <View style={styles.matchBottom}>
                        <Text
                            style={[
                                styles.lastMessage,
                                item.unreadCount > 0 && styles.lastMessageUnread
                            ]}
                            numberOfLines={1}
                        >
                            {item.lastMessage}
                        </Text>
                        {item.unreadCount > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadCount}>
                                    {item.unreadCount > 9 ? '9+' : item.unreadCount}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    ), [selectedMatch?.id, handleSelectMatch, formatTimestamp]);

    // Render message item
    const renderMessage = useCallback(({ item }: { item: Message }) => {
        const isOwnMessage = item.senderId === currentUser?.uid;

        if (item.type === 'interview_request') {
            return (
                <View style={styles.interviewRequestContainer}>
                    <View style={styles.interviewRequestCard}>
                        <Icon name="event" size={24} color="#8456ad" style={styles.interviewIcon} />
                        <Text style={styles.interviewTitle}>Intervjuförfrågan</Text>
                        <Text style={styles.interviewContent}>{item.content}</Text>

                        {item.metadata && (
                            <View style={styles.interviewDetails}>
                                <Text style={styles.interviewDate}>
                                    📅 {new Date(item.metadata.interviewDate!).toLocaleDateString('sv-SE')}
                                </Text>
                                <Text style={styles.interviewTime}>
                                    🕐 {item.metadata.interviewTime}
                                </Text>
                            </View>
                        )}

                        {item.metadata?.status === 'pending' && !isOwnMessage && (
                            <View style={styles.interviewActions}>
                                <TouchableOpacity
                                    style={[styles.interviewButton, styles.acceptButton]}
                                    onPress={() => handleInterviewResponse(item.id, 'accepted')}
                                >
                                    <Text style={styles.acceptButtonText}>Acceptera</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.interviewButton, styles.declineButton]}
                                    onPress={() => handleInterviewResponse(item.id, 'declined')}
                                >
                                    <Text style={styles.declineButtonText}>Avböj</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {item.metadata?.status && item.metadata.status !== 'pending' && (
                            <View style={styles.interviewStatus}>
                                <Text style={[
                                    styles.statusText,
                                    item.metadata.status === 'accepted' ? styles.statusAccepted : styles.statusDeclined
                                ]}>
                                    {item.metadata.status === 'accepted' ? '✅ Accepterad' : '❌ Avböjd'}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            );
        }

        return (
            <View style={[
                styles.messageContainer,
                isOwnMessage ? styles.ownMessage : styles.otherMessage
            ]}>
                <Text style={[
                    styles.messageText,
                    isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                ]}>
                    {item.content}
                </Text>
                <Text style={[
                    styles.messageTimestamp,
                    isOwnMessage ? styles.ownMessageTimestamp : styles.otherMessageTimestamp
                ]}>
                    {formatTimestamp(item.timestamp)}
                </Text>
            </View>
        );
    }, [currentUser?.uid, handleInterviewResponse, formatTimestamp]);

    // Loading state
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#8456ad" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8456ad" />
                    <Text style={styles.loadingText}>Laddar meddelanden...</Text>
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
                    onPress={() => {
                        if (selectedMatch) {
                            setSelectedMatch(null);
                            setMessages([]);
                        } else {
                            navigation.goBack();
                        }
                    }}
                    activeOpacity={0.7}
                >
                    <Icon name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.header}>
                    {selectedMatch ? selectedMatch.name : 'Meddelanden'}
                </Text>

                {selectedMatch && (
                    <TouchableOpacity
                        style={styles.headerAction}
                        onPress={() => {
                            Alert.alert('Info', 'Profilinformation kommer snart');
                        }}
                    >
                        <Icon name="info" size={24} color="#fff" />
                    </TouchableOpacity>
                )}

                {!selectedMatch && (
                    <View style={styles.headerSpacer} />
                )}
            </View>

            {/* Content */}
            <Animated.View
                style={[
                    styles.content,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    },
                ]}
            >
                {!selectedMatch ? (
                    // Matches List
                    <View style={styles.matchesContainer}>
                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Sök meddelanden..."
                                placeholderTextColor="#999"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCorrect={false}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    style={styles.clearSearch}
                                    onPress={() => setSearchQuery('')}
                                >
                                    <Icon name="clear" size={20} color="#666" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Matches List */}
                        <FlatList
                            data={filteredMatches}
                            keyExtractor={item => item.id}
                            renderItem={renderMatch}
                            contentContainerStyle={styles.matchesList}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={handleRefresh}
                                    colors={['#8456ad']}
                                    tintColor="#8456ad"
                                />
                            }
                            ListEmptyComponent={() => (
                                <View style={styles.emptyContainer}>
                                    <Icon name="chat-bubble-outline" size={64} color="#ccc" />
                                    <Text style={styles.emptyText}>
                                        {searchQuery ? 'Inga matchande meddelanden' : 'Inga meddelanden än'}
                                    </Text>
                                    <Text style={styles.emptySubtext}>
                                        {searchQuery
                                            ? 'Försök med ett annat sökord'
                                            : 'Swipa för att hitta dina första matcher!'
                                        }
                                    </Text>
                                </View>
                            )}
                        />
                    </View>
                ) : (
                    // Chat View
                    <Animated.View style={[styles.chatContainer, { opacity: messageFadeAnim }]}>
                        {/* Messages List */}
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            keyExtractor={item => item.id}
                            renderItem={renderMessage}
                            contentContainerStyle={styles.messagesList}
                            showsVerticalScrollIndicator={false}
                            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        />

                        {/* Message Input */}
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                        >
                            <View style={styles.inputContainer}>
                                <TextInput
                                    ref={messageInputRef}
                                    style={styles.messageInput}
                                    placeholder="Skriv ett meddelande..."
                                    placeholderTextColor="#999"
                                    value={newMessage}
                                    onChangeText={setNewMessage}
                                    multiline
                                    maxLength={500}
                                    autoCorrect
                                />
                                <TouchableOpacity
                                    style={[
                                        styles.sendButton,
                                        (!newMessage.trim() || sending) && styles.sendButtonDisabled
                                    ]}
                                    onPress={handleSendMessage}
                                    disabled={!newMessage.trim() || sending}
                                    activeOpacity={0.7}
                                >
                                    {sending ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Icon name="send" size={20} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </Animated.View>
                )}
            </Animated.View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
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
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 16,
    },
    headerAction: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerSpacer: {
        width: 44,
    },
    content: {
        flex: 1,
    },
    matchesContainer: {
        flex: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        margin: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    clearSearch: {
        padding: 4,
    },
    matchesList: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    matchContainer: {
        backgroundColor: '#fff',
        marginBottom: 8,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    matchContainerSelected: {
        backgroundColor: '#f8f4ff',
        borderColor: '#8456ad',
        borderWidth: 1,
    },
    matchHeader: {
        flexDirection: 'row',
        padding: 16,
    },
    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        position: 'relative',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#4CAF50',
        borderWidth: 2,
        borderColor: '#fff',
    },
    matchContent: {
        flex: 1,
    },
    matchTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    matchName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        flex: 1,
    },
    matchTime: {
        fontSize: 12,
        color: '#999',
        marginLeft: 8,
    },
    matchCompany: {
        fontSize: 14,
        color: '#8456ad',
        marginBottom: 6,
    },
    matchBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastMessage: {
        fontSize: 14,
        color: '#666',
        flex: 1,
    },
    lastMessageUnread: {
        color: '#333',
        fontWeight: '500',
    },
    unreadBadge: {
        backgroundColor: '#8456ad',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    unreadCount: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#666',
        marginTop: 16,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        marginTop: 8,
        textAlign: 'center',
    },
    chatContainer: {
        flex: 1,
    },
    messagesList: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    messageContainer: {
        marginVertical: 4,
        maxWidth: '80%',
    },
    ownMessage: {
        alignSelf: 'flex-end',
    },
    otherMessage: {
        alignSelf: 'flex-start',
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 18,
    },
    ownMessageText: {
        backgroundColor: '#8456ad',
        color: '#fff',
        borderBottomRightRadius: 6,
    },
    otherMessageText: {
        backgroundColor: '#fff',
        color: '#333',
        borderBottomLeftRadius: 6,
    },
    messageTimestamp: {
        fontSize: 11,
        marginTop: 4,
        paddingHorizontal: 8,
    },
    ownMessageTimestamp: {
        color: '#8456ad',
        textAlign: 'right',
    },
    otherMessageTimestamp: {
        color: '#999',
        textAlign: 'left',
    },
    interviewRequestContainer: {
        marginVertical: 8,
        alignItems: 'center',
    },
    interviewRequestCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        maxWidth: '90%',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderLeftWidth: 4,
        borderLeftColor: '#8456ad',
    },
    interviewIcon: {
        alignSelf: 'center',
        marginBottom: 8,
    },
    interviewTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#8456ad',
        textAlign: 'center',
        marginBottom: 8,
    },
    interviewContent: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 22,
    },
    interviewDetails: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    interviewDate: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    interviewTime: {
        fontSize: 14,
        color: '#666',
    },
    interviewActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    interviewButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
    },
    acceptButton: {
        backgroundColor: '#4CAF50',
    },
    declineButton: {
        backgroundColor: '#f44336',
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    declineButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    interviewStatus: {
        alignItems: 'center',
        marginTop: 8,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    statusAccepted: {
        color: '#4CAF50',
    },
    statusDeclined: {
        color: '#f44336',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    messageInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginRight: 12,
        maxHeight: 100,
        fontSize: 16,
        backgroundColor: '#f8f9fa',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#8456ad',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    sendButtonDisabled: {
        backgroundColor: '#ccc',
    },
});

export default MessagesScreen;