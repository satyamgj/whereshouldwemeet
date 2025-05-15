import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMapPin, FiClock, FiUsers, FiSearch, FiShare2, FiNavigation, FiX, FiUser, FiStar, FiRefreshCw, FiCheck, FiLoader, FiPlus } from 'react-icons/fi';
import AddPreferenceForm from './AddPreferenceForm';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const MeetingPlanner = () => {
  const { roomCode } = useParams();
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [userName, setUserName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [participantDistances, setParticipantDistances] = useState([]);
  const [suggestedPlaces, setSuggestedPlaces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [votes, setVotes] = useState({});
  const [finalPlace, setFinalPlace] = useState(null);
  const [showFinalPlace, setShowFinalPlace] = useState(false);
  const [voteCounts, setVoteCounts] = useState(new Map());
  const [userVotes, setUserVotes] = useState(new Set());
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [voters, setVoters] = useState(new Map());
  const [isRoomCompleted, setIsRoomCompleted] = useState(false);
  const [placeVoters, setPlaceVoters] = useState(new Map());
  const [activeTab, setActiveTab] = useState('all');
  const [pageToken, setPageToken] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Add Google Maps script loading
  useEffect(() => {
    const loadGoogleMapsScript = () => {
      // Check if script is already loaded
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        setIsGoogleMapsLoaded(true);
        return;
      }

      if (window.google && window.google.maps) {
        setIsGoogleMapsLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer-when-downgrade';
      script.loading = 'async';
      script.onload = () => setIsGoogleMapsLoaded(true);
      script.onerror = () => {
        console.error('Failed to load Google Maps script');
        showErrorPopup('Failed to load Google Maps. Please refresh the page.');
      };
      document.head.appendChild(script);
    };

    loadGoogleMapsScript();
  }, []);

  const showErrorPopup = (message) => {
    setErrorMessage(message);
    setShowError(true);
    setTimeout(() => setShowError(false), 5000); // Hide after 5 seconds
  };

  const handleAddParticipant = useCallback(async (location, name) => {
    if (!name.trim()) {
      showErrorPopup('Please enter your name');
      return;
    }

    // Check if this location is already in participants
    const isAlreadyParticipant = participants.some(p => 
      Math.abs(p.location.lat - location.lat) < 0.000001 && 
      Math.abs(p.location.lng - location.lng) < 0.000001
    );
    
    if (isAlreadyParticipant) {
      showErrorPopup('This location is already added');
      return;
    }
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/rooms/${roomCode}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, name })
      });

      if (!response.ok) {
        throw new Error('Failed to add participant');
      }

      const updatedRoom = await response.json();
      setParticipants(updatedRoom.participants);
      setShowNameInput(false);
      setUserName('');
      setError('');
    } catch (err) {
      console.error('Add participant error:', err);
      showErrorPopup('Failed to add participant');
    }
  }, [roomCode, participants]);

  const handleGetLocation = () => {
    if (!userName.trim()) {
      setShowNameInput(true);
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setLocationError('');
          await handleAddParticipant(location, userName);
        },
        (error) => {
          setLocationError('Please enable location access to join the room');
          console.error('Geolocation error:', error);
        }
      );
    } else {
      setLocationError('Geolocation is not supported by your browser');
    }
  };

  const fetchRoom = async () => {
    try {
      console.log('Fetching room from:', `${process.env.REACT_APP_BACKEND_URL}/api/rooms/${roomCode}`);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/rooms/${roomCode}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Room fetch error response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      console.log('Response content type:', contentType);
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new TypeError("Server returned non-JSON response");
      }

      const data = await response.json();
      console.log('Room data received:', data);
      
      setRoom(data);
      setParticipants(data.participants);
      setPreferences(data.preferences || []);
      setIsRoomCompleted(data.status === 'completed');
      
      if (data.meetingPoint) {
        setFinalPlace(data.meetingPoint);
        setShowFinalPlace(true);
        // Calculate distances for final place
        if (isGoogleMapsLoaded && window.google && window.google.maps) {
          const service = new window.google.maps.DistanceMatrixService();
          const origins = data.participants.map(p => p.location);
          const destination = data.meetingPoint.location;

          const response = await new Promise((resolve, reject) => {
            service.getDistanceMatrix(
              {
                origins,
                destinations: [destination],
                travelMode: window.google.maps.TravelMode.DRIVING,
                unitSystem: window.google.maps.UnitSystem.METRIC
              },
              (response, status) => {
                if (status === 'OK') {
                  resolve(response);
                } else {
                  reject(new Error('Distance Matrix request failed'));
                }
              }
            );
          });

          const distances = data.participants.map((participant, index) => {
            const result = response.rows[index].elements[0];
            return {
              participant: participant.name,
              distance: result.distance.value / 1000,
              distanceText: result.distance.text,
              duration: result.duration.value / 60,
              durationText: result.duration.text
            };
          });

          // Calculate average distance
          const avgDistance = distances.reduce((sum, dist) => sum + dist.distance, 0) / distances.length;
          setFinalPlace(prev => ({ ...prev, averageDistance: avgDistance }));
          setParticipantDistances(distances);
        }
      }
    } catch (error) {
      console.error('Room fetch error:', error);
      showErrorPopup('Failed to load room data. Please try again.');
    }
  };

  useEffect(() => {
    if (roomCode) {
      fetchRoom();
    }
  }, [roomCode]);

  const handleAddPreference = async (preference) => {
    if (!preference.trim()) {
      toast.error('Please enter a preference');
      return;
    }

    if (preferences.includes(preference)) {
      toast.error('This preference already exists');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/rooms/${roomCode}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: [...preferences, preference] })
      });

      if (!response.ok) {
        throw new Error('Failed to add preference');
      }

      const updatedRoom = await response.json();
      setPreferences(updatedRoom.preferences);
      toast.success('Preference added successfully');
    } catch (err) {
      console.error('Add preference error:', err);
      toast.error('Failed to add preference');
    }
  };

  const handleRemovePreference = async (preference) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/rooms/${roomCode}/preferences/${encodeURIComponent(preference)}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove preference');
      }

      const updatedRoom = await response.json();
      setPreferences(updatedRoom.preferences);
      toast.success('Preference removed successfully');
    } catch (err) {
      console.error('Remove preference error:', err);
      toast.error('Failed to remove preference');
    }
  };

  const fetchVotes = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/rooms/${roomCode}/votes`);
      if (!response.ok) {
        throw new Error('Failed to fetch votes');
      }
      const data = await response.json();
      
      // Update vote counts and voters
      const newVoteCounts = new Map();
      const newPlaceVoters = new Map();
      const newUserVotes = new Set();
      
      Object.entries(data).forEach(([placeId, votes]) => {
        newVoteCounts.set(placeId, votes.length);
        // Store the actual voter names for each place
        newPlaceVoters.set(placeId, new Set(votes.map(vote => vote.participantName)));
        
        // Check if current user has voted
        if (votes.some(vote => vote.participantName === userName)) {
          newUserVotes.add(placeId);
        }
      });
      
      setVoteCounts(newVoteCounts);
      setPlaceVoters(newPlaceVoters);
      setUserVotes(newUserVotes);

      // Update suggested places with vote information
      setSuggestedPlaces(prevPlaces => 
        prevPlaces.map(place => ({
          ...place,
          votes: data[place.placeId] || []
        }))
      );
    } catch (error) {
      console.error('Error fetching votes:', error);
    }
  };

  const handleSelectFinalPlace = async (place) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/rooms/${roomCode}/final-place`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place })
      });

      if (!response.ok) {
        throw new Error('Failed to set final place');
      }

      const updatedRoom = await response.json();
      setFinalPlace(place);
      setShowFinalPlace(true);
      setIsRoomCompleted(true);
      toast.success('Final meeting place saved!');
      
      // Refresh the room data to get updated status
      await fetchRoom();
    } catch (error) {
      console.error('Select final place error:', error);
      toast.error('Failed to save final place');
    }
  };

  const handleVote = async (placeId) => {
    try {
      if (!selectedParticipant) {
        toast.error('Please select a participant to vote');
        return;
      }

      // Check if user has already voted
      if (userVotes.has(placeId)) {
        toast.error('You have already voted for this place');
        return;
      }

      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/rooms/${roomCode}/vote`, {
        placeId,
        participantName: selectedParticipant,
        participantLocation: participants.find(p => p.name === selectedParticipant)?.location
      });

      // Fetch updated votes immediately after voting
      await fetchVotes();

      // Check if this place has majority votes
      const totalParticipants = participants.length;
      const votesForPlace = voteCounts.get(placeId);
      if (votesForPlace > totalParticipants / 2) {
        const selectedPlace = suggestedPlaces.find(place => place.placeId === placeId);
        if (selectedPlace) {
          await handleSelectFinalPlace(selectedPlace);
        }
      }

      toast.success('Vote recorded successfully!');
    } catch (error) {
      console.error('Vote error:', error);
      toast.error(error.response?.data?.error || 'Failed to record vote');
    }
  };

  const handlePlaceSelect = async (place) => {
    setSelectedPlace(place);
    setIsLoading(true);

    try {
      // Create a Distance Matrix Service
      const service = new window.google.maps.DistanceMatrixService();
      
      // Prepare origins (participant locations) and destination (selected place)
      const origins = participants.map(p => p.location);
      const destination = place.location;

      // Request distance matrix
      const response = await new Promise((resolve, reject) => {
        service.getDistanceMatrix(
          {
            origins,
            destinations: [destination],
            travelMode: window.google.maps.TravelMode.DRIVING,
            unitSystem: window.google.maps.UnitSystem.METRIC
          },
          (response, status) => {
            if (status === 'OK') {
              resolve(response);
            } else {
              reject(new Error('Distance Matrix request failed'));
            }
          }
        );
      });

      // Process the results
      const distances = participants.map((participant, index) => {
        const result = response.rows[index].elements[0];
        return {
          participant: participant.name,
          distance: result.distance.value / 1000, // Convert meters to kilometers
          distanceText: result.distance.text,
          duration: result.duration.value / 60, // Convert seconds to minutes
          durationText: result.duration.text
        };
      });

      setParticipantDistances(distances);

      // Calculate average distance
      const avgDistance = distances.reduce((sum, dist) => sum + dist.distance, 0) / distances.length;
      place.averageDistance = avgDistance;
    } catch (error) {
      console.error('Error calculating distances:', error);
      toast.error('Failed to calculate distances and times');
    } finally {
      setIsLoading(false);
    }
  };

  const findPlaces = async () => {
    try {
      setIsLoadingMore(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/meeting-points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participants: participants.map(p => ({
            name: p.name,
            location: p.location
          })),
          preferences: preferences,
          pageToken: pageToken
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to find places');
      }

      const data = await response.json();
      
      if (pageToken) {
        // Append new places to existing ones
        setSuggestedPlaces(prev => [...prev, ...data.places]);
      } else {
        // Set initial places
        setSuggestedPlaces(data.places);
      }
      
      // Update page token for next request
      setPageToken(data.nextPageToken);
    } catch (error) {
      console.error('Error finding places:', error);
      showErrorPopup('Failed to find places. Please try again.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRemoveVote = async (placeId, participantName) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/rooms/${roomCode}/vote`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId, participantName })
      });

      if (!response.ok) {
        throw new Error('Failed to remove vote');
      }

      // Refresh votes after removal
      await fetchVotes();
      toast.success('Vote removed successfully');
    } catch (error) {
      console.error('Remove vote error:', error);
      toast.error('Failed to remove vote');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <p>Loading room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Error Popup */}
      <AnimatePresence>
        {showError && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50 flex items-center max-w-[90vw]"
          >
            <span className="text-sm">{errorMessage}</span>
            <button
              onClick={() => setShowError(false)}
              className="ml-4 text-red-700 hover:text-red-900"
            >
              <FiX />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-white shadow-sm px-4 sm:px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">{room?.name}</h1>
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('Room link copied to clipboard!');
          }}
          className="p-2 text-gray-600 hover:text-blue-500"
        >
          <FiShare2 size={20} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left Column - Controls */}
        <div className="w-full lg:w-[400px] bg-white shadow-lg flex flex-col">
          <div className="p-4 sm:p-6 overflow-y-auto">
            {/* Location Status */}
            <div className="mb-3 p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <FiNavigation className="text-gray-400 flex-shrink-0" size={16} />
                {userLocation ? (
                  <span className="text-sm text-gray-600 truncate">
                    Your location: {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">Location not shared</span>
                )}
              </div>
              {locationError && (
                <p className="mt-1 text-xs text-red-500">{locationError}</p>
              )}
              {error && (
                <p className="mt-1 text-xs text-red-500">{error}</p>
              )}
            </div>

            {/* Add Location Section */}
            <div className="mb-3">
              {showNameInput ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full p-2 border rounded text-sm"
                  />
                  <button
                    onClick={handleGetLocation}
                    className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
                  >
                    Share My Location
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNameInput(true)}
                  className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
                >
                  Add My Location
                </button>
              )}
            </div>

            {/* Participants List */}
            <div className="mb-3">
              <h2 className="text-sm font-semibold mb-2 text-gray-700 flex items-center">
                <FiUsers className="mr-2" size={16} /> Participants ({participants.length})
              </h2>
              <div className="space-y-1">
                {participants.map((participant, index) => (
                  <div key={index} className="flex items-center p-2 bg-gray-50 rounded">
                    <FiUser className="text-gray-500 mr-2" size={14} />
                    <span className="text-sm text-gray-700">{participant.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Preference Form */}
            <div className="mb-3">
              <h2 className="text-sm font-semibold mb-2 text-gray-700 flex items-center">
                <FiSearch className="mr-2" size={16} /> Add Preferences
              </h2>
              <AddPreferenceForm
                onAddPreference={handleAddPreference}
                existingPreferences={preferences}
              />
            </div>

            {/* Preferences List */}
            <div className="mb-3">
              <h2 className="text-sm font-semibold mb-2 text-gray-700 flex items-center">
                <FiSearch className="mr-2" size={16} /> Preferences
              </h2>
              <div className="flex flex-wrap gap-2">
                {preferences.map((pref, i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="group relative px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-sm flex items-center"
                  >
                    {pref}
                    <button
                      onClick={() => handleRemovePreference(pref)}
                      className="ml-1 text-blue-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove preference"
                    >
                      <FiX size={14} />
                    </button>
                  </motion.span>
                ))}
              </div>
            </div>

            {/* Find Places Button */}
            {participants.length >= 2 && preferences.length > 0 && (
              <button
                onClick={findPlaces}
                disabled={isLoading}
                className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:bg-blue-300 text-sm font-medium mb-3"
              >
                {isLoading ? 'Finding Places...' : 'Find Places'}
              </button>
            )}

            {/* Selected Place Details */}
            {selectedPlace && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-100">
                {/* Place Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-base font-semibold text-gray-800">{selectedPlace.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{selectedPlace.address}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <FiUsers size={14} />
                        {placeVoters.get(selectedPlace.placeId)?.size || 0} / {participants.length} voted
                      </span>
                    </div>
                  </div>
                </div>

                {/* Travel Information */}
                <div className="p-4 border-b border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Travel Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {participantDistances.map((info, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-gray-800 mb-1">{info.participant}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <FiMapPin size={14} />
                          <span>{info.distanceText}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <FiClock size={14} />
                          <span>{info.durationText}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-blue-800">Average Distance</p>
                    <p className="text-sm text-blue-600 mt-1">
                      {selectedPlace.averageDistance?.toFixed(1) || 'N/A'} km
                    </p>
                  </div>
                </div>

                {/* Voting Section */}
                <div className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <FiStar className="text-blue-500" size={18} />
                      <h4 className="text-sm font-medium text-gray-700">Voting</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
                        {voteCounts.get(selectedPlace.placeId) || 0} votes
                      </span>
                    </div>
                  </div>

                  {/* Voters List */}
                  <div className="mb-4 bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-sm font-medium text-gray-700">Voters</p>
                      <span className="text-xs text-gray-500">
                        {placeVoters.get(selectedPlace.placeId)?.length || 0} / {participants.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {participants.map((participant) => {
                        const hasVoted = placeVoters.get(selectedPlace.placeId)?.has(participant.name);
                        return (
                          <div 
                            key={participant.name} 
                            className={`flex items-center justify-between p-2 rounded-lg transition-all ${
                              hasVoted ? 'bg-blue-100' : 'bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                hasVoted ? 'bg-blue-200' : 'bg-gray-100'
                              }`}>
                                <FiUser size={16} className={hasVoted ? "text-blue-600" : "text-gray-400"} />
                              </div>
                              <span className="text-sm text-gray-700">{participant.name}</span>
                            </div>
                            {hasVoted ? (
                              <button
                                onClick={() => handleRemoveVote(selectedPlace.placeId, participant.name)}
                                className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-full hover:bg-red-50 transition-all"
                              >
                                Remove vote
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">Not voted</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Voting Controls */}
                  <div className="space-y-3">
                    <div className="relative">
                      <select
                        value={selectedParticipant}
                        onChange={(e) => setSelectedParticipant(e.target.value)}
                        className="w-full p-3 pl-10 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      >
                        <option value="">Select participant to vote</option>
                        {participants
                          .filter(p => !placeVoters.get(selectedPlace.placeId)?.has(p.name))
                          .map((p, i) => (
                            <option key={i} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                      <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    </div>
                    <button
                      onClick={() => handleVote(selectedPlace.placeId)}
                      disabled={!selectedParticipant}
                      className="w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all bg-blue-500 text-white hover:bg-blue-600 shadow-sm hover:shadow disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <FiStar size={16} />
                      Vote for this place
                    </button>
                  </div>

                  {/* Finalize Place Button */}
                  <button
                    onClick={() => handleSelectFinalPlace(selectedPlace)}
                    className="w-full mt-3 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all bg-green-500 text-white hover:bg-green-600 shadow-sm hover:shadow"
                  >
                    <FiCheck size={16} />
                    Select as Final Meeting Place
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Suggested Places */}
        <div className="flex-1 bg-gray-50 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <h2 className="text-xl font-bold text-gray-800">Suggested Places</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeTab === 'all'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All Places
                </button>
                <button
                  onClick={() => setActiveTab('voted')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeTab === 'voted'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Voted Places
                </button>
                <button
                  onClick={() => setActiveTab('final')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeTab === 'final'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Final Place
                </button>
              </div>
            </div>
            <button
              onClick={fetchVotes}
              className="p-2 text-gray-600 hover:text-blue-500 transition-colors self-end sm:self-auto"
              title="Refresh votes"
            >
              <FiRefreshCw size={20} />
            </button>
          </div>
          
          {suggestedPlaces.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <FiSearch size={32} className="mx-auto mb-2" />
                <p className="text-base">Click "Find Places" to see suggestions</p>
              </div>
            </div>
          ) : activeTab === 'final' ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              {finalPlace ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">{finalPlace.name}</h3>
                      <p className="text-gray-600 mt-1 truncate">{finalPlace.address}</p>
                    </div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(finalPlace.name + ' ' + finalPlace.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 transition-colors flex-shrink-0 ml-4"
                      title="Open in Google Maps"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </a>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {/* Location Details */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Location Details</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FiMapPin className="text-blue-500 flex-shrink-0" size={18} />
                          <span className="text-gray-700 truncate">Latitude: {finalPlace.location.lat}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FiMapPin className="text-blue-500 flex-shrink-0" size={18} />
                          <span className="text-gray-700 truncate">Longitude: {finalPlace.location.lng}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FiNavigation className="text-blue-500 flex-shrink-0" size={18} />
                          <span className="text-gray-700 truncate">Place ID: {finalPlace.placeId}</span>
                        </div>
                      </div>
                    </div>

                    {/* Travel Information */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Travel Information</h4>
                      <div className="space-y-3">
                        {participantDistances.map((info, index) => (
                          <div key={index} className="bg-white p-3 rounded-lg shadow-sm">
                            <p className="font-medium text-gray-800 truncate">{info.participant}</p>
                            <div className="flex items-center gap-2 text-gray-600 mt-1">
                              <FiMapPin className="flex-shrink-0" size={14} />
                              <span className="truncate">{info.distanceText}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600 mt-1">
                              <FiClock className="flex-shrink-0" size={14} />
                              <span className="truncate">{info.durationText}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                        <p className="font-medium text-blue-800">Average Distance</p>
                        <p className="text-blue-600 mt-1">
                          {finalPlace.averageDistance?.toFixed(1) || 'N/A'} km
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Voting Information */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">Voting Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-700 mb-2">Total Votes</p>
                        <div className="flex items-center gap-2">
                          <FiUsers className="text-blue-500 flex-shrink-0" size={18} />
                          <span className="text-lg font-medium text-gray-800">
                            {voteCounts.get(finalPlace.placeId) || 0} / {participants.length}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-700 mb-2">Voted By</p>
                        <div className="flex flex-wrap gap-2">
                          {Array.from(placeVoters.get(finalPlace.placeId) || []).map((voter, idx) => (
                            <span 
                              key={idx}
                              className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm flex items-center gap-1"
                            >
                              <FiUser className="flex-shrink-0" size={14} />
                              <span className="truncate">{voter}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Finalization Info */}
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FiCheck className="text-green-500 flex-shrink-0" size={20} />
                      <h4 className="text-lg font-semibold text-green-800">Finalized Meeting Place</h4>
                    </div>
                    <p className="text-green-700 mt-2">
                      This place has been selected as the final meeting point for all participants.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FiMapPin size={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500">No final place has been selected yet</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestedPlaces
                .filter(place => activeTab === 'all' || (activeTab === 'voted' && voteCounts.get(place.placeId) > 0))
                .map((place, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg cursor-pointer ${
                      selectedPlace?.placeId === place.placeId
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'bg-white border border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => handlePlaceSelect(place)}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 min-w-0">
                              <span className="text-sm font-medium text-gray-700 truncate">
                                {place.name}
                              </span>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 transition-colors flex-shrink-0"
                                title="Open in Google Maps"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </a>
                            </div>
                            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0">
                              <FiUsers size={12} />
                              {voteCounts.get(place.placeId) || 0}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1 truncate">{place.address}</p>

                          {/* Voters List */}
                          {placeVoters.get(place.placeId)?.size > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <div className="flex items-center gap-1.5 mb-2">
                                <FiStar size={12} className="text-blue-500 flex-shrink-0" />
                                <span className="text-xs font-medium text-gray-600">Voted by:</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {Array.from(placeVoters.get(place.placeId) || []).map((voter, idx) => (
                                  <span 
                                    key={idx}
                                    className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full flex items-center gap-1"
                                  >
                                    <FiUser className="flex-shrink-0" size={10} />
                                    <span className="truncate">{voter}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingPlanner; 