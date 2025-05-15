import React, { useState, useEffect } from 'react';
import { FiSearch } from 'react-icons/fi';

const SUGGESTED_PREFERENCES = [
  'Restaurant',
  'Cafe',
  'Bar',
  'Park',
  'Shopping Mall',
  'Museum',
  'Library',
  'Gym',
  'Cinema',
  'Theater',
  'Sports Center',
  'Beach',
  'Mountain',
  'Lake',
  'Zoo',
  'Aquarium',
  'Botanical Garden',
  'Art Gallery',
  'Concert Hall',
  'Stadium'
];

const AddPreferenceForm = ({ onAddPreference, existingPreferences }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = SUGGESTED_PREFERENCES.filter(pref =>
        pref.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !existingPreferences.includes(pref)
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchTerm, existingPreferences]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim() && !existingPreferences.includes(searchTerm)) {
      onAddPreference(searchTerm);
      setSearchTerm('');
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    onAddPreference(suggestion);
    setSearchTerm('');
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search or add a preference"
            className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={!searchTerm.trim() || existingPreferences.includes(searchTerm)}
          className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300"
        >
          Add Preference
        </button>
      </form>
    </div>
  );
};

export default AddPreferenceForm; 