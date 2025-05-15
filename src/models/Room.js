const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  roomCode: {
    type: String,
    required: false,
    unique: true
  },
  participants: [{
    userId: String,
    location: {
      lat: Number,
      lng: Number
    },
    preferences: [{
      type: String,
      trim: true
    }]
  }],
  meetingPoint: {
    location: {
      lat: Number,
      lng: Number
    },
    name: String,
    address: String,
    placeId: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  }
});

// Generate room code before validation
roomSchema.pre('validate', async function(next) {
  if (!this.roomCode) {
    // Generate a 6-character alphanumeric code
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    let isUnique = false;
    
    while (!isUnique) {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      
      // Check if code already exists
      const existingRoom = await this.constructor.findOne({ roomCode: code });
      if (!existingRoom) {
        isUnique = true;
      }
    }
    
    this.roomCode = code;
  }
  next();
});

module.exports = mongoose.model('Room', roomSchema); 