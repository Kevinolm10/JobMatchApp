// Enhanced job ads fetching with caching, rate limiting, and better error handling

export interface JobAdProfile {
  id: string;
  title: string;
  company: string;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  skillsRequired: string[];
  postedDate: string;
  employmentType: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  workplaceAddress?: {
    municipality?: string;
    region?: string;
    country?: string;
  };
  [key: string]: any;
}

interface JobAdsCache {
  [key: string]: {
    data: any[];
    timestamp: number;
    query: string;
  };
}

interface JobAdsResponse {
  jobAds: any[];
  hasMore: boolean;
  error: string | null;
  fromCache?: boolean;
}

// Configuration
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT = 15000; // 15 seconds
const DEFAULT_LIMIT = 20;

// In-memory cache for job ads
const jobAdsCache: JobAdsCache = {};
let lastRequestTime = 0;

// Generate cache key
const getCacheKey = (skills: string, offset: number, limit: number): string => {
  const normalizedSkills = normalizeSkillsQuery(skills);
  return `${normalizedSkills}_${offset}_${limit}`;
};

// Normalize skills query for better caching and API calls
const normalizeSkillsQuery = (skills: string): string => {
  if (!skills || skills.trim().length === 0) return '';

  return skills
    .split(',')
    .map(skill => skill.trim().toLowerCase())
    .filter(skill => skill.length > 0)
    .sort() // Sort for consistent cache keys
    .join(',');
};

// Check if cache is valid
const isCacheValid = (cacheEntry: { timestamp: number }): boolean => {
  return Date.now() - cacheEntry.timestamp < CACHE_DURATION;
};

// Rate limiting
const enforceRateLimit = async (): Promise<void> => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    const delay = RATE_LIMIT_DELAY - timeSinceLastRequest;
    console.log(`⏳ Rate limiting: waiting ${delay}ms before job ads request`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  lastRequestTime = Date.now();
};

// Enhanced job ads fetching with comprehensive error handling
const fetchJobAdsFromAPI = async (
  skills: string = "",
  offset: number = 0,
  limit: number = DEFAULT_LIMIT,
  retryCount: number = 0
): Promise<any[]> => {
  try {
    await enforceRateLimit();

    const sanitizedQuery = normalizeSkillsQuery(skills);

    if (!sanitizedQuery) {
      console.warn('No valid skills provided for job search');
      return [];
    }

    // Build query with proper encoding
    const searchQuery = sanitizedQuery.split(',').join(' OR '); // Use OR for better matching
    const url = `https://jobsearch.api.jobtechdev.se/search?q=${encodeURIComponent(searchQuery)}&limit=${limit}&offset=${offset}`;

    console.log(`🔍 Fetching job ads: "${searchQuery}" (offset: ${offset}, limit: ${limit})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      headers: {
        "accept": "application/json",
        "User-Agent": "TinderJobApp/1.0 (job-matching-service)"
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data?.hits) {
      throw new Error('Invalid API response format');
    }

    console.log(`✅ Fetched ${data.hits.length} job ads for query: "${searchQuery}"`);
    return data.hits || [];

  } catch (error: any) {
    console.error(`❌ Job ads API error (attempt ${retryCount + 1}):`, error);

    // Handle specific error types
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - job ads service is slow');
    }

    // Retry logic with exponential backoff
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`🔄 Retrying job ads fetch in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchJobAdsFromAPI(skills, offset, limit, retryCount + 1);
    }

    throw error;
  }
};

