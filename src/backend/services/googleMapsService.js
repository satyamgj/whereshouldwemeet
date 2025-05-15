const axios = require('axios');

class GoogleMapsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api';
  }

  async geocode(address) {
    try {
      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          address,
          key: this.apiKey
        }
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Geocoding failed: ${response.data.status}`);
      }

      const location = response.data.results[0].geometry.location;
      return {
        location,
        formattedAddress: response.data.results[0].formatted_address
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  }

  async findMeetingPoints(participants, preferences) {
    try {
      // Calculate center point of all participants
      const center = this.calculateCenter(participants);

      // Search for places based on preferences
      const places = await this.searchPlaces(center, preferences);

      // Calculate travel times for each place
      const placesWithTimes = await this.calculateTravelTimes(places, participants);

      // Sort by average travel time and rating
      return this.rankPlaces(placesWithTimes);
    } catch (error) {
      console.error('Error finding meeting points:', error);
      throw error;
    }
  }

  calculateCenter(participants) {
    const sum = participants.reduce((acc, p) => ({
      lat: acc.lat + p.location.lat,
      lng: acc.lng + p.location.lng
    }), { lat: 0, lng: 0 });

    return {
      lat: sum.lat / participants.length,
      lng: sum.lng / participants.length
    };
  }

  async searchPlaces(center, preferences) {
    try {
      const places = [];
      for (const preference of preferences) {
        const response = await axios.get(`${this.baseUrl}/place/nearbysearch/json`, {
          params: {
            location: `${center.lat},${center.lng}`,
            radius: 5000, // 5km radius
            type: preference.toLowerCase(),
            key: this.apiKey
          }
        });

        if (response.data.status === 'OK') {
          places.push(...response.data.results);
        }
      }
      return places;
    } catch (error) {
      console.error('Error searching places:', error);
      throw error;
    }
  }

  async calculateTravelTimes(places, participants) {
    try {
      const placesWithTimes = [];
      for (const place of places) {
        const travelTimes = await Promise.all(
          participants.map(async (participant) => {
            const response = await axios.get(`${this.baseUrl}/distancematrix/json`, {
              params: {
                origins: `${participant.location.lat},${participant.location.lng}`,
                destinations: `${place.geometry.location.lat},${place.geometry.location.lng}`,
                mode: 'driving',
                key: this.apiKey
              }
            });

            if (response.data.status === 'OK') {
              return response.data.rows[0].elements[0].duration.value;
            }
            return null;
          })
        );

        const validTimes = travelTimes.filter(time => time !== null);
        if (validTimes.length === participants.length) {
          placesWithTimes.push({
            place,
            averageTime: validTimes.reduce((a, b) => a + b, 0) / validTimes.length,
            totalRatings: place.user_ratings_total || 0,
            rating: place.rating || 0
          });
        }
      }
      return placesWithTimes;
    } catch (error) {
      console.error('Error calculating travel times:', error);
      throw error;
    }
  }

  rankPlaces(places) {
    return places
      .sort((a, b) => {
        // Sort by average time and rating
        const timeDiff = a.averageTime - b.averageTime;
        const ratingDiff = b.rating - a.rating;
        return timeDiff + (ratingDiff * 300); // Weight rating more heavily
      })
      .slice(0, 5); // Return top 5 places
  }
}

module.exports = new GoogleMapsService(); 