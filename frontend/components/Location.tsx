export const fetchLocationName = async (latitude: number, longitude: number) => {
  try {
    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      console.warn(`Invalid coordinates: Latitude=${latitude}, Longitude=${longitude}`);
      return "Unknown Location";
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
    );

    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText}`);
      return "Unknown Location";
    }

    const data = await response.json();
    return data.display_name || "Unknown Location";
  } catch (error) {
    console.error("Error fetching location name:", error);
    return "Unknown Location";
  }
};
