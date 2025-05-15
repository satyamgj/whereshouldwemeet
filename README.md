# WhereToMeet

A web application that helps groups find the optimal meeting point based on participants' locations and preferences.

## Features

- Create meeting rooms with unique codes
- Add participants with their locations
- Set preferences for meeting places
- Find optimal meeting points using Google Maps API
- Vote on suggested places
- View distances and travel times for each participant
- Select final meeting place

## Tech Stack

- Frontend: React.js
- Backend: Node.js, Express.js
- Database: MongoDB
- Maps: Google Maps API

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB Atlas account
- Google Maps API key

### Environment Variables

Frontend (.env):
```
REACT_APP_BACKEND_URL=http://localhost:5001
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Backend (.env):
```
MONGODB_URI=your_mongodb_uri
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
PORT=5001
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/wheretomeet.git
cd wheretomeet
```

2. Install dependencies:
```bash
# Install backend dependencies
cd src/backend
npm install

# Install frontend dependencies
cd ../../frontend
npm install
```

3. Start the development servers:
```bash
# Start backend server (from src/backend)
npm start

# Start frontend server (from frontend)
npm start
```

## Deployment

The application is configured for deployment on:
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

## License

MIT 