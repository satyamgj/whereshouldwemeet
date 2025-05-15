const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * @swagger
 * /api/geocode:
 *   post:
 *     summary: Convert address to coordinates
 *     tags: [Geocoding]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *             properties:
 *               address:
 *                 type: string
 *                 description: The address to geocode
 *     responses:
 *       200:
 *         description: Coordinates found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lat:
 *                   type: number
 *                 lng:
 *                   type: number
 *       400:
 *         description: Address is required
 *       404:
 *         description: Address not found
 *       500:
 *         description: Server error
 */
router.post('/', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ message: 'Address is required' });
    }

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );

    if (response.data.status === 'ZERO_RESULTS') {
      return res.status(404).json({ message: 'Address not found' });
    }

    const location = response.data.results[0].geometry.location;
    res.json(location);
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ message: 'Error geocoding address' });
  }
});

module.exports = router; 