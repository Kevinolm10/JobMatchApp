// mapJobAdsToProfiles.js
// Maps job ads from fetchJobAds to the Profile interface expected by SwipeAlgorithm

// Default location for Sweden if no coordinates available
const DEFAULT_LOCATION = { latitude: 59.3293, longitude: 18.0686 }; // Stockholm

/**
 * Maps job ads to Profile format for SwipeAlgorithm
 * @param {any[]} jobAds - Raw job ads from the API
 * @returns {Profile[]} - Array of profiles matching SwipeAlgorithm interface
 */
const mapJobAdsToProfiles = (jobAds: any[]) => {
  if (!Array.isArray(jobAds)) {
    console.warn('mapJobAdsToProfiles: Expected array, got:', typeof jobAds);
    return [];
  }

  return jobAds
    .map((jobAd, index) => {
      try {
        // Extract company name - use employer name or workplace as fallback
        const companyName = jobAd.employer?.name ||
          jobAd.employer?.workplace ||
          jobAd.company ||
          "Company not specified";

        // Extract location name for display
        const locationName = jobAd.workplace_address?.city ||
          jobAd.workplace_address?.municipality ||
          jobAd.workplace_address?.region ||
          jobAd.workplaceAddress?.municipality ||
          jobAd.workplaceAddress?.region ||
          "Location not specified";

        // Extract coordinates for location matching
        let location = DEFAULT_LOCATION;

        if (jobAd.workplace_address?.coordinates &&
          Array.isArray(jobAd.workplace_address.coordinates) &&
          jobAd.workplace_address.coordinates.length >= 2) {
          location = {
            longitude: jobAd.workplace_address.coordinates[0],
            latitude: jobAd.workplace_address.coordinates[1]
          };
        } else if (jobAd.location?.latitude && jobAd.location?.longitude) {
          location = {
            latitude: jobAd.location.latitude,
            longitude: jobAd.location.longitude
          };
        }

        // Extract skills/requirements from multiple sources
        const skills = [];

        // From API structure (arbetsförmedlingen)
        if (jobAd.must_have?.skills) {
          jobAd.must_have.skills.forEach((skill: any) => {
            if (skill.label) skills.push(skill.label);
          });
        }

        if (jobAd.nice_to_have?.skills) {
          jobAd.nice_to_have.skills.forEach((skill: any) => {
            if (skill.label) skills.push(skill.label);
          });
        }

        // From work experience requirements
        if (jobAd.must_have?.work_experiences) {
          jobAd.must_have.work_experiences.forEach((exp: any) => {
            if (exp.label) skills.push(exp.label);
          });
        }

        if (jobAd.nice_to_have?.work_experiences) {
          jobAd.nice_to_have.work_experiences.forEach((exp: any) => {
            if (exp.label) skills.push(exp.label);
          });
        }

        // From processed job ads structure
        if (jobAd.skillsRequired && Array.isArray(jobAd.skillsRequired)) {
          skills.push(...jobAd.skillsRequired);
        }

        // Add occupation as a skill if no other skills found
        if (skills.length === 0 && jobAd.occupation?.label) {
          skills.push(jobAd.occupation.label);
        }

        // Add job title as skill if still no skills
        if (skills.length === 0) {
          const title = jobAd.headline || jobAd.title || '';
          if (title.toLowerCase().includes('barber')) {
            skills.push('Barbering', 'Hair cutting', 'Customer service');
          } else if (title.toLowerCase().includes('frisör')) {
            skills.push('Hair styling', 'Customer service', 'Hairdressing');
          } else if (title.toLowerCase().includes('developer')) {
            skills.push('Programming', 'Software development');
          } else {
            skills.push('Professional experience required');
          }
        }

        // Remove duplicates and clean up skills
        const uniqueSkills = [...new Set(skills)]
          .filter(skill => skill && typeof skill === 'string' && skill.trim().length > 0)
          .map(skill => skill.trim());

        // Ensure we have at least one skill
        if (uniqueSkills.length === 0) {
          uniqueSkills.push('Experience required');
        }

        // Extract contact email
        const email = jobAd.application_details?.email ||
          (jobAd.application_contacts?.[0]?.email) ||
          jobAd.contactEmail ||
          `contact@${companyName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.se`;

        // Extract phone number
        const phoneNumber = jobAd.application_details?.other ||
          (jobAd.application_contacts?.[0]?.telephone) ||
          jobAd.contactPhone ||
          '';

        // Map to Profile interface expected by SwipeAlgorithm
        const profile = {
          id: jobAd.id || `job_${Date.now()}_${index}`,
          image: jobAd.logo_url ||
            jobAd.image ||
            `https://via.placeholder.com/300x400/2563eb/ffffff?text=${encodeURIComponent(companyName)}`,
          firstName: companyName, // Company name displays as "name"
          lastName: "", // Empty for job cards
          email: email,
          skills: uniqueSkills.join(", "), // Join skills with commas for display
          experience: jobAd.headline || jobAd.title || "Job position available", // Job title displays as experience
          location: location, // Coordinates for distance calculation
          phoneNumber: phoneNumber,
          workCommitment: jobAd.working_hours_type?.label ||
            jobAd.employment_type?.label ||
            jobAd.employmentType ||
            "Full time",
          locationName: locationName, // For display
          score: jobAd.relevance || undefined, // For match percentage
          source: 'jobAd' // Flag to identify as job card
        };

        return profile;

      } catch (error) {
        console.warn('Error mapping job ad to profile:', error, jobAd);
        return null;
      }
    })
    .filter(profile => profile !== null); // Remove failed mappings
};

export default mapJobAdsToProfiles;