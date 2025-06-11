import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Dimensions,
  ScrollView,
  Switch,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types";
import { StackNavigationProp } from "@react-navigation/stack";
import { StatusBar } from 'expo-status-bar';
import { db } from '../frontend/services/firebaseAuth'; // Adjust path as needed
import { storage } from '../frontend/services/firebaseConfig'; // Adjust path as needed
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import Icon from 'react-native-vector-icons/FontAwesome';
import {
  UserProfile,
  Skill,
  ExperienceLevel,
  WorkCommitment,
} from '../frontend/types/profiles';

type SignUpCardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignUpCardScreen'>;
type SignUpCardScreenRouteProp = RouteProp<RootStackParamList, 'SignUpCardScreen'>;

const { width, height } = Dimensions.get('window');

// Form data interface
interface FormData {
  // Basic info
  firstName: string;
  lastName: string;
  phoneNumber: string;
  image: string | null;
  location: { latitude: number; longitude: number; name: string } | null;

  // Professional info
  skills: Skill[];
  experienceLevel: ExperienceLevel;
  workCommitment: WorkCommitment[];
  salaryExpectation: {
    min: number;
    max: number;
    currency: 'SEK' | 'EUR' | 'USD';
  } | null;

  // Preferences
  preferences: {
    industries: string[];
    companySize: ('startup' | 'small' | 'medium' | 'large' | 'enterprise')[];
    workArrangement: ('on-site' | 'hybrid' | 'remote')[];
    maxCommute: number;
  };

  // Portfolio
  portfolio: {
    resume: string;
    website: string;
    linkedin: string;
    github: string;
  };
}

const PREDEFINED_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C#', 'PHP',
  'SQL', 'MongoDB', 'PostgreSQL', 'AWS', 'Docker', 'Kubernetes', 'Git',
  'HTML/CSS', 'Vue.js', 'Angular', 'Swift', 'Kotlin', 'Flutter', 'React Native',
  'Leadership', 'Project Management', 'Communication', 'Team Work', 'Problem Solving'
];

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'E-commerce', 'Gaming',
  'Consulting', 'Manufacturing', 'Real Estate', 'Media', 'Non-profit', 'Government'
];