// Process and enhance raw job ads data
const processJobAds = (rawJobAds: any[]): JobAdProfile[] => {
  return rawJobAds
    .map((jobAd, index) => {
      try {
        // Extract and normalize job ad data
        const processed: JobAdProfile = {
          id: jobAd.id || `job_${Date.now()}_${index}`,
          title: jobAd.headline?.text || jobAd.occupation?.label || 'No Title',
          company: jobAd.employer?.name || 'Unknown Company',
          description: jobAd.description?.text || jobAd.description?.text_formatted || '',
          employmentType: jobAd.employment_type?.label || 'Not specified',
          postedDate: jobAd.publication_date || new Date().toISOString(),
          skillsRequired: [],
        };

        // Extract skills/requirements
        if (jobAd.must_have?.skills) {
          processed.skillsRequired = jobAd.must_have.skills.map((skill: any) =>
            skill.label || skill.concept_id || skill
          );
        } else if (jobAd.nice_to_have?.skills) {
          processed.skillsRequired = jobAd.nice_to_have.skills.map((skill: any) =>
            skill.label || skill.concept_id || skill
          );
        }

        // Extract location information
        if (jobAd.workplace_address) {
          const address = jobAd.workplace_address;
          processed.workplaceAddress = {
            municipality: address.municipality,
            region: address.region,
            country: address.country || 'Sweden'
          };

          // Try to extract coordinates if available
          if (address.coordinates && Array.isArray(address.coordinates) && address.coordinates.length >= 2) {
            processed.location = {
              longitude: address.coordinates[0],
              latitude: address.coordinates[1]
            };
          }
        }

        // Extract salary information if available
        if (jobAd.salary_type || jobAd.salary_description) {
          processed.salary = {
            currency: 'SEK', // Default for Swedish jobs
            // Add more salary parsing logic here if needed
          };
        }

        // Add any additional fields
        processed.source = 'arbetsformedlingen';
        processed.url = jobAd.webpage_url;
        processed.application_deadline = jobAd.application_deadline;

        return processed;
      } catch (error) {
        console.warn('Error processing job ad:', error);
        return null;
      }
    })
    .filter((jobAd): jobAd is JobAdProfile => jobAd !== null);
};

// Main enhanced getJobAds function (backward compatible)
const getJobAds = async (
  skills: string = "",
  offset: number = 0,
  limit: number = DEFAULT_LIMIT
): Promise<any[]> => {
  try {
    const result = await getJobAdsEnhanced(skills, offset, limit);
    return result.jobAds;
  } catch (error) {
    console.error('getJobAds error:', error);
    return [];
  }
};

// Enhanced version with detailed response
export const getJobAdsEnhanced = async (
  skills: string = "",
  offset: number = 0,
  limit: number = DEFAULT_LIMIT
): Promise<JobAdsResponse> => {
  try {
    // Input validation
    if (limit <= 0 || limit > 100) {
      console.warn('Invalid limit, using default:', DEFAULT_LIMIT);
      limit = DEFAULT_LIMIT;
    }

    if (offset < 0) {
      console.warn('Invalid offset, using 0');
      offset = 0;
    }

    const cacheKey = getCacheKey(skills, offset, limit);

    // Check cache first
    if (jobAdsCache[cacheKey] && isCacheValid(jobAdsCache[cacheKey])) {
      console.log(`💾 Using cached job ads for: "${skills}"`);
      return {
        jobAds: jobAdsCache[cacheKey].data,
        hasMore: jobAdsCache[cacheKey].data.length === limit,
        error: null,
        fromCache: true
      };
    }

    // Fetch from API
    const rawJobAds = await fetchJobAdsFromAPI(skills, offset, limit);
    const processedJobAds = processJobAds(rawJobAds);

    // Cache the results
    jobAdsCache[cacheKey] = {
      data: processedJobAds,
      timestamp: Date.now(),
      query: skills
    };

    // Clean old cache entries periodically
    cleanupJobAdsCache();

    return {
      jobAds: processedJobAds,
      hasMore: processedJobAds.length === limit,
      error: null,
      fromCache: false
    };

  } catch (error: any) {
    console.error('Enhanced job ads fetch error:', error);

    return {
      jobAds: [],
      hasMore: false,
      error: error.message || 'Failed to fetch job ads',
      fromCache: false
    };
  }
};

