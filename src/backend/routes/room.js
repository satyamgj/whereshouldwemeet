const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const { validateRoom, validateParticipant, validatePreferences } = require('../middleware/validation');

/**
 * @swagger
 * components:
 *   schemas:
 *     Room:
 *       type: object
 *       required:
 *         - name
 *         - creator
 *         - location
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the room
 *         creator:
 *           type: string
 *           description: The creator of the room
 *         location:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *             lng:
 *               type: number
 *         participants:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               location:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                   lng:
 *                     type: number
 *               joinedAt:
 *                 type: string
 *                 format: date-time
 *         status:
 *           type: string
 *           enum: [active, completed]
 *         roomCode:
 *           type: string
 *           description: Unique code for the room
 */

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
 *               - creator
 *             properties:
 *               name:
 *                 type: string
 *               creator:
 *                 type: string
 *     responses:
 *       201:
 *         description: Room created successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/', validateRoom, async (req, res) => {
  try {
    const { name, creator } = req.body;
    const room = new Room({ name, creator });
    await room.save();
    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

/**
 * @swagger
 * /api/rooms/{roomCode}:
 *   get:
 *     summary: Get room by code
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
 *       404:
 *         description: Room not found
 *       500:
 *         description: Server error
 */
router.get('/:roomCode', async (req, res) => {
  try {
    const room = await Room.findOne({ code: req.params.roomCode });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

/**
 * @swagger
 * /api/rooms/{roomCode}/participants:
 *   post:
 *     summary: Add a participant to the room
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
 *               - name
 *             properties:
 *               location:
 *                 type: object
 *                 required:
 *                   - lat
 *                   - lng
 *                 properties:
 *                   lat:
 *                     type: number
 *                   lng:
 *                     type: number
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Participant added successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Room not found
 *       500:
 *         description: Server error
 */
router.post('/:roomCode/participants', validateParticipant, async (req, res) => {
  try {
    const { location, name } = req.body;
    const room = await Room.findOne({ code: req.params.roomCode });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if participant with same name already exists
    const existingParticipant = room.participants.find(p => p.name === name);
    if (existingParticipant) {
      return res.status(400).json({ error: 'Participant with this name already exists' });
    }

    // Check if location is already added
    const isLocationAdded = room.participants.some(p => 
      Math.abs(p.location.lat - location.lat) < 0.000001 && 
      Math.abs(p.location.lng - location.lng) < 0.000001
    );

    if (isLocationAdded) {
      return res.status(400).json({ error: 'This location is already added' });
    }

    room.participants.push({ location, name });
    await room.save();
    res.json(room);
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

/**
 * @swagger
 * /api/rooms/{roomCode}/preferences:
 *   put:
 *     summary: Update room preferences
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
 *               - preferences
 *             properties:
 *               preferences:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Room not found
 *       500:
 *         description: Server error
 */
router.put('/:roomCode/preferences', validatePreferences, async (req, res) => {
  try {
    const { preferences } = req.body;
    const room = await Room.findOne({ code: req.params.roomCode });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    room.preferences = preferences;
    await room.save();
    res.json(room);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Remove a preference from the room
router.delete('/:roomCode/preferences/:preference', async (req, res) => {
  try {
    const { roomCode, preference } = req.params;
    const room = await Room.findOne({ code: roomCode });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Remove the preference from the array
    room.preferences = room.preferences.filter(p => p !== preference);
    await room.save();

    res.json(room);
  } catch (error) {
    console.error('Remove preference error:', error);
    res.status(500).json({ error: 'Failed to remove preference' });
  }
});

module.exports = router; 