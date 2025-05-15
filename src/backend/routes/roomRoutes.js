const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const { validateRoom, validateParticipant, validatePreferences } = require('../middleware/validation');

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
 *               preferences:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Room created successfully
 *       400:
 *         description: Invalid request
 */
router.post('/', validateRoom, async (req, res) => {
  try {
    const { name } = req.body;
    const room = new Room({ name });
    
    // Generate a unique code
    let isUnique = false;
    let code;
    
    while (!isUnique) {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existingRoom = await Room.findOne({ code });
      if (!existingRoom) {
        isUnique = true;
      }
    }
    
    room.code = code;
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
 *     summary: Get a room by its room code
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room retrieved successfully
 *       404:
 *         description: Room not found
 */
router.get('/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const room = await Room.findOne({ code: roomCode.toUpperCase() });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Set cache control headers to prevent caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

/**
 * @swagger
 * /api/rooms/{roomCode}/votes:
 *   get:
 *     summary: Get all votes for a room
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of votes
 *       404:
 *         description: Room not found
 */
router.get('/:roomCode/votes', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const room = await Room.findOne({ code: roomCode.toUpperCase() });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Convert Map to object for response
    const votesObject = {};
    if (room.votes) {
      room.votes.forEach((votes, key) => {
        votesObject[key] = votes;
      });
    }

    res.json(votesObject);
  } catch (error) {
    console.error('Get votes error:', error);
    res.status(500).json({ error: 'Failed to get votes' });
  }
});

/**
 * @swagger
 * /api/rooms/{roomCode}/vote:
 *   post:
 *     summary: Vote for a meeting place
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
 *               - placeId
 *               - participantName
 *               - participantLocation
 *             properties:
 *               placeId:
 *                 type: string
 *               participantName:
 *                 type: string
 *               participantLocation:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                   lng:
 *                     type: number
 *     responses:
 *       200:
 *         description: Vote recorded successfully
 *       404:
 *         description: Room not found
 *       400:
 *         description: Invalid request
 */
router.post('/:roomCode/vote', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { placeId, participantName, participantLocation } = req.body;

    if (!placeId || !participantName || !participantLocation) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const room = await Room.findOne({ code: roomCode.toUpperCase() });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Initialize votes if not exists
    if (!room.votes) {
      room.votes = new Map();
    }

    // Get current votes for this place
    const placeVotes = room.votes.get(placeId) || [];

    // Check if participant has already voted for this place
    const hasVoted = placeVotes.some(vote => vote.participantName === participantName);
    if (hasVoted) {
      return res.status(400).json({ error: 'You have already voted for this place' });
    }

    // Add the vote
    placeVotes.push({
      participantName,
      participantLocation,
      timestamp: new Date()
    });

    // Update the votes in the room
    room.votes.set(placeId, placeVotes);
    await room.save();

    // Convert Map to object for response
    const votesObject = {};
    room.votes.forEach((votes, key) => {
      votesObject[key] = votes;
    });

    res.json(votesObject);
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

/**
 * @swagger
 * /api/rooms/{roomCode}/preferences:
 *   put:
 *     summary: Update room preferences
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
 *       404:
 *         description: Room not found
 */
router.put('/:roomCode/preferences', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { preferences } = req.body;

    if (!Array.isArray(preferences)) {
      return res.status(400).json({ message: 'Preferences must be an array' });
    }

    const room = await Room.findOne({ code: roomCode });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    room.preferences = preferences;
    await room.save();

    res.json(room);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Failed to update preferences' });
  }
});

/**
 * @swagger
 * /api/rooms/{roomCode}/preferences/{preference}:
 *   delete:
 *     summary: Remove a specific preference from the room
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: preference
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Preference removed successfully
 *       404:
 *         description: Room not found
 *       400:
 *         description: Invalid request
 */
router.delete('/:roomCode/preferences/:preference', async (req, res) => {
  try {
    const { roomCode, preference } = req.params;
    const room = await Room.findOne({ code: roomCode.toUpperCase() });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Remove the preference if it exists
    const preferenceIndex = room.preferences.indexOf(preference);
    if (preferenceIndex === -1) {
      return res.status(400).json({ error: 'Preference not found' });
    }

    room.preferences.splice(preferenceIndex, 1);
    await room.save();

    res.json(room);
  } catch (error) {
    console.error('Remove preference error:', error);
    res.status(500).json({ error: 'Failed to remove preference' });
  }
});

/**
 * @swagger
 * /api/rooms/{roomCode}/participants:
 *   post:
 *     summary: Add a participant to a room
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
 *               - name
 *               - location
 *             properties:
 *               name:
 *                 type: string
 *               location:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                   lng:
 *                     type: number
 *     responses:
 *       200:
 *         description: Participant added successfully
 *       404:
 *         description: Room not found
 */
router.post('/:roomCode/participants', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { name, location } = req.body;

    if (!name || !location || !location.lat || !location.lng) {
      return res.status(400).json({ message: 'Name and location are required' });
    }

    const room = await Room.findOne({ code: roomCode });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if participant already exists
    const existingParticipant = room.participants.find(p => p.name === name);
    if (existingParticipant) {
      return res.status(400).json({ message: 'Participant already exists' });
    }

    // Add new participant
    room.participants.push({
      name,
      location,
      joinedAt: new Date()
    });

    await room.save();
    res.json(room);
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({ message: 'Failed to add participant' });
  }
});

