import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, NavigationArrow, MapPinLine, Spinner, Satellite } from '@phosphor-icons/react';
import axios from 'axios';

const SearchPanel = ({ onSearch, isSearching }) => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationCoords, setLocationCoords] = useState(null);
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);

  const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (origin.length > 2) {
        fetchSuggestions(origin, 'origin');
      } else {
        setOriginSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [origin]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (destination.length > 2) {
        fetchSuggestions(destination, 'destination');
      } else {
        setDestSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [destination]);

  const fetchSuggestions = async (query, type) => {
    try {
      const response = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
        {
          params: {
            access_token: MAPBOX_TOKEN,
            limit: 5,
            types: 'place,locality,neighborhood,address'
          }
        }
      );
      
      const suggestions = response.data.features.map(f => ({
        name: f.place_name,
        coords: { lng: f.center[0], lat: f.center[1] }
      }));
      
      if (type === 'origin') {
        setOriginSuggestions(suggestions);
      } else {
        setDestSuggestions(suggestions);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleUseCurrentLocation = useCallback(() => {
    setLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const coords = { lat: latitude, lng: longitude };
          setLocationCoords(coords);
          
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}`
            );
            const data = await response.json();
            if (data.features && data.features.length > 0) {
              setOrigin(data.features[0].place_name);
            } else {
              setOrigin(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            }
          } catch (error) {
            console.error('Error reverse geocoding:', error);
            setOrigin(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          } finally {
            setLoadingLocation(false);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          // Only alert if manually triggered, otherwise silent fail
          setLoadingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setLoadingLocation(false);
    }
  }, [MAPBOX_TOKEN]);

  // AUTO-DETECT LOCATION ON MOUNT
  useEffect(() => {
    handleUseCurrentLocation();
  }, [handleUseCurrentLocation]);

  const handleSearch = async () => {
    if (origin.trim() && destination.trim()) {
      onSearch(origin, destination, locationCoords);
    }
  };

  const selectSuggestion = (suggestion, type) => {
    if (type === 'origin') {
      setOrigin(suggestion.name);
      setLocationCoords(suggestion.coords);
      setShowOriginSuggestions(false);
    } else {
      setDestination(suggestion.name);
      setShowDestSuggestions(false);
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-[#050505]/95 backdrop-blur-sm">
      <div className="w-full max-w-2xl px-8">
        {/* Logo/Title */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold heading-font text-white mb-4 tracking-tight">
            Beyond-ETA
          </h1>
          <p className="text-lg text-[#A1A1AA]">
            Smart Navigation Beyond Time - Find the Best Route for Your Journey
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-8 backdrop-blur-xl">
          <h2 className="text-xl font-bold text-white mb-6 heading-font">Plan Your Route</h2>
          
          {/* Origin Input */}
          <div className="mb-4 relative">
            <label className="text-sm text-[#A1A1AA] mb-2 block">Starting Point</label>
            <div className="relative">
              <MapPin size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#00E676]" weight="fill" />
              <input
                data-testid="origin-input"
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                onFocus={() => setShowOriginSuggestions(true)}
                placeholder="Enter origin address or location"
                className="w-full bg-[#121212] border border-[#1A1A1A] rounded-sm py-3 pl-12 pr-28 text-white placeholder-[#71717A] focus:outline-none focus:border-white/20"
              />
              <button
                data-testid="use-current-location-btn"
                onClick={handleUseCurrentLocation}
                disabled={loadingLocation}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[#00E5FF] hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {loadingLocation ? (
                  <>
                    <Spinner size={12} className="animate-spin" />
                    Getting...
                  </>
                ) : (
                  <>
                    <MapPinLine size={14} />
                    Use Current
                  </>
                )}
              </button>
            </div>
            
            {/* Origin Suggestions */}
            {showOriginSuggestions && originSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-[#121212] border border-[#1A1A1A] rounded-sm shadow-lg max-h-60 overflow-y-auto">
                {originSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectSuggestion(suggestion, 'origin')}
                    className="px-4 py-3 hover:bg-[#1A1A1A] cursor-pointer flex items-start gap-3"
                  >
                    <MapPin size={16} className="text-[#00E676] mt-1" />
                    <span className="text-sm text-white">{suggestion.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Destination Input */}
          <div className="mb-6 relative">
            <label className="text-sm text-[#A1A1AA] mb-2 block">Destination</label>
            <div className="relative">
              <MapPin size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#FF3366]" weight="fill" />
              <input
                data-testid="destination-input"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onFocus={() => setShowDestSuggestions(true)}
                placeholder="Enter destination address or location"
                className="w-full bg-[#121212] border border-[#1A1A1A] rounded-sm py-3 pl-12 pr-4 text-white placeholder-[#71717A] focus:outline-none focus:border-white/20"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            {/* Destination Suggestions */}
            {showDestSuggestions && destSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-[#121212] border border-[#1A1A1A] rounded-sm shadow-lg max-h-60 overflow-y-auto">
                {destSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectSuggestion(suggestion, 'destination')}
                    className="px-4 py-3 hover:bg-[#1A1A1A] cursor-pointer flex items-start gap-3"
                  >
                    <MapPin size={16} className="text-[#FF3366] mt-1" />
                    <span className="text-sm text-white">{suggestion.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search Button */}
          <button
            data-testid="search-routes-btn"
            onClick={handleSearch}
            disabled={!origin.trim() || !destination.trim() || isSearching}
            className="w-full bg-white text-black py-4 rounded-sm font-bold text-lg heading-font hover:bg-[#00E5FF] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {isSearching ? (
              <>
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Calculating Best Routes...
              </>
            ) : (
              <>
                <NavigationArrow size={24} weight="fill" />
                Find Best Routes
              </>
            )}
          </button>

          {/* Quick Info */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center">
                <div className="w-10 h-10 bg-[#FFB020]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <div className="w-2 h-2 bg-[#FFB020] rounded-full" />
                </div>
                <div className="text-xs text-[#A1A1AA]">Pothole-Free</div>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-[#00E5FF]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <div className="w-2 h-2 bg-[#00E5FF] rounded-full" />
                </div>
                <div className="text-xs text-[#A1A1AA]">Clean Air</div>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-[#D500F9]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <div className="w-2 h-2 bg-[#D500F9] rounded-full" />
                </div>
                <div className="text-xs text-[#A1A1AA]">Safe Routes</div>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-[#FF3366]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <div className="w-2 h-2 bg-[#FF3366] rounded-full" />
                </div>
                <div className="text-xs text-[#A1A1AA]">Emergency</div>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-[#FF6D00]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <div className="w-2 h-2 bg-[#FF6D00] rounded-full" />
                </div>
                <div className="text-xs text-[#A1A1AA]">Drowsiness</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPanel;
