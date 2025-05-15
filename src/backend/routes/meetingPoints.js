const express = require('express');
const router = express.Router();
const mapsService = require('../services/mapsService');
const { body, validationResult } = require('express-validator');

/**
 * @swagger
 * /api/meeting-points:
 *   post:
 *     summary: Find top 10 meeting points based on participant locations and preferences
 *     tags: [Meeting Points]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participants
 *               - preferences
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - location
 *                     - name
 *                   properties:
 *                     location:
 *                       type: object
 *                       required:
 *                         - lat
 *                         - lng
 *                       properties:
 *                         lat:
 *                           type: number
 *                         lng:
 *                           type: number
 *                     name:
 *                       type: string
 *               preferences:
 *                 type: array
 *                 items:
 *                   type: string
 *               pageToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Top 10 meeting points found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 places:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       location:
 *                         type: object
 *                         properties:
 *                           lat:
 *                             type: number
 *                           lng:
 *                             type: number
 *                       name:
 *                         type: string
 *                       address:
 *                         type: string
 *                       types:
 *                         type: array
 *                         items:
 *                           type: string
 *                       distances:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             participant:
 *                               type: string
 *                             distance:
 *                               type: number
 *                       averageDistance:
 *                         type: number
 *                       score:
 *                         type: number
 *                       rating:
 *                         type: number
 *                       totalRatings:
 *                         type: number
 *                 nextPageToken:
 *                   type: string
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/', [
  body('participants')
    .isArray()
    .withMessage('Participants must be an array')
    .notEmpty()
    .withMessage('At least one participant is required'),
  body('participants.*.name')
    .trim()
    .notEmpty()
    .withMessage('Participant name is required'),
  body('participants.*.location')
    .isObject()
    .withMessage('Location must be an object'),
  body('participants.*.location.lat')
    .isFloat()
    .withMessage('Latitude must be a number'),
  body('participants.*.location.lng')
    .isFloat()
    .withMessage('Longitude must be a number'),
  body('preferences')
    .isArray()
    .withMessage('Preferences must be an array'),
  body('preferences.*')
    .isString()
    .withMessage('Each preference must be a string'),
  body('pageToken')
    .optional()
    .custom((value) => {
      if (value !== null && typeof value !== 'string') {
        throw new Error('Page token must be a string or null');
      }
      return true;
    })
    .withMessage('Page token must be a string or null')
], async (req, res) => {
  try {
    console.log('Received meeting points request:', {
      participants: req.body.participants,
      preferences: req.body.preferences,
      pageToken: req.body.pageToken
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { participants, preferences, pageToken } = req.body;
    const result = await mapsService.findOptimalMeetingPoint(participants, preferences, pageToken);
    
    console.log('Found meeting places:', result);
    
    if (!result || !result.places || !Array.isArray(result.places)) {
      console.error('Invalid places response:', result);
      return res.status(500).json({ error: 'Invalid response from maps service' });
    }

    res.json({
      places: result.places,
      nextPageToken: result.nextPageToken
    });
  } catch (error) {
    console.error('Find meeting points error:', error);
    res.status(500).json({ 
      error: 'Failed to find meeting points',
      details: error.message 
    });
  }
});

// GET /api/geocode
router.get('/geocode', async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({
        error: 'Address is required'
      });
    }
    
    const location = await mapsService.geocodeAddress(address);
    
    if (!location) {
      return res.status(404).json({
        error: 'Address not found'
      });
    }
    
    res.json({ location });
  } catch (error) {
    console.error('Error geocoding address:', error);
    res.status(500).json({
      error: 'Failed to geocode address',
      message: error.message
    });
  }
});

module.exports = router; 