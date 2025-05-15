const { Client } = require('@googlemaps/google-maps-services-js');

const client = new Client({});

class GoogleMapsService {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Google Maps API key is required');
    }
    this.apiKey = apiKey;
    
    // Define valid Google Places API types for fallback only
    this.validPlaceTypes = [
      'restaurant', 'cafe', 'bar', 'food', 'bowling_alley', 'amusement_park',
      'night_club', 'park', 'beach', 'natural_feature', 'stadium', 'gym',
      'museum', 'art_gallery', 'library', 'book_store', 'university', 'school',
      'shopping_mall', 'supermarket', 'spa', 'zoo', 'aquarium'
    ];

    // Simple mapping for common variations
    this.simpleMap = {
      'restaurants': 'restaurant',
      'cafes': 'cafe',
      'bars': 'bar',
      'pubs': 'bar',
      'parks': 'park',
      'museums': 'museum',
      'libraries': 'library',
      'gyms': 'gym',
      'malls': 'shopping_mall',
      'spas': 'spa',
      'zoos': 'zoo',
      'aquariums': 'aquarium'
    };
  }

  mapPreferenceToPlaceType(preference) {
    const normalizedPreference = preference.toLowerCase().trim();
    
    // Keep the exact preference as the primary search term
    return {
      searchTerm: normalizedPreference,
      // Use a valid type only as a fallback filter, but don't require it
      fallbackType: this.validPlaceTypes.find(type => 
        normalizedPreference.includes(type)
      ) || null
    };
  }

  async findOptimalMeetingPoint(participants, preferences) {
    try {
      // Calculate the center point of all participants
      const center = this.calculateCenterPoint(participants);
      
      // Map user preferences to search terms
      const placeTypes = preferences
        .map(pref => this.mapPreferenceToPlaceType(pref));

      if (placeTypes.length === 0) {
        throw new Error('No preferences provided');
      }
      
      // Search for places based on preferences
      const places = await this.searchPlaces(center, placeTypes);
      
      if (places.length === 0) {
        throw new Error('No suitable places found for the given preferences');
      }
      
      // Calculate travel times for each participant to each place
      const placesWithTravelTimes = await this.calculateTravelTimes(places, participants);
      
      // Find the top 5 places with the most balanced travel times
      return this.findTopPlaces(placesWithTravelTimes, participants);
    } catch (error) {
      console.error('Error finding optimal meeting point:', error);
      throw error;
    }
  }

  calculateCenterPoint(participants) {
    const totalLat = participants.reduce((sum, p) => sum + p.location.lat, 0);
    const totalLng = participants.reduce((sum, p) => sum + p.location.lng, 0);
    
    return {
      lat: totalLat / participants.length,
      lng: totalLng / participants.length
    };
  }

  async searchPlaces(center, placeTypes) {
    const places = [];
    const seenPlaceIds = new Set();
    
    for (const type of placeTypes) {
      try {
        const { searchTerm, fallbackType } = type;
        
        // First try with exact preference match
        const response = await client.placesNearby({
          params: {
            location: center,
            rankby: 'distance',
            keyword: searchTerm,
            ...(fallbackType && { type: fallbackType }), // Only use type if we have a fallback
            key: this.apiKey
          }
        });

        if (response.data.results && response.data.results.length > 0) {
          const highlyRatedPlaces = response.data.results.filter(place => {
            // Check if place matches the search term in name or types
            const matchesSearchTerm = 
              place.name.toLowerCase().includes(searchTerm) ||
              place.types.some(t => t.includes(searchTerm));
            
            const isNewPlace = place.user_ratings_total >= 5 && place.rating >= 3.8;
            const isEstablishedPlace = place.rating >= 4.0 && place.user_ratings_total >= 10;
            const hasGoodRating = isNewPlace || isEstablishedPlace;
            const isUnique = !seenPlaceIds.has(place.place_id);
            
            if (matchesSearchTerm && hasGoodRating && isUnique) {
              seenPlaceIds.add(place.place_id);
              return true;
            }
            return false;
          });
          
          places.push(...highlyRatedPlaces);
          
          if (places.length >= 5) {
            return places;
          }
        }

        // Try with descriptive keywords while maintaining specificity
        const keywords = [
          `best ${searchTerm}`,
          `popular ${searchTerm}`,
          `new ${searchTerm}`,
          `trendy ${searchTerm}`,
          `cool ${searchTerm}`
        ];

        for (const keyword of keywords) {
          const keywordResponse = await client.placesNearby({
            params: {
              location: center,
              rankby: 'distance',
              keyword: keyword,
              ...(fallbackType && { type: fallbackType }), // Only use type if we have a fallback
              key: this.apiKey
            }
          });

          if (keywordResponse.data.results) {
            const additionalPlaces = keywordResponse.data.results.filter(place => {
              const matchesSearchTerm = 
                place.name.toLowerCase().includes(searchTerm) ||
                place.types.some(t => t.includes(searchTerm));
              
              const isNewPlace = place.user_ratings_total >= 5 && place.rating >= 3.8;
              const isEstablishedPlace = place.rating >= 4.0 && place.user_ratings_total >= 10;
              const hasGoodRating = isNewPlace || isEstablishedPlace;
              const isUnique = !seenPlaceIds.has(place.place_id);
              
              if (matchesSearchTerm && hasGoodRating && isUnique) {
                seenPlaceIds.add(place.place_id);
                return true;
              }
              return false;
            });
            
            places.push(...additionalPlaces);
            
            if (places.length >= 5) {
              return places;
            }
          }
        }
      } catch (error) {
        console.error(`Error searching for ${type.searchTerm} places:`, error.message);
        continue;
      }
    }

    return places;
  }

  async calculateTravelTimes(places, participants) {
    const placesWithTimes = [];

    for (const place of places) {
      try {
        const origins = participants.map(p => p.location);
        const destination = {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        };

        const response = await client.distancematrix({
          params: {
            origins,
            destinations: [destination],
            mode: 'driving',
            key: this.apiKey
          }
        });

        if (response.data.rows && response.data.rows.length > 0) {
          const travelTimes = response.data.rows.map(row => 
            row.elements[0]?.duration?.value || Infinity
          );

          // Only include places where all participants can reach
          if (!travelTimes.includes(Infinity)) {
            placesWithTimes.push({
              place,
              travelTimes,
              averageTime: travelTimes.reduce((a, b) => a + b, 0) / travelTimes.length,
              maxTimeDifference: Math.max(...travelTimes) - Math.min(...travelTimes)
            });
          }
        }
      } catch (error) {
        console.error('Error calculating travel times:', error);
        // Skip this place if we can't calculate travel times
        continue;
      }
    }

    return placesWithTimes;
  }

  findTopPlaces(placesWithTimes, participants) {
    if (placesWithTimes.length === 0) {
      // If no places found, return the center point as a fallback
      const center = this.calculateCenterPoint(participants);
      return [{
        place: {
          geometry: {
            location: center
          },
          name: 'Center Point',
          vicinity: 'Approximate center of all locations',
          place_id: 'center_point'
        },
        travelTimes: [],
        averageTime: 0,
        maxTimeDifference: 0,
        rating: 0,
        totalRatings: 0,
        types: ['meeting_point']
      }];
    }

    // Sort by max time difference (ascending) and then by average time (ascending)
    const sortedPlaces = placesWithTimes.sort((a, b) => {
      if (a.maxTimeDifference === b.maxTimeDifference) {
        return a.averageTime - b.averageTime;
      }
      return a.maxTimeDifference - b.maxTimeDifference;
    });

    // Return top 5 places with enhanced details
    return sortedPlaces.slice(0, 5).map(place => ({
      ...place,
      rating: place.place.rating || 0,
      totalRatings: place.place.user_ratings_total || 0,
      types: place.place.types || [],
      formattedAddress: place.place.vicinity || 'Address not available',
      openingHours: place.place.opening_hours?.open_now ? 'Open' : 'Closed',
      photos: place.place.photos ? place.place.photos.length : 0
    }));
  }
}

module.exports = GoogleMapsService; 