// Base interface with common properties
interface BaseProfile {
  id: string;
  email: string;
  image: string;
  location: {
    latitude: number;
    longitude: number;
    name: string; // Always include readable location name
    radius?: number; // How far they're willing to travel/hire (km)
  };
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// Standardized skill structure
export interface Skill {
  name: string;
  category: 'technical' | 'soft' | 'language' | 'certification' | 'industry';
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  verified?: boolean; // For future verification system
}

// Experience levels
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
export type WorkCommitment = 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship';

// Job seeker profile
export interface UserProfile extends BaseProfile {
  firstName: string;
  lastName: string;
  phoneNumber: string;

  // Professional info
  skills: Skill[]; // Standardized skill objects
  experienceLevel: ExperienceLevel;
  workCommitment: WorkCommitment[];
  salaryExpectation?: {
    min: number;
    max: number;
    currency: 'SEK' | 'EUR' | 'USD';
  };

  // Preferences for matching
  preferences: {
    industries: string[];
    companySize: ('startup' | 'small' | 'medium' | 'large' | 'enterprise')[];
    workArrangement: ('on-site' | 'hybrid' | 'remote')[];
    maxCommute: number; // km
  };

  // Portfolio/CV
  portfolio?: {
    website?: string;
    linkedin?: string;
    github?: string;
    resume?: string; // File URL
  };

  source: 'user';
  score?: number; // For internal ranking
}

// Business/Recruiter profile
export interface BusinessProfile extends BaseProfile {
  companyName: string;
  contactPerson: {
    firstName: string;
    lastName: string;
    title: string;
    phoneNumber: string;
  };

  // Company info
  industry: string;
  companySize: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  description: string;
  website?: string;

  // What they typically look for (for better matching)
  typicalRequirements: {
    skills: Skill[];
    experienceLevel: ExperienceLevel[];
    workCommitment: WorkCommitment[];
  };

  // Company culture/benefits for display
  benefits: string[];
  workArrangement: ('on-site' | 'hybrid' | 'remote')[];

  source: 'business';

  // Subscription/plan info
  subscriptionTier?: 'basic' | 'premium' | 'enterprise';
  activeJobsCount?: number;
}

// Job advertisement (from Arbetsförmedlingen + business users)
export interface JobProfile extends BaseProfile {
  // Display info
  title: string;
  companyName: string;

  // Job details
  description: string;
  requirements: {
    skills: Skill[];
    experienceLevel: ExperienceLevel[];
    education?: string[];
    certifications?: string[];
  };

  // Job terms
  workCommitment: WorkCommitment;
  workArrangement: 'on-site' | 'hybrid' | 'remote';
  salary?: {
    min?: number;
    max?: number;
    currency: 'SEK' | 'EUR' | 'USD';
    period: 'hourly' | 'monthly' | 'yearly';
  };

  // Matching metadata
  industry: string;
  applicationDeadline?: Date;
  startDate?: Date;

  // Source tracking
  source: 'jobAd';
  externalId?: string; // For Arbetsförmedlingen jobs
  businessUserId?: string; // If posted by business user

  // Relevance scoring
  score?: number;
  applicationUrl?: string;
}

// Unified type for matching algorithm
export type MatchableProfile = UserProfile | BusinessProfile | JobProfile;

// Helper functions for the matching algorithm
export const getProfileSkills = (profile: MatchableProfile): Skill[] => {
  switch (profile.source) {
    case 'user':
      return (profile as UserProfile).skills;
    case 'business':
      return (profile as BusinessProfile).typicalRequirements.skills;
    case 'jobAd':
      return (profile as JobProfile).requirements.skills;
    default:
      return [];
  }
};

export const getProfileLocation = (profile: MatchableProfile) => {
  return profile.location;
};

export const getDisplayName = (profile: MatchableProfile): string => {
  switch (profile.source) {
    case 'user':
      const user = profile as UserProfile;
      return `${user.firstName} ${user.lastName}`;
    case 'business':
      return (profile as BusinessProfile).companyName;
    case 'jobAd':
      return (profile as JobProfile).companyName;
    default:
      return 'Unknown';
  }
};

// Skills database for standardization
export const SKILL_CATEGORIES = {
  technical: [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java',
    'C#', 'PHP', 'SQL', 'MongoDB', 'PostgreSQL', 'AWS', 'Docker', 'Kubernetes'
  ],
  soft: [
    'Leadership', 'Communication', 'Problem Solving', 'Teamwork',
    'Project Management', 'Time Management', 'Creativity', 'Adaptability'
  ],
  language: [
    'Swedish', 'English', 'German', 'Spanish', 'French', 'Mandarin'
  ],
  industry: [
    'Healthcare', 'Finance', 'E-commerce', 'Gaming', 'EdTech', 'FinTech'
  ]
} as const;