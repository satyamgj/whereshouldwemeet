const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    index: true
  },
  participants: [{
    name: {
      type: String,
      required: true
    },
    location: {
      lat: Number,
      lng: Number
    },
    preferences: [String]
  }],
  preferences: [String],
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  },
  meetingPoint: {
    location: {
      lat: Number,
      lng: Number
    },
    name: String,
    address: String,
    placeId: String
  },
  votes: {
    type: Map,
    of: [{
      participantName: String,
      participantLocation: {
        lat: Number,
        lng: Number
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    default: new Map()
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Drop any existing indexes before creating new ones
roomSchema.pre('save', async function(next) {
  try {
    await this.constructor.collection.dropIndexes();
  } catch (error) {
    // Ignore errors if indexes don't exist
  }
  next();
});

// Generate a unique room code before validation
roomSchema.pre('validate', async function(next) {
  if (!this.code) {
    let isUnique = false;
    let code;
    
    while (!isUnique) {
      // Generate a 6-character code
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Check if code already exists
      const existingRoom = await this.constructor.findOne({ code });
      if (!existingRoom) {
        isUnique = true;
      }
    }
    
    this.code = code;
  }
  next();
});

const Room = mongoose.model('Room', roomSchema);

// Create the index explicitly
Room.collection.createIndex({ code: 1 }, { unique: true });

module.exports = Room; 