import React, { useState, useEffect, useRef, useCallback } from 'react';
import Map, { ScaleControl, Source, Layer, Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import axios from 'axios';
import { 
  Wind, 
  ShieldCheck, 
  Siren, 
  Eye,
  Warning,
  NavigationArrow,
  X,
  MapPin,
  Globe,
  TrafficSign,
  Lock,
  ActivityIcon
} from '@phosphor-icons/react';
import PotholeMode from './modes/PotholeMode';
import BreatheMode from './modes/BreatheMode';
import WomenSafetyMode from './modes/WomenSafetyMode';
import EmergencyMode from './modes/EmergencyMode';
import DrowsinessMode from './modes/DrowsinessMode';
import SafeRouteEngine from './modes/SafeRouteEngine';
import SearchPanel from './SearchPanel';
import { PremiumOverlay, SubscriptionPlans } from './ui/Subscription';
import PremiumSuccessModal from './ui/PremiumSuccessModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const API = `${BACKEND_URL}/api`;

// Map calculations and utilities
const calculateDistanceMeters = (from, to) => {
  const R = 6371000; // Earth radius in meters
  const dLat = (to[1] - from[1]) * Math.PI / 180;
  const dLon = (to[0] - from[0]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(from[1] * Math.PI / 180) * Math.cos(to[1] * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const calculateBearing = (from, to) => {
  const dLon = to[0] - from[0];
  const y = Math.sin(dLon) * Math.cos(to[1]);
  const x = Math.cos(from[1]) * Math.sin(to[1]) -
            Math.sin(from[1]) * Math.cos(to[1]) * Math.cos(dLon);
  return Math.atan2(y, x) * 180 / Math.PI;
};

const checkIfOnRoute = (userPos, routeCoords) => {
  const threshold = 0.001; // ~100 meters
  for (let coord of routeCoords) {
    const distance = Math.sqrt(
      Math.pow(userPos.lng - coord[0], 2) + 
      Math.pow(userPos.lat - coord[1], 2)
    );
    if (distance < threshold) return true;
  }
  return false;
};

const INITIAL_VIEW_STATE = {
  longitude: 77.5946,
  latitude: 12.9716,
  zoom: 12
};

const modes = [
  { id: 'pothole', name: 'Pothole Detection', icon: Warning, color: '#FFB020' },
  { id: 'safe_route', name: 'SafeRoute Engine', icon: ShieldCheck, color: '#00E676' },
  { id: 'breathe', name: 'Breathe Better', icon: Wind, color: '#00E5FF' },
  { id: 'safety', name: "Women's Safety", icon: ShieldCheck, color: '#D500F9' },
  { id: 'emergency', name: 'Emergency Alert', icon: Siren, color: '#FF3366' },
  { id: 'drowsiness', name: 'Drowsiness Monitor', icon: Eye, color: '#FF6D00' }
];

const Dashboard = () => {
  const [activeMode, setActiveMode] = useState('pothole');
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchData, setSearchData] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isOnRoute, setIsOnRoute] = useState(true);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState(null);
  const [distanceToTurn, setDistanceToTurn] = useState(null);
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/dark-v11');
  const [showTraffic, setShowTraffic] = useState(true);
  const [droneViewPerformed, setDroneViewPerformed] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ 
    x: typeof window !== 'undefined' ? (window.innerWidth - 340) / 2 : 100, 
    y: typeof window !== 'undefined' ? (window.innerHeight - 500) / 2 : 100 
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [userId, setUserId] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showSubscriptionPlans, setShowSubscriptionPlans] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [fatigueScore, setFatigueScore] = useState(15);
  const [aqiLevel, setAqiLevel] = useState(0);
  const [showPremiumSuccess, setShowPremiumSuccess] = useState(false);
  const userName = localStorage.getItem('userName') || "Pro Driver";
  const mapRef = useRef();

  // CALCULATE REAL DISTANCE/TIME LEFT
  const navigationMetrics = React.useMemo(() => {
    if (!selectedRoute) return null;
    
    // If navigation not started, use provided route metrics
    if (!navigationStarted || !userLocation) {
      return {
        distance: selectedRoute.distance,
        duration: selectedRoute.duration
      };
    }

    // If navigation started, recalculate distance from current point to final coordinate
    const endCoord = selectedRoute.coordinates[selectedRoute.coordinates.length - 1];
    const distMeters = calculateDistanceMeters(
      [userLocation.lng, userLocation.lat],
      endCoord
    );
    
    const distKm = (distMeters / 1000).toFixed(1);
    // Rough ETA approximation (original duration * percentage of distance remaining)
    const originalDist = selectedRoute.distance * 1000;
    const progressFactor = Math.min(distMeters / (originalDist || 1), 1);
    const estTime = Math.round(selectedRoute.duration * progressFactor);

    return {
      distance: distKm,
      duration: estTime > 0 ? estTime : 1
    };
  }, [selectedRoute, navigationStarted, userLocation]);

  const loadRoutes = useCallback(async (origin, destination, originCoords) => {
    setIsSearching(true);
    
    // DRONE VIEW STAGE 1: Zoom out to whole Earth (ONLY ONCE)
    if (mapRef.current && !droneViewPerformed) {
      await mapRef.current.flyTo({
        center: [0, 20],
        zoom: 1,
        pitch: 0,
        bearing: 0,
        duration: 2500,
        essential: true
      });
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    try {
      let startCoords = originCoords;
      let endCoords = null;
      
      if (!startCoords && origin) {
        const originGeocode = await geocodeAddress(origin);
        if (originGeocode) startCoords = originGeocode;
      }
      
      // Fallback if still no coords (though rare with auto-detect)
      if (!startCoords) {
        console.warn('No origin coords found, using device location fallback');
        startCoords = { lat: 12.9716, lng: 77.5946 }; // Keep as absolute last resort
      }
      
      if (destination) {
        const destGeocode = await geocodeAddress(destination);
        if (destGeocode) endCoords = destGeocode;
      }
      
      // DRONE VIEW STAGE 2: Scroll/Pan across the globe (ONLY ONCE)
      if (mapRef.current && !droneViewPerformed) {
        await mapRef.current.flyTo({
          center: [startCoords.lng, startCoords.lat],
          zoom: 4,
          pitch: 30,
          duration: 3500,
          essential: true
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        setDroneViewPerformed(true);
      }
      
      const response = await axios.post(`${API}/routes`, {
        start: startCoords,
        end: endCoords,
        mode: activeMode,
        origin_name: origin,
        destination_name: destination
      });
      
      const routesData = response.data;
      setRoutes(routesData);
      
      if (routesData.length > 0) {
        // FIXED ROUTE SELECTION: Check if our previously selected route ID still exists
        const currentId = selectedRouteId;
        const matchingRoute = currentId ? routesData.find(r => r.id === currentId) : null;
        
        if (matchingRoute) {
          setSelectedRoute(matchingRoute);
        } else {
          // No route selected yet or new search: Zoom to show ALL routes
          setSelectedRoute(null);
          setSelectedRouteId(null);
          
          if (mapRef.current) {
            const allCoords = routesData.flatMap(r => r.coordinates);
            const lngs = allCoords.map(c => c[0]);
            const lats = allCoords.map(c => c[1]);
            
            const bounds = [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)]
            ];
            
            mapRef.current.fitBounds(bounds, {
              padding: { top: 80, bottom: 80, left: 80, right: 340 }, // Offset for panel
              pitch: 0,
              duration: 2500,
              essential: true
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading routes:', error);
    } finally {
      setIsSearching(false);
    }
  }, [activeMode, droneViewPerformed]); // Removed selectedRouteId and isSearching from dependencies

  const geocodeAddress = async (address) => {
    try {
      const response = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}`
      );
      if (response.data.features && response.data.features.length > 0) {
        const [lng, lat] = response.data.features[0].center;
        return { lat, lng };
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    return null;
  };

  const handleSearch = useCallback((origin, destination, originCoords) => {
    setSearchData({ origin, destination, originCoords });
    loadRoutes(origin, destination, originCoords);
    setShowSearch(false);
  }, [loadRoutes]);

  const handleNewSearch = useCallback(() => {
    setShowSearch(true);
    setRoutes([]);
    setSelectedRoute(null);
    setSearchData(null);
    setDroneViewPerformed(false);
  }, []);

  const triggerEmergencyAlert = useCallback(async () => {
    setEmergencyActive(true);
    try {
      await axios.post(`${API}/emergency/alert`, {
        type: 'ambulance',
        location: { lat: 12.9716, lng: 77.5946 },
        message: 'Emergency vehicle detected - Clear the path',
        active: true
      });
    } catch (error) {
      console.error('Error creating alert:', error);
    }
    
    setTimeout(() => setEmergencyActive(false), 8000);
  }, []);




  // Add Razorpay Script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    
    // Reset subscription status on mount (every reload/refresh)
    const resetStatus = async () => {
      try {
        await axios.post(`${API}/subscription/reset`);
        setIsSubscribed(false);
      } catch (err) {
        console.error("Error resetting sub status:", err);
        setIsSubscribed(false); // Safety fallback
      }
    };
    resetStatus();
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleSelectPlan = async (plan) => {
    setSubscriptionLoading(true);
    try {
      // 1. Create order on backend
      const orderRes = await axios.post(`${API}/subscription/create-order`, {
        plan_type: plan.id,
        amount: plan.price
      });
      
      const order = orderRes.data;
      
      // 2. Open Razorpay Checkout
      const options = {
        key: 'rzp_test_SZefWeqvOktTqp',
        amount: order.amount,
        currency: order.currency,
        name: "Beyond ETA Pro",
        description: `${plan.name} Subscription`,
        order_id: order.id,
        handler: async (response) => {
          // 3. Verify payment on backend
          try {
            const verifyRes = await axios.post(`${API}/subscription/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_type: plan.id
            });
            
            if (verifyRes.data.status === 'success') {
              setIsSubscribed(true);
              setShowSubscriptionPlans(false);
              setShowPremiumSuccess(true);
              
              setTimeout(() => {
                 setShowPremiumSuccess(false);
              }, 6000);
            }
          } catch (err) {
            alert("Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          name: "Demo User",
          email: "user@example.com",
          contact: "9999999999"
        },
        theme: {
          color: "#FFD700"
        }
      };
      
      const rzp1 = new window.Razorpay(options);
      rzp1.open();
    } catch (err) {
      console.error("Razorpay Error:", err);
      alert("Failed to initiate payment. Please try again.");
    } finally {
      setSubscriptionLoading(false);
    }
  };

  useEffect(() => {
    if (!showSearch && searchData) {
      loadRoutes(searchData.origin, searchData.destination, searchData.originCoords);
    }
    
    // Live GPS tracking
    let watchId;
    if (!showSearch && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(newLocation);
          
          // Follow user location when navigation started
          if (navigationStarted && mapRef.current) {
            mapRef.current.flyTo({
              center: [newLocation.lng, newLocation.lat],
              zoom: 16,
              duration: 1000
            });
          }
          
          // Check if user is on route
          if (selectedRoute && selectedRoute.coordinates.length > 0) {
            const isNearRoute = checkIfOnRoute(newLocation, selectedRoute.coordinates);
            setIsOnRoute(isNearRoute);
            
            // Calculate turn-by-turn instructions
            if (navigationStarted) {
              const instruction = getNextInstruction(newLocation, selectedRoute.coordinates);
              setCurrentInstruction(instruction.text);
              setDistanceToTurn(instruction.distance);
            }
          }
        },
        (error) => console.error('Location tracking error:', error),
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    }
    
    const emergencyCheck = setInterval(() => {
      if (Math.random() < 0.05 && !showSearch) {
        triggerEmergencyAlert();
      }
    }, 10000);
    
    return () => {
      clearInterval(emergencyCheck);
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [loadRoutes, triggerEmergencyAlert, showSearch, searchData]); // Removed redundant dependencies like selectedRoute and navigationStarted


  const getNextInstruction = (userPos, routeCoords) => {
    if (!routeCoords || routeCoords.length < 2) {
      return { text: "Continue straight", distance: 0 };
    }

    let closestIndex = 0;
    let minDist = Infinity;

    // Find closest point on route
    for (let i = 0; i < routeCoords.length; i++) {
        const dist = Math.sqrt(
          Math.pow(userPos.lng - routeCoords[i][0], 2) + 
          Math.pow(userPos.lat - routeCoords[i][1], 2)
        );
        if (dist < minDist) {
          minDist = dist;
          closestIndex = i;
        }
      }

    // Look ahead for turns
    const lookAheadPoints = 10;
    const endIndex = Math.min(closestIndex + lookAheadPoints, routeCoords.length - 1);
    
    if (endIndex > closestIndex + 1) {
      const bearing1 = calculateBearing(routeCoords[closestIndex], routeCoords[closestIndex + 1]);
      const bearing2 = calculateBearing(routeCoords[endIndex - 1], routeCoords[endIndex]);
      const angleDiff = Math.abs(bearing2 - bearing1);
      
      const distanceMeters = calculateDistanceMeters(
        routeCoords[closestIndex],
        routeCoords[endIndex]
      );
      
      if (angleDiff > 30 && angleDiff < 150) {
        return {
          text: angleDiff > 90 ? "Turn left" : "Turn right",
          distance: Math.round(distanceMeters)
        };
      }
    }
    
    return { text: "Continue straight", distance: 0 };
  };

  const handleStartNavigation = () => {
    setNavigationStarted(true);
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 16,
        pitch: 45,
        duration: 2000
      });
    }
  };

  const handleDragStart = (e) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleDragUpdate = useCallback((e) => {
    if (isDragging) {
      const newX = Math.max(16, Math.min(window.innerWidth - 356, e.clientX - dragOffset.x));
      const newY = Math.max(16, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));
      setPanelPosition({ x: newX, y: newY });
    }
  }, [isDragging, dragOffset]);

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragUpdate);
      window.addEventListener('mouseup', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragUpdate);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, handleDragUpdate]);

  return (
    <div className="w-screen h-screen bg-[#050505] overflow-hidden flex">
      {/* Search Panel Overlay */}
      {showSearch && (
        <SearchPanel onSearch={handleSearch} isSearching={isSearching} />
      )}

      {/* Emergency Alert Banner */}
      {emergencyActive && (
        <div 
          data-testid="emergency-alert-banner"
          className="absolute top-0 left-0 right-0 bg-[#FF3366] text-white py-2 px-4 z-50 flex items-center justify-center gap-3 blink"
        >
          <Siren size={24} weight="fill" />
          <span className="text-sm font-black heading-font tracking-widest">
            EMERGENCY VEHICLE DETECTED - CLEAR THE PATH
          </span>
          <Siren size={24} weight="fill" />
        </div>
      )}

      {/* Side Navigation */}
      <div className="w-16 bg-[#0A0A0A] border-r border-white/5 flex flex-col items-center py-6 gap-4 z-40">
        <div className="mb-2">
          <NavigationArrow size={24} weight="bold" className="text-white" />
        </div>
        
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;
          
          return (
            <button
              key={mode.id}
              data-testid={`mode-toggle-${mode.id}`}
              onClick={() => setActiveMode(mode.id)}
              className={`w-11 h-11 rounded-sm flex items-center justify-center transition-all duration-150 ${
                isActive
                  ? 'bg-white text-black' 
                  : 'bg-[#121212] text-[#A1A1AA] hover:bg-[#1A1A1A] hover:text-white'
              }`}
              style={isActive ? { boxShadow: `0 0 15px ${mode.color}` } : {}}
              title={mode.name}
            >
              <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
            </button>
          );
        })}
      </div>

      {/* Main Content Area - FULL SCREEN MAP WITH OVERLAYS */}
      <div className="flex-1 relative overflow-hidden">
        {/* MAP CONTAINER */}
        <div className="absolute inset-0">
          <Map
            ref={mapRef}
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
            mapStyle={mapStyle}
            interactiveLayerIds={[]}
          >
            <ScaleControl position="bottom-right" unit="metric" />
            {/* Traffic Layer */}
            {showTraffic && (
              <Source id="mapbox-traffic" type="vector" url="mapbox://mapbox.mapbox-traffic-v1">
                <Layer
                  id="traffic"
                  type="line"
                  source-layer="traffic"
                  paint={{
                    'line-width': 4,
                    'line-color': [
                      'case',
                      ['==', ['get', 'congestion'], 'low'], '#00E676',
                      ['==', ['get', 'congestion'], 'moderate'], '#FFB020',
                      ['==', ['get', 'congestion'], 'heavy'], '#FF6D00',
                      ['==', ['get', 'congestion'], 'severe'], '#FF3366',
                      '#A1A1AA'
                    ]
                  }}
                />
              </Source>
            )}

            {/* Draw all available routes using a unified FeatureCollection */}
            {routes.length > 0 && (
              <Source
                id="all-routes-source"
                type="geojson"
                data={{
                  type: 'FeatureCollection',
                  features: routes.map(route => {
                    if (!route || !route.coordinates || !Array.isArray(route.coordinates) || route.coordinates.length < 2) return null;
                    const isSelected = selectedRoute ? selectedRoute.id === route.id : true;
                    const isNotSelectedButOthersAre = selectedRoute && selectedRoute.id !== route.id;
                    const baseColor = modes.find(m => m.id === activeMode)?.color || '#FFB020';

                    return {
                      type: 'Feature',
                      properties: {
                        color: isNotSelectedButOthersAre ? '#71717A' : baseColor,
                        width: isSelected ? 8 : 4,
                        opacity: isNotSelectedButOthersAre ? 0.3 : (selectedRoute ? 1 : 0.6)
                      },
                      geometry: {
                        type: 'LineString',
                        coordinates: route.coordinates
                      }
                    };
                  }).filter(Boolean)
                }}
              >
                <Layer
                  id="all-routes-layer"
                  type="line"
                  layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                  paint={{
                    'line-color': ['get', 'color'],
                    'line-width': ['get', 'width'],
                    'line-opacity': ['get', 'opacity']
                  }}
                />
              </Source>
            )}

            {/* Start and End markers */}
            {(selectedRoute || routes.length > 0) && (
              (() => {
                const markerRoute = selectedRoute || routes[0];
                if (!markerRoute || !markerRoute.coordinates || !Array.isArray(markerRoute.coordinates) || markerRoute.coordinates.length < 2) return null;
                const firstCoord = markerRoute.coordinates[0];
                const lastCoord = markerRoute.coordinates[markerRoute.coordinates.length - 1];
                
                if (!firstCoord || firstCoord.length < 2 || !lastCoord || lastCoord.length < 2) return null;
                
                return (
                  <React.Fragment key="route-markers">
                    <Marker longitude={firstCoord[0]} latitude={firstCoord[1]} anchor="bottom">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 bg-[#00E676] rounded-full border-4 border-[#0A0A0A] shadow-xl flex items-center justify-center">
                          <MapPin size={24} weight="fill" className="text-white" />
                        </div>
                      </div>
                    </Marker>
                    <Marker longitude={lastCoord[0]} latitude={lastCoord[1]} anchor="bottom">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 bg-[#FF3366] rounded-full border-4 border-[#0A0A0A] shadow-xl flex items-center justify-center">
                          <MapPin size={24} weight="fill" className="text-white" />
                        </div>
                      </div>
                    </Marker>
                  </React.Fragment>
                );
              })()
            )}

            {/* User current location */}
            {userLocation && (
              <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
                <div className="relative">
                  <div className={`w-6 h-6 rounded-full border-4 border-white shadow-xl ${
                    isOnRoute ? 'bg-[#00E5FF]' : 'bg-[#FF6D00]'
                  }`}>
                    <div className="absolute inset-0 rounded-full animate-ping opacity-75" 
                      style={{ backgroundColor: isOnRoute ? '#00E5FF' : '#FF6D00' }} 
                    />
                  </div>
                </div>
              </Marker>
            )}
          </Map>

          {/* Turn-by-turn instruction - floating over map */}
          {navigationStarted && currentInstruction && (
            <div className="absolute bottom-10 left-10 w-96 bg-[#0A0A0A]/95 backdrop-blur-xl border-2 border-[#00E5FF] rounded-sm p-4 z-30 shadow-2xl animate-in slide-in-from-bottom duration-300">
               <div className="flex items-center gap-4">
                <NavigationArrow 
                  size={32} 
                  weight="fill" 
                  className="text-[#00E5FF]"
                  style={{ 
                    transform: currentInstruction.includes('left') ? 'rotate(-90deg)' : 
                               currentInstruction.includes('right') ? 'rotate(90deg)' : 'none'
                  }}
                />
                <div className="flex-1">
                  <div className="text-xl font-black heading-font text-white uppercase tracking-tight">
                    {currentInstruction}
                  </div>
                  {distanceToTurn > 0 && (
                    <div className="text-xs text-[#00E5FF] font-black telemetry-font tracking-widest mt-1">
                      IN {distanceToTurn >= 1000 ? `${(distanceToTurn / 1000).toFixed(1)} KM` : `${distanceToTurn} METERS`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MINI CENTERED GLASS INFO CARD */}
          {selectedRoute && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 animate-in slide-in-from-top duration-500">
              <div className="px-6 py-2 bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/20 rounded-sm shadow-2xl flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#A1A1AA] mb-0.5">Remaining</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-white telemetry-font">{navigationMetrics?.distance}</span>
                    <span className="text-[10px] font-bold text-[#00E5FF]">KM</span>
                  </div>
                </div>
                
                <div className="w-px h-6 bg-white/10" />
                
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#A1A1AA] mb-0.5">Est. Arrival</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-white telemetry-font">{navigationMetrics?.duration}</span>
                    <span className="text-[10px] font-bold text-[#00E5FF]">MIN</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FLOATING DRAGGABLE PANEL */}
        {!showSearch && (
          <div 
            style={{ 
              position: 'absolute', 
              left: `${panelPosition.x}px`, 
              top: `${panelPosition.y}px`,
              width: '340px',
              maxHeight: 'calc(100vh - 120px)',
              zIndex: 100,
              cursor: isDragging ? 'grabbing' : 'auto'
            }}
            className="bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/10 overflow-y-auto custom-scrollbar rounded-sm shadow-2xl flex flex-col"
          >
            {/* Draggable Header */}
            <div 
              onMouseDown={handleDragStart}
              className="p-6 border-b border-white/5 bg-[#0D0D0D]/50 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-white/20">
                    {React.createElement(modes.find(m => m.id === activeMode).icon, {
                      size: 24,
                      weight: 'fill',
                      style: { color: modes.find(m => m.id === activeMode).color }
                    })}
                  </div>
                  <div>
                    <h2 className="text-lg font-black heading-font text-white uppercase tracking-tighter">
                      {modes.find(m => m.id === activeMode).name}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-1.5 h-1.5 bg-[#00E676] rounded-full blink" />
                      <span className="text-[9px] uppercase font-bold text-[#A1A1AA] tracking-[0.2em]">Live Telemetry</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNewSearch();
                  }}
                  className="w-8 h-8 rounded-sm bg-[#1A1A1A] text-[#A1A1AA] hover:text-white hover:bg-white/10 transition-all flex items-center justify-center border border-white/10 pointer-events-auto"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="overflow-y-auto flex-1">
              <div className="p-6 border-b border-white/5">
                {/* Route Summary */}
                {searchData && (
                  <div className="space-y-6">
                    <div className="relative pl-6 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5">
                      <div className="flex items-start gap-4">
                        <div className="w-3 h-3 rounded-full bg-[#00E676] mt-1.5 ring-4 ring-[#00E676]/20" />
                        <div>
                          <div className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">Origin</div>
                          <div className="text-sm font-medium text-white line-clamp-1">{searchData.origin}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-3 h-3 rounded-full bg-[#FF3366] mt-1.5 ring-4 ring-[#FF3366]/20" />
                        <div>
                          <div className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">Destination</div>
                          <div className="text-sm font-medium text-white line-clamp-1">{searchData.destination}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#121212] border border-white/5 p-3 rounded-sm">
                        <div className="text-[9px] uppercase font-bold text-[#71717A] tracking-wider mb-1">Distance</div>
                        <div className="text-xl font-bold text-white telemetry-font">{selectedRoute?.distance || '--'} <span className="text-[10px] font-normal text-[#A1A1AA]">KM</span></div>
                      </div>
                      <div className="bg-[#121212] border border-white/5 p-3 rounded-sm">
                        <div className="text-[9px] uppercase font-bold text-[#71717A] tracking-wider mb-1">Time</div>
                        <div className="text-xl font-bold text-white telemetry-font">{selectedRoute?.duration || '--'} <span className="text-[10px] font-normal text-[#A1A1AA]">MIN</span></div>
                      </div>
                    </div>

                    {!navigationStarted && userLocation && (
                      <button
                        onClick={handleStartNavigation}
                        disabled={!selectedRoute}
                        className={`w-full h-11 rounded-sm font-black uppercase tracking-widest transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg ${
                          selectedRoute 
                            ? 'bg-[#00E676] text-[#0A0A0A] hover:bg-white shadow-[0_0_20px_rgba(0,230,118,0.2)]' 
                            : 'bg-white/5 text-[#424242] cursor-not-allowed border border-white/5'
                        }`}
                      >
                        <NavigationArrow size={20} weight="fill" />
                        Begin Trip
                      </button>
                    )}
                  </div>
                )}
              </div>

            {/* Main Content Sections */}
            <div className="p-6 space-y-8">
              {/* Route Options Gallery */}
              {routes.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#71717A]">Options</h3>
                    <div className="text-[8px] font-bold text-[#00E5FF] px-2 py-0.5 bg-[#00E5FF]/10 rounded-full uppercase">Optimized</div>
                  </div>
                  <div className="space-y-2">
                    {routes.map((route) => (
                      <button
                        key={route.id}
                        onClick={() => {
                          setSelectedRoute(route);
                          setSelectedRouteId(route.id);
                          
                          // Focus map on selected route
                          if (mapRef.current) {
                            const lngs = route.coordinates.map(c => c[0]);
                            const lats = route.coordinates.map(c => c[1]);
                            mapRef.current.fitBounds([
                              [Math.min(...lngs), Math.min(...lats)],
                              [Math.max(...lngs), Math.max(...lats)]
                            ], {
                              padding: 50,
                              pitch: 45,
                              duration: 1500
                            });
                          }
                        }}
                        className={`w-full p-4 rounded-sm border transition-all text-left relative overflow-hidden group ${
                          selectedRouteId === route.id
                            ? 'bg-white/5 border-white/30 shadow-md'
                            : 'bg-[#121212] border-white/5 hover:border-white/10'
                        }`}
                      >
                        {selectedRouteId === route.id && (
                          <div className="absolute top-0 left-0 w-1 h-full bg-[#00E5FF]" />
                        )}
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-[11px] font-black text-white uppercase tracking-tight">{route.mode}</div>
                          {route.metrics?.type === 'fastest' && <div className="text-[8px] font-bold text-white bg-[#00E676] px-1.5 py-0.5 rounded-sm">FASTEST</div>}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <span className="text-[8px] uppercase font-bold text-[#71717A]">T</span>
                            <span className="text-sm font-bold text-white telemetry-font">{route.duration}m</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] uppercase font-bold text-[#71717A]">P</span>
                            <span className={`text-sm font-bold telemetry-font ${route.pothole_count < 5 ? 'text-[#00E676]' : 'text-[#FFB020]'}`}>
                              {route.pothole_count}
                            </span>
                          </div>
                          {route.metrics?.pollution_reduction && (
                            <div className="flex flex-col ml-auto">
                              <span className="text-[8px] uppercase font-bold text-[#71717A]">AQI</span>
                              <span className="text-sm font-bold text-[#00E5FF] telemetry-font">{Math.round(route.aqi_average)}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Mode Specific Dynamic Content */}
              <section className="bg-[#121212] border border-white/5 rounded-sm overflow-hidden flex flex-col min-h-[320px]">
                <div className="border-b border-white/5 p-4 bg-white/5 flex items-center gap-3 flex-none">
                   <div className="w-1.5 h-1.5 bg-[#00E5FF] rounded-full animate-pulse" />
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Live Telemetry</h3>
                </div>
                <div className="p-4 flex-1">
                  {activeMode === 'pothole' && <PotholeMode routes={routes} selectedRoute={selectedRoute} setSelectedRoute={setSelectedRoute} />}
                  
                  {activeMode === 'safe_route' && (
                    <PremiumOverlay 
                      isSubscribed={isSubscribed} 
                      onUpgrade={() => setShowSubscriptionPlans(true)}
                      featureName="SafeRoute AI Engine"
                    >
                      <SafeRouteEngine routes={routes} selectedRoute={selectedRoute} setSelectedRoute={setSelectedRoute} />
                    </PremiumOverlay>
                  )}
                  
                  {activeMode === 'breathe' && (
                    <BreatheMode routes={routes} selectedRoute={selectedRoute} setSelectedRoute={setSelectedRoute} userLocation={userLocation} />
                  )}
                  
                  {activeMode === 'safety' && (
                    <WomenSafetyMode 
                      routes={routes} 
                      selectedRoute={selectedRoute} 
                      setSelectedRoute={setSelectedRoute} 
                      isSubscribed={isSubscribed}
                      onUpgrade={() => setShowSubscriptionPlans(true)}
                    />
                  )}
                  
                  {activeMode === 'emergency' && (
                    <EmergencyMode 
                      isSubscribed={isSubscribed} 
                      onUpgrade={() => setShowSubscriptionPlans(true)} 
                    />
                  )}
                  
                  {activeMode === 'drowsiness' && (
                    <PremiumOverlay 
                      isSubscribed={isSubscribed} 
                      onUpgrade={() => setShowSubscriptionPlans(true)}
                      featureName="Driver Fatigue Monitor"
                    >
                      <DrowsinessMode />
                    </PremiumOverlay>
                  )}
                </div>
              </section>

              {/* View Settings Section */}
              <section className="pt-6 border-t border-white/5">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#71717A] mb-4">View Settings</h3>
                  <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMapStyle(
                      mapStyle.includes('satellite') 
                        ? 'mapbox://styles/mapbox/dark-v11' 
                        : 'mapbox://styles/mapbox/satellite-streets-v12'
                    )}
                    className={`flex items-center justify-center gap-2 h-10 rounded-sm border transition-all ${
                      mapStyle.includes('satellite') 
                        ? 'bg-white text-black border-white' 
                        : 'bg-[#1A1A1A] text-white border-white/10 hover:border-white/30'
                    }`}
                  >
                    <Globe size={16} weight="fill" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Sat</span>
                  </button>
                  <button
                    onClick={() => setShowTraffic(!showTraffic)}
                    className={`flex items-center justify-center gap-2 h-10 rounded-sm border transition-all ${
                      showTraffic 
                        ? 'bg-[#00E676] text-black border-[#00E676]' 
                        : 'bg-[#1A1A1A] text-white border-white/10 hover:border-white/30'
                    }`}
                  >
                    <TrafficSign size={16} weight="fill" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Traffic</span>
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Panels */}
      <section className="absolute bottom-6 left-6 z-[100] flex flex-col gap-4">
        {/* Floating Safety Dashboard (Premium Mini-Teaser) */}
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-sm p-4 flex items-center gap-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FF6D00]/20 rounded-full">
              <ActivityIcon size={18} className="text-[#FF6D00]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold text-[#71717A] tracking-widest">Fatigue</span>
              <span className="text-sm font-bold text-white telemetry-font">{fatigueScore}%</span>
            </div>
          </div>
          
          <div className="w-[1px] h-8 bg-white/10" />

          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00E5FF]/20 rounded-full">
              <Wind size={18} className="text-[#00E5FF]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold text-[#71717A] tracking-widest">AQI Level</span>
              <span className="text-sm font-bold text-white telemetry-font">42</span>
            </div>
          </div>

          {!isSubscribed && (
            <div 
              className="flex items-center gap-2 px-3 py-1 bg-[#FFD700]/20 border border-[#FFD700]/40 rounded-full cursor-pointer hover:bg-[#FFD700]/30 transition-colors"
              onClick={() => setShowSubscriptionPlans(true)}
            >
              <Lock size={12} weight="fill" className="text-[#FFD700]" />
              <span className="text-[8px] font-black text-[#FFD700] uppercase tracking-widest">GO PRO</span>
            </div>
          )}
        </div>
      </section>

      {/* Subscription Modal */}
      <SubscriptionPlans 
        isOpen={showSubscriptionPlans} 
        onClose={() => setShowSubscriptionPlans(false)} 
        onSelectPlan={handleSelectPlan}
        loading={subscriptionLoading}
      />
      
      {showPremiumSuccess && (
        <PremiumSuccessModal 
          userName={userName} 
          onClose={() => setShowPremiumSuccess(false)} 
        />
      )}
    </div>
  </div>
);
};

export default Dashboard;