const SignUpCardScreen: React.FC = () => {
  const navigation = useNavigation<SignUpCardScreenNavigationProp>();
  const route = useRoute<SignUpCardScreenRouteProp>();
  const { userId } = route.params;

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    image: null,
    location: null,
    skills: [],
    experienceLevel: 'mid',
    workCommitment: [],
    salaryExpectation: null,
    preferences: {
      industries: [],
      companySize: [],
      workArrangement: [],
      maxCommute: 25,
    },
    portfolio: {
      resume: '',
      website: '',
      linkedin: '',
      github: '',
    },
  });

  const [skillInput, setSkillInput] = useState('');
  const [showSalary, setShowSalary] = useState(false);

  // Resume upload states
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const updatePreferences = (updates: Partial<FormData['preferences']>) => {
    setFormData(prev => ({
      ...prev,
      preferences: { ...prev.preferences, ...updates }
    }));
  };

  const updatePortfolio = (updates: Partial<FormData['portfolio']>) => {
    setFormData(prev => ({
      ...prev,
      portfolio: { ...prev.portfolio, ...updates }
    }));
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      updateFormData({ image: result.assets[0].uri });
    }
  };

  const pickAndUploadResume = async () => {
    try {
      // Pick the document
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      // Check file size (limit to 10MB)
      const fileSize = result.assets?.[0]?.size || 0;
      if (fileSize > 10 * 1024 * 1024) {
        Alert.alert('File too large', 'Please select a file smaller than 10MB');
        return;
      }

      setResumeUploading(true);
      setResumeFileName(result.assets[0].name);

      // Create a unique file name
      const fileExtension = result.assets[0].name.split('.').pop();
      const fileName = `resumes/${userId}_${Date.now()}.${fileExtension}`;

      // Fetch the file to convert to blob
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();

      // Create storage reference
      const storageRef = ref(storage, fileName);

      // Upload file with progress monitoring
      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error('Upload error:', error);
          Alert.alert('Upload Failed', 'Failed to upload resume. Please try again.');
          setResumeUploading(false);
          setUploadProgress(0);
        },
        async () => {
          // Upload completed successfully
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            updatePortfolio({ resume: downloadURL });
            setResumeUploading(false);
            setUploadProgress(0);
            Alert.alert('Success', 'Resume uploaded successfully!');
          } catch (error) {
            console.error('Error getting download URL:', error);
            Alert.alert('Error', 'Failed to get resume URL');
            setResumeUploading(false);
            setUploadProgress(0);
          }
        }
      );
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document');
      setResumeUploading(false);
    }
  };

  const removeResume = async () => {
    Alert.alert(
      'Remove Resume',
      'Are you sure you want to remove your resume?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // If there's a URL, try to delete from storage
              if (formData.portfolio.resume) {
                // Extract the file path from the URL
                const url = formData.portfolio.resume;
                const baseUrl = 'https://firebasestorage.googleapis.com/v0/b/';
                const startIndex = url.indexOf('/o/') + 3;
                const endIndex = url.indexOf('?');
                const filePath = decodeURIComponent(url.substring(startIndex, endIndex));

                const fileRef = ref(storage, filePath);
                await deleteObject(fileRef).catch(console.error);
              }

              updatePortfolio({ resume: '' });
              setResumeFileName(null);
              Alert.alert('Success', 'Resume removed');
            } catch (error) {
              console.error('Error removing resume:', error);
              Alert.alert('Error', 'Failed to remove resume');
            }
          },
        },
      ]
    );
  };

  const getUserLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission to access location was denied');
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    const geocode = await Location.reverseGeocodeAsync(location.coords);

    let locationName = 'Unknown location';
    if (geocode.length > 0) {
      const address = geocode[0];
      locationName = `${address.city}, ${address.region}, ${address.country}`;
    }

    updateFormData({
      location: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        name: locationName,
      }
    });
  };

  const addSkill = (skillName: string, category: 'technical' | 'soft' = 'technical') => {
    const skill: Skill = {
      name: skillName.trim(),
      category,
      level: 'intermediate',
      verified: false,
    };

    if (skill.name && !formData.skills.some(s => s.name.toLowerCase() === skill.name.toLowerCase())) {
      updateFormData({ skills: [...formData.skills, skill] });
    }
    setSkillInput('');
  };

  const removeSkill = (skillName: string) => {
    updateFormData({
      skills: formData.skills.filter(s => s.name !== skillName)
    });
  };

  const toggleArrayItem = <T,>(array: T[], item: T, setter: (newArray: T[]) => void) => {
    if (array.includes(item)) {
      setter(array.filter(i => i !== item));
    } else {
      setter([...array, item]);
    }
  };

  const validateCurrentStep = (): { isValid: boolean; message?: string } => {
    switch (currentStep) {
      case 1:
        if (!formData.firstName) return { isValid: false, message: 'Please enter your first name' };
        if (!formData.lastName) return { isValid: false, message: 'Please enter your last name' };
        if (!formData.phoneNumber) return { isValid: false, message: 'Please enter your phone number' };
        if (!formData.location) return { isValid: false, message: 'Please set your location' };
        return { isValid: true };
      case 2:
        if (formData.skills.length === 0) return { isValid: false, message: 'Please select at least one skill' };
        if (formData.workCommitment.length === 0) return { isValid: false, message: 'Please select at least one work commitment type' };
        return { isValid: true };
      case 3:
        if (formData.preferences.industries.length === 0) return { isValid: false, message: 'Please select at least one preferred industry' };
        if (formData.preferences.workArrangement.length === 0) return { isValid: false, message: 'Please select at least one work arrangement' };
        return { isValid: true };
      case 4:
        return { isValid: true }; // Portfolio is optional
      default:
        return { isValid: false };
    }
  };

  const nextStep = () => {
    const validation = validateCurrentStep();
    if (validation.isValid) {
      setCurrentStep(prev => prev + 1);
    } else {
      Alert.alert('Missing Information', validation.message || 'Please fill in all required fields');
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleFinish = async () => {
    try {
      // Create the user profile data
      const userData: Partial<UserProfile> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        image: formData.image || '',
        location: formData.location || {
          latitude: 59.3293,
          longitude: 18.0686,
          name: 'Stockholm, Sweden'
        },
        skills: formData.skills,
        experienceLevel: formData.experienceLevel,
        workCommitment: formData.workCommitment,
        salaryExpectation: formData.salaryExpectation || undefined,
        preferences: formData.preferences,
        portfolio: Object.values(formData.portfolio).some(v => v) ? formData.portfolio : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        source: 'user',
      };

      // Remove undefined values before saving
      const cleanedData = Object.entries(userData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      // Use setDoc with merge option
      const userRef = doc(db, "users", userId);
      await setDoc(userRef, cleanedData, { merge: true });

      // Verify the data was saved
      const savedDoc = await getDoc(userRef);
      if (savedDoc.exists()) {
        console.log('User profile saved successfully:', savedDoc.data());
        Alert.alert('Success', 'Profile created successfully!', [
          { text: 'OK', onPress: () => navigation.navigate("MainSwipe", { userId }) }
        ]);
      } else {
        throw new Error('Failed to save user profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert("Error", (error as any).message);
    }
  };

  const renderStep1 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Basic Information</Text>

      <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
        {formData.image ? (
          <Image source={{ uri: formData.image }} style={styles.image} />
        ) : (
          <Text style={styles.imagePickerText}>Add Profile Photo</Text>
        )}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="First Name *"
        placeholderTextColor="#aaa"
        value={formData.firstName}
        onChangeText={(text) => updateFormData({ firstName: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="Last Name *"
        placeholderTextColor="#aaa"
        value={formData.lastName}
        onChangeText={(text) => updateFormData({ lastName: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="Phone Number *"
        placeholderTextColor="#aaa"
        value={formData.phoneNumber}
        onChangeText={(text) => updateFormData({ phoneNumber: text })}
        keyboardType="phone-pad"
      />

      <TouchableOpacity style={styles.locationButton} onPress={getUserLocation}>
        <Text style={styles.locationButtonText}>
          {formData.location ? '📍 Location Set' : 'Get Current Location *'}
        </Text>
      </TouchableOpacity>

      {formData.location && (
        <Text style={styles.locationText}>{formData.location.name}</Text>
      )}
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Professional Information</Text>

      <Text style={styles.sectionTitle}>Experience Level *</Text>
      <View style={styles.optionsContainer}>
        {(['entry', 'mid', 'senior', 'lead', 'executive'] as ExperienceLevel[]).map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.optionButton,
              formData.experienceLevel === level && styles.selectedOption,
            ]}
            onPress={() => updateFormData({ experienceLevel: level })}
          >
            <Text style={[
              styles.optionText,
              formData.experienceLevel === level && styles.selectedOptionText
            ]}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Skills * (Select at least one)</Text>
      <Text style={styles.helperText}>Tap skills below or add custom ones</Text>
      <View style={styles.skillsContainer}>
        {PREDEFINED_SKILLS.map((skill) => (
          <TouchableOpacity
            key={skill}
            style={[
              styles.skillChip,
              formData.skills.some(s => s.name === skill) && styles.selectedSkill,
            ]}
            onPress={() => {
              if (formData.skills.some(s => s.name === skill)) {
                removeSkill(skill);
              } else {
                addSkill(skill);
              }
            }}
          >
            <Text style={[
              styles.skillText,
              formData.skills.some(s => s.name === skill) && styles.selectedSkillText
            ]}>
              {skill}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.customSkillContainer}>
        <TextInput
          style={styles.skillInput}
          placeholder="Add custom skill"
          placeholderTextColor="#aaa"
          value={skillInput}
          onChangeText={setSkillInput}
          onSubmitEditing={() => addSkill(skillInput)}
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => addSkill(skillInput)}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Work Commitment * (Select at least one)</Text>
      <Text style={styles.helperText}>What type of work are you looking for?</Text>
      <View style={styles.optionsContainer}>
        {(['full-time', 'part-time', 'contract', 'freelance', 'internship'] as WorkCommitment[]).map((commitment) => (
          <TouchableOpacity
            key={commitment}
            style={[
              styles.optionButton,
              formData.workCommitment.includes(commitment) && styles.selectedOption,
            ]}
            onPress={() => toggleArrayItem(
              formData.workCommitment,
              commitment,
              (newArray) => updateFormData({ workCommitment: newArray })
            )}
          >
            <Text style={[
              styles.optionText,
              formData.workCommitment.includes(commitment) && styles.selectedOptionText
            ]}>
              {commitment.charAt(0).toUpperCase() + commitment.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.salaryContainer}>
        <View style={styles.salaryHeader}>
          <Text style={styles.sectionTitle}>Salary Expectation</Text>
          <Switch
            value={showSalary}
            onValueChange={(value) => {
              setShowSalary(value);
              if (!value) {
                updateFormData({ salaryExpectation: null });
              } else {
                updateFormData({
                  salaryExpectation: { min: 0, max: 0, currency: 'SEK' }
                });
              }
            }}
          />
        </View>

        {showSalary && (
          <View style={styles.salaryInputs}>
            <TextInput
              style={[styles.input, styles.salaryInput]}
              placeholder="Min salary"
              value={formData.salaryExpectation?.min?.toString() || ''}
              onChangeText={(text) => updateFormData({
                salaryExpectation: {
                  ...formData.salaryExpectation!,
                  min: parseInt(text) || 0
                }
              })}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, styles.salaryInput]}
              placeholder="Max salary"
              value={formData.salaryExpectation?.max?.toString() || ''}
              onChangeText={(text) => updateFormData({
                salaryExpectation: {
                  ...formData.salaryExpectation!,
                  max: parseInt(text) || 0
                }
              })}
              keyboardType="numeric"
            />
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderStep3 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Preferences</Text>

      <Text style={styles.sectionTitle}>Preferred Industries *</Text>
      <View style={styles.optionsContainer}>
        {INDUSTRIES.map((industry) => (
          <TouchableOpacity
            key={industry}
            style={[
              styles.optionButton,
              formData.preferences.industries.includes(industry) && styles.selectedOption,
            ]}
            onPress={() => toggleArrayItem(
              formData.preferences.industries,
              industry,
              (newArray) => updatePreferences({ industries: newArray })
            )}
          >
            <Text style={[
              styles.optionText,
              formData.preferences.industries.includes(industry) && styles.selectedOptionText
            ]}>
              {industry}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Company Size</Text>
      <View style={styles.optionsContainer}>
        {(['startup', 'small', 'medium', 'large', 'enterprise'] as const).map((size) => (
          <TouchableOpacity
            key={size}
            style={[
              styles.optionButton,
              formData.preferences.companySize.includes(size) && styles.selectedOption,
            ]}
            onPress={() => toggleArrayItem(
              formData.preferences.companySize,
              size,
              (newArray) => updatePreferences({ companySize: newArray })
            )}
          >
            <Text style={[
              styles.optionText,
              formData.preferences.companySize.includes(size) && styles.selectedOptionText
            ]}>
              {size.charAt(0).toUpperCase() + size.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Work Arrangement *</Text>
      <View style={styles.optionsContainer}>
        {(['on-site', 'hybrid', 'remote'] as const).map((arrangement) => (
          <TouchableOpacity
            key={arrangement}
            style={[
              styles.optionButton,
              formData.preferences.workArrangement.includes(arrangement) && styles.selectedOption,
            ]}
            onPress={() => toggleArrayItem(
              formData.preferences.workArrangement,
              arrangement,
              (newArray) => updatePreferences({ workArrangement: newArray })
            )}
          >
            <Text style={[
              styles.optionText,
              formData.preferences.workArrangement.includes(arrangement) && styles.selectedOptionText
            ]}>
              {arrangement.charAt(0).toUpperCase() + arrangement.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Max Commute Distance</Text>
      <View style={styles.commuteContainer}>
        <Text style={styles.commuteValue}>{formData.preferences.maxCommute} km</Text>
        <View style={styles.commuteButtons}>
          {[10, 25, 50, 100].map((distance) => (
            <TouchableOpacity
              key={distance}
              style={[
                styles.commuteButton,
                formData.preferences.maxCommute === distance && styles.selectedOption,
              ]}
              onPress={() => updatePreferences({ maxCommute: distance })}
            >
              <Text style={[
                styles.commuteButtonText,
                formData.preferences.maxCommute === distance && styles.selectedOptionText
              ]}>
                {distance}km
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Portfolio & Links</Text>
      <Text style={styles.subtitle}>Optional - Add your professional links</Text>

      <TextInput
        style={styles.input}
        placeholder="Website URL"
        placeholderTextColor="#aaa"
        value={formData.portfolio.website}
        onChangeText={(text) => updatePortfolio({ website: text })}
        autoCapitalize="none"
        keyboardType="url"
      />

      <TextInput
        style={styles.input}
        placeholder="LinkedIn Profile"
        placeholderTextColor="#aaa"
        value={formData.portfolio.linkedin}
        onChangeText={(text) => updatePortfolio({ linkedin: text })}
        autoCapitalize="none"
        keyboardType="url"
      />

      <TextInput
        style={styles.input}
        placeholder="GitHub Profile"
        placeholderTextColor="#aaa"
        value={formData.portfolio.github}
        onChangeText={(text) => updatePortfolio({ github: text })}
        autoCapitalize="none"
        keyboardType="url"
      />

      {/* Resume Upload Section */}
      <View style={styles.resumeSection}>
        <Text style={styles.resumeLabel}>Resume/CV</Text>

        {!formData.portfolio.resume ? (
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={pickAndUploadResume}
            disabled={resumeUploading}
          >
            {resumeUploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="small" color="#8456ad" />
                <Text style={styles.uploadingText}>Uploading... {uploadProgress}%</Text>
              </View>
            ) : (
              <>
                <Icon name="upload" size={20} color="#8456ad" />
                <Text style={styles.uploadButtonText}>Upload Resume (PDF/DOC)</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.resumeContainer}>
            <View style={styles.resumeInfo}>
              <Icon name="file-pdf-o" size={24} color="#8456ad" />
              <Text style={styles.resumeFileName} numberOfLines={1}>
                {resumeFileName || 'Resume uploaded'}
              </Text>
            </View>
            <TouchableOpacity onPress={removeResume} style={styles.removeButton}>
              <Icon name="times" size={20} color="#ff4444" />
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.resumeHelperText}>
          Max file size: 10MB • Formats: PDF, DOC, DOCX
        </Text>
      </View>

      <Text style={styles.portfolioNote}>
        💡 Adding portfolio links and resume helps employers find you and increases your match quality!
      </Text>
    </ScrollView>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.backgroundOverlay} />

      <View style={styles.content}>
        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4].map((step) => (
            <View
              key={step}
              style={[
                styles.progressDot,
                step <= currentStep ? styles.activeProgressDot : styles.inactiveProgressDot,
              ]}
            />
          ))}
        </View>

        {renderCurrentStep()}

        {/* Navigation buttons */}
        <View style={styles.navigationContainer}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.navButton} onPress={prevStep}>
              <Text style={styles.navButtonText}>Previous</Text>
            </TouchableOpacity>
          )}

          {currentStep < 4 ? (
            <TouchableOpacity
              style={[styles.navButton, styles.primaryNavButton]}
              onPress={nextStep}
            >
              <Text style={[styles.navButtonText, styles.primaryNavButtonText]}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navButton, styles.finishButton]}
              onPress={handleFinish}
            >
              <Text style={[styles.navButtonText, styles.finishButtonText]}>Create Profile</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
    backgroundColor: '#8456ad',
    zIndex: -1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 8,
  },
  activeProgressDot: {
    backgroundColor: '#fff',
  },
  inactiveProgressDot: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  stepContainer: {
    flex: 1,
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    marginTop: 20,
    color: '#fff',
  },
  helperText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  imagePicker: {
    alignSelf: 'center',
    marginBottom: 30,
    width: 120,
    height: 120,
    borderWidth: 2,
    borderColor: '#fff',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 60,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  imagePickerText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.9)',
    color: '#333',
  },
  locationButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  locationButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
  locationText: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 15,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  optionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    margin: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  selectedOption: {
    backgroundColor: '#fff',
  },
  optionText: {
    color: '#fff',
    fontSize: 14,
  },
  selectedOptionText: {
    color: '#8456ad',
    fontWeight: '600',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  skillChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    margin: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  selectedSkill: {
    backgroundColor: '#fff',
  },
  skillText: {
    color: '#fff',
    fontSize: 12,
  },
  selectedSkillText: {
    color: '#8456ad',
    fontWeight: '600',
  },
  customSkillContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  skillInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    color: '#333',
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 8,
  },
  addButtonText: {
    color: '#8456ad',
    fontWeight: '600',
  },
  salaryContainer: {
    marginTop: 10,
  },
  salaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  salaryInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  salaryInput: {
    flex: 1,
  },
  commuteContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  commuteValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  commuteButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  commuteButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 15,
    margin: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  commuteButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  portfolioNote: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 30,
    paddingHorizontal: 10,
  },
  navButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  primaryNavButton: {
    backgroundColor: '#fff',
  },
  finishButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
    marginLeft: 10,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryNavButtonText: {
    color: '#8456ad',
  },
  finishButtonText: {
    color: '#fff',
  },
  // Resume upload styles
  resumeSection: {
    marginTop: 15,
    marginBottom: 15,
  },
  resumeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  uploadButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  uploadButtonText: {
    color: '#8456ad',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#8456ad',
    fontSize: 16,
    marginLeft: 10,
  },
  resumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 15,
    borderRadius: 8,
    justifyContent: 'space-between',
  },
  resumeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  resumeFileName: {
    color: '#333',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  removeButton: {
    padding: 5,
  },
  resumeHelperText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SignUpCardScreen;