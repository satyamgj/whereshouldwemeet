const axios = require('axios');
const { GOOGLE_MAPS_API_KEY } = require('../config/keys');

const mapsService = {
  async geocodeAddress(address) {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
      );

      if (response.data.status === 'ZERO_RESULTS') {
        return null;
      }

      const { lat, lng } = response.data.results[0].geometry.location;
      return { lat, lng };
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error('Failed to geocode address');
    }
  },

  async findOptimalMeetingPoint(participants, preferences, pageToken = null) {
    try {
      if (!participants || participants.length === 0) {
        throw new Error('No participants provided');
      }

      if (participants.length === 1) {
        return {
          location: participants[0].location,
          name: 'Single participant location',
          address: 'Single participant location',
          types: ['point_of_interest']
        };
      }

      // Calculate the center point of all participants
      const center = this.calculateCenterPoint(participants.map(p => p.location));

      // Build the search query based on preferences
      const query = preferences.join(' ');

      // Make the Places API request with pagination
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${center.lat},${center.lng}&radius=5000&key=${GOOGLE_MAPS_API_KEY}${pageToken ? `&pagetoken=${pageToken}` : ''}`
      );

      if (response.data.status !== 'OK') {
        throw new Error(`Places API error: ${response.data.status}`);
      }

      // Process the places
      const places = await Promise.all(
        response.data.results.map(async (place) => {
          // Calculate distances for each participant
          const distances = await Promise.all(
            participants.map(async (participant) => {
              const distance = await this.calculateDistance(
                participant.location.lat,
                participant.location.lng,
                place.geometry.location.lat,
                place.geometry.location.lng
              );
              return {
                participant: participant.name,
                distance
              };
            })
          );

          // Calculate average distance
          const averageDistance = distances.reduce((sum, d) => sum + d.distance, 0) / distances.length;

          return {
            placeId: place.place_id,
            name: place.name,
            address: place.formatted_address,
            location: place.geometry.location,
            types: place.types,
            distances,
            averageDistance,
            rating: place.rating,
            totalRatings: place.user_ratings_total
          };
        })
      );

      // Sort places by average distance
      places.sort((a, b) => a.averageDistance - b.averageDistance);

      return {
        places,
        nextPageToken: response.data.next_page_token
      };
    } catch (error) {
      console.error('Error finding optimal meeting point:', error);
      throw error;
    }
  },

  calculateCenterPoint(locations) {
    if (!locations || locations.length === 0) {
      throw new Error('No locations provided');
    }

    const sum = locations.reduce(
      (acc, loc) => {
        if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
          throw new Error('Invalid location data');
        }
        return {
          lat: acc.lat + loc.lat,
          lng: acc.lng + loc.lng
        };
      },
      { lat: 0, lng: 0 }
    );

    return {
      lat: sum.lat / locations.length,
      lng: sum.lng / locations.length
    };
  },

  async searchNearbyPlaces(center, preference, radius = 5000) {
    try {
      const places = [];
      const seenPlaceIds = new Set();

      try {
        // First try with text search
        const textSearchResponse = await axios.get(
          `https://maps.googleapis.com/maps/api/place/textsearch/json`,
          {
            params: {
              query: `${preference} in Nagpur`,
              location: `${center.lat},${center.lng}`,
              radius: radius,
              key: GOOGLE_MAPS_API_KEY
            }
          }
        );

        if (textSearchResponse.data.results && textSearchResponse.data.results.length > 0) {
          for (const place of textSearchResponse.data.results) {
            if (!seenPlaceIds.has(place.place_id)) {
              seenPlaceIds.add(place.place_id);
              places.push({
                placeId: place.place_id,
                location: place.geometry.location,
                name: place.name,
                address: place.formatted_address || place.vicinity,
                types: place.types,
                preference,
                rating: place.rating,
                totalRatings: place.user_ratings_total
              });
            }
          }
        }

        // If text search didn't yield enough results, try nearby search
        if (places.length < 5) {
          const nearbyResponse = await axios.get(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json`,
            {
              params: {
                location: `${center.lat},${center.lng}`,
                radius: radius,
                type: preference,
                key: GOOGLE_MAPS_API_KEY
              }
            }
          );

          if (nearbyResponse.data.results && nearbyResponse.data.results.length > 0) {
            for (const place of nearbyResponse.data.results) {
              if (!seenPlaceIds.has(place.place_id)) {
                seenPlaceIds.add(place.place_id);
                places.push({
                  placeId: place.place_id,
                  location: place.geometry.location,
                  name: place.name,
                  address: place.vicinity,
                  types: place.types,
                  preference,
                  rating: place.rating,
                  totalRatings: place.user_ratings_total
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error searching for ${preference}:`, error);
      }

      // If still no places found, try a wider search
      if (places.length === 0) {
        const widerRadius = 10000; // 10km radius
        try {
          const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/textsearch/json`,
            {
              params: {
                query: `${preference} in Nagpur`,
                location: `${center.lat},${center.lng}`,
                radius: widerRadius,
                key: GOOGLE_MAPS_API_KEY
              }
            }
          );

          if (response.data.results && response.data.results.length > 0) {
            for (const place of response.data.results) {
              if (!seenPlaceIds.has(place.place_id)) {
                seenPlaceIds.add(place.place_id);
                places.push({
                  placeId: place.place_id,
                  location: place.geometry.location,
                  name: place.name,
                  address: place.formatted_address || place.vicinity,
                  types: place.types,
                  preference,
                  rating: place.rating,
                  totalRatings: place.user_ratings_total
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error in wider search for ${preference}:`, error);
        }
      }

      return places;
    } catch (error) {
      console.error('Search nearby places error:', error);
      throw new Error('Failed to search nearby places');
    }
  },

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  },

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  },

  calculatePreferenceMatchScore(place, preference) {
    let score = 0;
    
    // Ensure preference is a string
    const preferenceStr = String(preference).toLowerCase();
    const placeName = String(place.name || '').toLowerCase();
    
    // Check if preference is in place name
    if (placeName.includes(preferenceStr)) {
      score += 0.4;
    }
    
    // Check if preference is in place types
    if (place.types && Array.isArray(place.types)) {
      const types = place.types.map(t => String(t).toLowerCase());
      if (types.includes(preferenceStr)) {
        score += 0.3;
      }
    }
    
    // Check if preference is in place keywords
    if (place.keywords && Array.isArray(place.keywords)) {
      const keywords = place.keywords.map(k => String(k).toLowerCase());
      if (keywords.some(k => k.includes(preferenceStr))) {
        score += 0.2;
      }
    }
    
    // Bonus for exact type match
    if (place.types && Array.isArray(place.types) && place.types.length > 0) {
      const firstType = String(place.types[0]).toLowerCase();
      if (firstType === preferenceStr) {
        score += 0.1;
      }
    }
    
    return score;
  }
};

module.exports = mapsService; 