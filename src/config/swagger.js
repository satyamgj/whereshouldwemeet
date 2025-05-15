const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhereToMeet API',
      version: '1.0.0',
      description: 'A location-based meeting app API',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        Location: {
          type: 'object',
          properties: {
            lat: {
              type: 'number',
              description: 'Latitude',
            },
            lng: {
              type: 'number',
              description: 'Longitude',
            },
          },
        },
        Participant: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'User ID',
            },
            location: {
              $ref: '#/components/schemas/Location',
            },
            preferences: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'List of user preferences',
            },
          },
        },
        Room: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Room name',
            },
            participants: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Participant',
              },
            },
            meetingPoint: {
              type: 'object',
              properties: {
                location: {
                  $ref: '#/components/schemas/Location',
                },
                name: {
                  type: 'string',
                },
                address: {
                  type: 'string',
                },
                placeId: {
                  type: 'string',
                },
              },
            },
            status: {
              type: 'string',
              enum: ['active', 'completed', 'cancelled'],
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'], // Path to the API routes
};

module.exports = swaggerJsdoc(options); 