import { JobAdProfile } from "./fetchJobAds"; // Adjust the path based on your folder structure
import { Profile } from '../components/SwipeAlgorithm'; // Adjust the path as needed

const mapJobAdsToProfiles = (jobAds: JobAdProfile[]): Profile[] => {
  return jobAds.map((jobAd) => ({
    id: jobAd.id,
    firstName: jobAd.title, // Using job title as a fake name
    lastName: jobAd.company || 'Unknown Company',
    email: 'jobad@example.com', // Placeholder
    phoneNumber: '', // Not available
    skills: jobAd?.must_have?.skills?.map((s: any) => s.label).join(", ") || "Not specified",
    experience: jobAd?.occupation?.label || "Not specified",
    image: 'https://via.placeholder.com/300', // Placeholder image
    location: jobAd.location || {
      latitude: 59.3293,
      longitude: 18.0686,
    },
    workCommitment: jobAd.employmentType || 'Unknown',
  }));
};




export default mapJobAdsToProfiles;


