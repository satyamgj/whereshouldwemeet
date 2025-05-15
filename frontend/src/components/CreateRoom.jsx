import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMapPin, FiUsers, FiNavigation } from 'react-icons/fi';

const CreateRoom = () => {
  const [roomName, setRoomName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Get user's current location when component mounts
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationError('');
        },
        (error) => {
          setLocationError('Please enable location access to create a room');
          console.error('Geolocation error:', error);
        }
      );
    } else {
      setLocationError('Geolocation is not supported by your browser');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location.lat || !location.lng) {
      setLocationError('Please allow location access to create a room');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: roomName,
          creator: creatorName,
          location: location
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create room');
      }

      const data = await response.json();
      navigate(`/room/${data.code}`);
    } catch (err) {
      setError('Failed to create room. Please try again.');
      console.error('Create room error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Create a Meeting Room</h1>
          <p className="text-gray-600">Start planning your perfect meeting spot</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-2">
              Room Name
            </label>
            <input
              type="text"
              id="roomName"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter a name for your meeting"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="creatorName" className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              id="creatorName"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="Enter your name"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Location
            </label>
            <div className="flex items-center space-x-2">
              <FiNavigation className="text-gray-400" />
              {location.lat && location.lng ? (
                <span className="text-sm text-gray-600">
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </span>
              ) : (
                <span className="text-sm text-gray-500">Getting your location...</span>
              )}
            </div>
            {locationError && (
              <p className="mt-1 text-sm text-red-500">{locationError}</p>
            )}
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !roomName.trim() || !creatorName.trim() || !location.lat || !location.lng}
            className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300"
          >
            {loading ? 'Creating Room...' : 'Create Room'}
          </button>
        </form>

        <div className="mt-8 space-y-4">
          <div className="flex items-center text-gray-600">
            <FiMapPin className="mr-2" />
            <span>Add your location</span>
          </div>
          <div className="flex items-center text-gray-600">
            <FiUsers className="mr-2" />
            <span>Invite participants</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateRoom; 