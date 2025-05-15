const { body, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Room validation middleware
const validateRoom = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Room name is required'),
  body('creator')
    .trim()
    .notEmpty()
    .withMessage('Creator name is required'),
  validate
];

// Participant validation middleware
const validateParticipant = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Participant name is required'),
  body('location')
    .isObject()
    .withMessage('Location must be an object'),
  body('location.lat')
    .isFloat()
    .withMessage('Latitude must be a number'),
  body('location.lng')
    .isFloat()
    .withMessage('Longitude must be a number'),
  validate
];

// Preferences validation middleware
const validatePreferences = [
  body('preferences')
    .optional()
    .isArray()
    .withMessage('Preferences must be an array'),
  body('preferences.*')
    .optional()
    .isString()
    .withMessage('Each preference must be a string'),
  validate
];

module.exports = {
  validateRoom,
  validateParticipant,
  validatePreferences
}; 