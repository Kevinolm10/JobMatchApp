import haversine from 'haversine-distance';

interface Profile {
  image: string;
  firstName: string;
  lastName: string;
  email: string;
  skills: string;
  experience: string;
  location: {
    latitude: number;
    longitude: number;
  };
  phoneNumber: string;
  workCommitment: string;
  locationName?: string; // Lägg till för att hantera platsnamn
}

const defaultLocation = { latitude: 59.3293, longitude: 18.0686 }; // Stockholm

const parseLocation = (location: string | { latitude: number, longitude: number }) => {
  if (typeof location === 'string') {
    console.warn(`Address provided instead of latitude/longitude: ${location}`);
    return defaultLocation;
  }
  return location ?? defaultLocation;
};

export const matchProfiles = (userProfile: Profile, profiles: Profile[]): Profile[] => {
  return profiles
    .map(profile => {
      const userLocation = parseLocation(userProfile.location);
      const profileLocation = parseLocation(profile.location);

      if (!userLocation.latitude || !userLocation.longitude || !profileLocation.latitude || !profileLocation.longitude) {
        console.warn("Invalid location data, using default location for distance calculation");
        return { ...profile, score: NaN };
      }

      const distance = haversine(userLocation, profileLocation) / 1000; // km
      const skillMatch = userProfile.skills === profile.skills ? 1 : 0;
      const commitmentMatch = userProfile.workCommitment === profile.workCommitment ? 1 : 0;
      const score = (1 / (1 + distance)) + skillMatch + commitmentMatch;

      console.log({
        Distance: `${distance.toFixed(2)} km`,
        SkillMatch: skillMatch,
        CommitmentMatch: commitmentMatch,
        Score: score.toFixed(2),
      });

      return { ...profile, score };
    })
    .sort((a, b) => b.score - a.score);
};