/**
 * @swagger
 * /api/rooms/{roomCode}/final-place:
 *   put:
 *     summary: Set the final meeting place and update room status
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
 *               - place
 *             properties:
 *               place:
 *                 type: object
 *                 required:
 *                   - name
 *                   - address
 *                   - location
 *                   - placeId
 *                 properties:
 *                   name:
 *                     type: string
 *                   address:
 *                     type: string
 *                   location:
 *                     type: object
 *                     properties:
 *                       lat:
 *                         type: number
 *                       lng:
 *                         type: number
 *                   placeId:
 *                     type: string
 *     responses:
 *       200:
 *         description: Room updated successfully
 *       404:
 *         description: Room not found
 *       400:
 *         description: Invalid request
 */
router.put('/:roomCode/final-place', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { place } = req.body;

    if (!place || !place.name || !place.address || !place.location || !place.placeId) {
      return res.status(400).json({ error: 'Missing required place information' });
    }

    const room = await Room.findOne({ code: roomCode.toUpperCase() });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Update the meeting point and status
    room.meetingPoint = place;
    room.status = 'completed';
    await room.save();

    res.json(room);
  } catch (error) {
    console.error('Update final place error:', error);
    res.status(500).json({ error: 'Failed to update final place' });
  }
});

// Remove a vote
router.delete('/:roomCode/vote', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { placeId, participantName } = req.body;

    if (!placeId || !participantName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const room = await Room.findOne({ code: roomCode.toUpperCase() });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if votes exist for this place
    if (!room.votes || !room.votes.has(placeId)) {
      return res.status(404).json({ error: 'No votes found for this place' });
    }

    // Get current votes for this place
    const placeVotes = room.votes.get(placeId);

    // Find and remove the vote
    const voteIndex = placeVotes.findIndex(
      vote => vote.participantName === participantName
    );

    if (voteIndex === -1) {
      return res.status(404).json({ error: 'Vote not found' });
    }

    // Remove the vote
    placeVotes.splice(voteIndex, 1);

    // If no votes left for this place, remove the place entry
    if (placeVotes.length === 0) {
      room.votes.delete(placeId);
    } else {
      room.votes.set(placeId, placeVotes);
    }

    await room.save();
    
    // Convert Map to object for response
    const votesObject = {};
    room.votes.forEach((votes, key) => {
      votesObject[key] = votes;
    });

    res.json({
      message: 'Vote removed successfully',
      votes: votesObject
    });
  } catch (error) {
    console.error('Remove vote error:', error);
    res.status(500).json({ error: 'Failed to remove vote' });
  }
});

module.exports = router; 