// Batch job ads fetching for multiple skill sets
export const getBatchJobAds = async (
  skillSets: string[],
  limit: number = DEFAULT_LIMIT
): Promise<{ [skillSet: string]: JobAdProfile[] }> => {
  const results: { [skillSet: string]: JobAdProfile[] } = {};

  // Process requests with delay to respect rate limits
  for (let i = 0; i < skillSets.length; i++) {
    try {
      const skillSet = skillSets[i];
      const response = await getJobAdsEnhanced(skillSet, 0, limit);
      results[skillSet] = response.jobAds;

      // Add delay between requests (except for the last one)
      if (i < skillSets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
    } catch (error) {
      console.error(`Error fetching jobs for skill set "${skillSets[i]}":`, error);
      results[skillSets[i]] = [];
    }
  }

  return results;
};

// Cache management utilities
export const clearJobAdsCache = (): void => {
  Object.keys(jobAdsCache).forEach(key => delete jobAdsCache[key]);
  console.log('🧹 Cleared job ads cache');
};

const cleanupJobAdsCache = (): void => {
  const now = Date.now();
  let removedCount = 0;

  Object.keys(jobAdsCache).forEach(key => {
    if (!isCacheValid(jobAdsCache[key])) {
      delete jobAdsCache[key];
      removedCount++;
    }
  });

  if (removedCount > 0) {
    console.log(`🧹 Cleaned up ${removedCount} expired job ads cache entries`);
  }
};

export const getJobAdsCacheStats = (): { size: number; oldestEntry: string | null } => {
  const entries = Object.entries(jobAdsCache);
  const size = entries.length;

  let oldestEntry: string | null = null;
  let oldestTimestamp = Date.now();

  entries.forEach(([key, value]) => {
    if (value.timestamp < oldestTimestamp) {
      oldestTimestamp = value.timestamp;
      oldestEntry = key;
    }
  });

  return { size, oldestEntry };
};

// Search for specific job by ID
export const getJobAdById = async (jobId: string): Promise<JobAdProfile | null> => {
  try {
    const url = `https://jobsearch.api.jobtechdev.se/ad/${encodeURIComponent(jobId)}`;

    const response = await fetch(url, {
      headers: {
        "accept": "application/json",
        "User-Agent": "TinderJobApp/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch job ad ${jobId}: ${response.status}`);
    }

    const data = await response.json();
    const processed = processJobAds([data]);

    return processed.length > 0 ? processed[0] : null;
  } catch (error) {
    console.error(`Error fetching job ad ${jobId}:`, error);
    return null;
  }
};

// Add this to your fetchJobAds.ts file for debugging

// Enhanced debugging function
export const debugJobAdsAPI = async (skills: string): Promise<void> => {
  console.log('=== JOB ADS DEBUG SESSION ===');
  console.log('Input skills:', skills);

  try {
    // Test the API directly
    const normalizedSkills = skills
      .split(',')
      .map(skill => skill.trim().toLowerCase())
      .filter(skill => skill.length > 0)
      .sort()
      .join(',');

    console.log('Normalized skills:', normalizedSkills);

    // Test different query formats
    const queries = [
      normalizedSkills.split(',').join(' OR '),  // Current format
      normalizedSkills.split(',').join(' '),     // Space separated
      normalizedSkills.split(',').join('+'),     // Plus separated
      normalizedSkills.split(',')[0]             // First skill only
    ];

    console.log('\n=== TESTING DIFFERENT QUERY FORMATS ===');

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      const url = `https://jobsearch.api.jobtechdev.se/search?q=${encodeURIComponent(query)}&limit=50&offset=0`;

      console.log(`\n${i + 1}. Testing query: "${query}"`);
      console.log(`URL: ${url}`);

      try {
        const response = await fetch(url, {
          headers: {
            "accept": "application/json",
            "User-Agent": "TinderJobApp/1.0"
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Results: ${data.hits?.length || 0} jobs`);
          console.log(`Total available: ${data.total?.value || 'unknown'}`);

          if (data.hits?.length > 0) {
            console.log('Sample job titles:');
            data.hits.slice(0, 3).forEach((job: any, index: number) => {
              console.log(`  ${index + 1}. ${job.headline?.text || 'No title'}`);
            });
          }
        } else {
          console.log(`❌ Error: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.log(`❌ Request failed:`, error);
      }

      // Rate limiting
      if (i < queries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Test pagination
    console.log('\n=== TESTING PAGINATION ===');
    const bestQuery = queries[0]; // Use OR format

    for (let offset = 0; offset < 100; offset += 20) {
      const url = `https://jobsearch.api.jobtechdev.se/search?q=${encodeURIComponent(bestQuery)}&limit=20&offset=${offset}`;

      try {
        const response = await fetch(url, {
          headers: {
            "accept": "application/json",
            "User-Agent": "TinderJobApp/1.0"
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Offset ${offset}: ${data.hits?.length || 0} jobs`);

          if (!data.hits || data.hits.length === 0) {
            console.log('🏁 Reached end of results');
            break;
          }
        } else {
          console.log(`❌ Pagination error at offset ${offset}: ${response.status}`);
          break;
        }
      } catch (error) {
        console.log(`❌ Pagination request failed at offset ${offset}:`, error);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

  } catch (error) {
    console.error('Debug session failed:', error);
  }

  console.log('=== DEBUG SESSION COMPLETE ===');
};

// Quick test function you can call
export const quickJobAdsTest = async (skills: string = "javascript,react,node.js"): Promise<{
  success: boolean;
  totalJobs: number;
  firstBatchSize: number;
  apiUrl: string;
}> => {
  try {
    const normalizedSkills = skills
      .split(',')
      .map(skill => skill.trim().toLowerCase())
      .filter(skill => skill.length > 0)
      .join(' OR ');

    const url = `https://jobsearch.api.jobtechdev.se/search?q=${encodeURIComponent(normalizedSkills)}&limit=50&offset=0`;

    const response = await fetch(url, {
      headers: {
        "accept": "application/json",
        "User-Agent": "TinderJobApp/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      totalJobs: data.total?.value || 0,
      firstBatchSize: data.hits?.length || 0,
      apiUrl: url
    };

  } catch (error) {
    console.error('Quick test failed:', error);
    return {
      success: false,
      totalJobs: 0,
      firstBatchSize: 0,
      apiUrl: ''
    };
  }
};

// Enhanced getJobAds with more aggressive pagination
export const getJobAdsAggressive = async (
  skills: string = "",
  maxJobs: number = 100
): Promise<JobAdProfile[]> => {
  const allJobs: any[] = [];
  let offset = 0;
  const batchSize = 20;
  let attempts = 0;
  const maxAttempts = Math.ceil(maxJobs / batchSize);

  console.log(`🎯 Aggressively fetching up to ${maxJobs} job ads...`);

  while (allJobs.length < maxJobs && attempts < maxAttempts) {
    try {
      console.log(`📥 Fetching batch ${attempts + 1}/${maxAttempts} (offset: ${offset})`);

      const response = await getJobAdsEnhanced(skills, offset, batchSize);

      if (response.error) {
        console.error(`Batch ${attempts + 1} failed:`, response.error);
        break;
      }

      if (response.jobAds.length === 0) {
        console.log('🏁 No more jobs available');
        break;
      }

      allJobs.push(...response.jobAds);
      offset += response.jobAds.length;
      attempts++;

      console.log(`✅ Batch ${attempts} complete: +${response.jobAds.length} jobs (total: ${allJobs.length})`);

      if (!response.hasMore) {
        console.log('🏁 API indicates no more results');
        break;
      }

      // Rate limiting
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`Batch ${attempts + 1} failed:`, error);
      break;
    }
  }

  console.log(`🎉 Aggressive fetch complete: ${allJobs.length} total jobs`);
  return allJobs;
};

// Export default function for backward compatibility
export default getJobAds;

