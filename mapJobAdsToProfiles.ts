import { JobAdProfile } from "./fetchJobAds"; // Adjust the path based on your folder structure
import { Profile } from './app/MainSwipe'; // Adjust the path as needed

export const mapJobAdsToProfiles = (jobAds: any[]): Profile[] => {
  return jobAds.map((jobAd) => {
    const profile: Profile = {
      firstName: jobAd?.employer?.name || "Unknown Company",
      lastName: jobAd?.headline || "",
      email: jobAd?.application_details?.email || "Ej angiven",
      skills: jobAd?.must_have?.skills?.map((s: any) => s.label).join(", ") || "Not specified",
      experience: jobAd?.occupation?.label || "Not specified",
      location: {
        latitude: jobAd?.workplace_address?.coordinates?.[1] || 0,
        longitude: jobAd?.workplace_address?.coordinates?.[0] || 0,
      },
      phoneNumber: jobAd?.salary_type?.label || "N/A",
      workCommitment: jobAd?.employment_type?.label || "Not specified",
      image: jobAd?.logo_url || "https://cdn-icons-png.flaticon.com/512/847/847969.png",
    };

    return profile;
  });
};




