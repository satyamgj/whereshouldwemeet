const GoogleMapsService = require('../services/googleMapsService');

// Initialize GoogleMapsService with API key from environment variables
const googleMapsService = new GoogleMapsService(process.env.GOOGLE_MAPS_API_KEY);

module.exports = googleMapsService; 