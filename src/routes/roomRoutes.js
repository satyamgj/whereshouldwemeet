const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const googleMapsService = require('../config/googleMaps');

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the room
 *     responses:
 *       201:
 *         description: Room created successfully with a unique room code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 roomCode:
 *                   type: string
 *                 shareableLink:
 *                   type: string
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ 
        message: 'Room name is required and must be a non-empty string' 
      });
    }

    const room = new Room({ 
      name: name.trim(),
      status: 'active'
    });

    await room.save();

    // Create a shareable link
    const shareableLink = `${req.protocol}://${req.get('host')}/join/${room.roomCode}`;

    res.status(201).json({
      _id: room._id,
      name: room.name,
      roomCode: room.roomCode,
      shareableLink,
      message: 'Room created successfully'
    });
  } catch (error) {
    console.error('Error creating room:', error);
    if (error.code === 11000) {
      // Handle duplicate room code error (shouldn't happen due to pre-save hook, but just in case)
      return res.status(500).json({ 
        message: 'Error generating unique room code. Please try again.' 
      });
    }
    res.status(500).json({ 
      message: 'Error creating room',
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /api/rooms/code/{roomCode}:
 *   get:
 *     summary: Get room by room code
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       404:
 *         description: Room not found
 */
router.get('/code/:roomCode', async (req, res) => {
  try {
    const room = await Room.findOne({ roomCode: req.params.roomCode.toUpperCase() });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/rooms/{roomCode}/join:
 *   post:
 *     summary: Join a room with location
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - location
 *             properties:
 *               location:
 *                 $ref: '#/components/schemas/Location'
 *               preferences:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Successfully joined the room
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       404:
 *         description: Room not found
 */
router.post('/:roomCode/join', async (req, res) => {
  try {
    const { location, preferences = [] } = req.body;
    const room = await Room.findOne({ 
      roomCode: req.params.roomCode.toUpperCase(),
      status: 'active'
    });
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found or is no longer active' });
    }

    // Generate a temporary userId if not provided
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    room.participants.push({ userId, location, preferences });
    await room.save();
    res.json(room);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/rooms/{roomCode}/find-meeting-point:
 *   post:
 *     summary: Find optimal meeting points
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Top 5 meeting points found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meetingPoints:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       address:
 *                         type: string
 *                       location:
 *                         type: object
 *                         properties:
 *                           lat:
 *                             type: number
 *                           lng:
 *                             type: number
 *                       travelTimes:
 *                         type: array
 *                         items:
 *                           type: number
 *                       averageTime:
 *                         type: number
 *                       maxTimeDifference:
 *                         type: number
 *                       rating:
 *                         type: number
 *                       totalRatings:
 *                         type: number
 *                       types:
 *                         type: array
 *                         items:
 *                           type: string
 *                       openingHours:
 *                         type: string
 *                       photos:
 *                         type: number
 *       404:
 *         description: Room not found
 *       500:
 *         description: Error finding meeting points
 */
router.post('/:roomCode/find-meeting-point', async (req, res) => {
  try {
    const room = await Room.findOne({ 
      roomCode: req.params.roomCode.toUpperCase(),
      status: 'active'
    });
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found or is no longer active' });
    }

    if (room.participants.length < 2) {
      return res.status(400).json({ message: 'Need at least 2 participants to find a meeting point' });
    }

    // Get all unique preferences from participants
    const allPreferences = [...new Set(
      room.participants.flatMap(p => p.preferences)
    )];

    const meetingPoints = await googleMapsService.findOptimalMeetingPoint(
      room.participants,
      allPreferences
    );

    // Update room with the best meeting point
    if (meetingPoints.length > 0) {
      const bestPlace = meetingPoints[0].place;
      room.meetingPoint = {
        location: {
          lat: bestPlace.geometry.location.lat,
          lng: bestPlace.geometry.location.lng
        },
        name: bestPlace.name,
        address: bestPlace.vicinity,
        placeId: bestPlace.place_id
      };
      await room.save();
    }

    res.json({
      meetingPoints: meetingPoints.map(point => ({
        name: point.place.name,
        address: point.formattedAddress,
        location: point.place.geometry.location,
        travelTimes: point.travelTimes,
        averageTime: point.averageTime,
        maxTimeDifference: point.maxTimeDifference,
        rating: point.rating,
        totalRatings: point.totalRatings,
        types: point.types,
        openingHours: point.openingHours,
        photos: point.photos
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/rooms/join/{roomCode}:
 *   get:
 *     summary: Get room details by room code (for shareable link)
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       404:
 *         description: Room not found
 */
router.get('/join/:roomCode', async (req, res) => {
  try {
    const room = await Room.findOne({ 
      roomCode: req.params.roomCode.toUpperCase(),
      status: 'active'
    });
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found or is no longer active' });
    }

    res.json({
      _id: room._id,
      name: room.name,
      roomCode: room.roomCode,
      participants: room.participants,
      meetingPoint: room.meetingPoint
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 