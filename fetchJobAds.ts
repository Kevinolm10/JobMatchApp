export interface JobAdProfile {
  id: string; // The unique identifier of the job ad
  title: string; // The title of the job ad
  company: string; // The company posting the job
  description: string; // The job description
  location?: { // Make location optional
    latitude: number;
    longitude: number;
  };
  skillsRequired: string[]; // List of skills required for the job
  postedDate: string; // Date the job ad was posted
  employmentType: string; // Full-time, part-time, etc.
  [key: string]: any; // Optional: to allow for additional properties
}

const getJobAds = async (query: string = "butik", _offset: number = 0, _limit: number = 1): Promise<any[]> => {
  const url = `https://jobsearch.api.jobtechdev.se/search?q=${query}`;

  try {
    const res = await fetch(url, {
      headers: {
        "accept": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch job ads for query '${query}': ${res.status}`);
    }

    const data = await res.json();

    if (!data?.hits || data.hits.length === 0) {
      console.warn(`No job ads found for query: ${query}`);
      return [];
    }

    // Return the full hits instead of mapping to a simplified object
    return data.hits;
  } catch (error) {
    console.error(`Error fetching job ads for query '${query}':`, error);
    return [];
  }
};


export default getJobAds;







