/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './components/StartScreen';
import Canvas from './components/Canvas';
import WardrobePanel from './components/WardrobeModal';
import OutfitStack from './components/OutfitStack';
import { generateVirtualTryOnImage, generatePoseVariation, enhanceAndUpscaleImage, changeBackgroundImage } from './services/geminiService';
import { OutfitLayer, WardrobeItem, SavedOutfit } from './types';
import { ChevronDownIcon, ChevronUpIcon } from './components/icons';
import { defaultWardrobe } from './wardrobe';
import { defaultBackgrounds } from './backgrounds';
import Footer from './components/Footer';
import { getFriendlyErrorMessage, downloadImage, dbGet, dbSet, dbDel } from './lib/utils';
import Spinner from './components/Spinner';
import SavedOutfitsPanel from './components/SavedOutfitsPanel';
import BackgroundPanel from './components/BackgroundPanel';
import AdComponent from './components/AdComponent';

const POSE_INSTRUCTIONS = [
  "Full frontal view, hands on hips",
  "Slightly turned, 3/4 view",
  "Side profile view",
  "Jumping in the air, mid-action shot",
  "Walking towards camera",
  "Leaning against a wall",
  "Hands in pockets, casual stance",
  "Arms crossed, confident stance",
  "Looking over shoulder towards camera",
  "Sitting on a stool, looking at camera",
  "Dynamic dancing pose",
];

const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQueryList.addEventListener('change', listener);
    
    if (mediaQueryList.matches !== matches) {
      setMatches(mediaQueryList.matches);
    }

    return () => {
      mediaQueryList.removeEventListener('change', listener);
    };
  }, [query, matches]);

  return matches;
};


const App: React.FC = () => {
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  const [outfitHistory, setOutfitHistory] = useState<OutfitLayer[]>([]);
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(defaultWardrobe);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  // Manage online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load session from IndexedDB on initial render
  useEffect(() => {
    const loadSession = async () => {
        try {
            const savedSession = await dbGet<{
                modelImageUrl: string;
                outfitHistory: OutfitLayer[];
                wardrobe: WardrobeItem[];
                currentOutfitIndex: number;
            }>('vto-session');
            if (savedSession && savedSession.modelImageUrl) {
                setModelImageUrl(savedSession.modelImageUrl);
                setOutfitHistory(savedSession.outfitHistory);
                setWardrobe(savedSession.wardrobe);
                setCurrentOutfitIndex(savedSession.currentOutfitIndex);
            }
        } catch (e) {
            console.error("Failed to load session from IndexedDB", e);
        } finally {
            setIsSessionLoaded(true);
        }
    };
    loadSession();
  }, []); // Run only once on mount

  // Persist session to IndexedDB whenever it changes
  useEffect(() => {
    if (isSessionLoaded && modelImageUrl) {
      dbSet('vto-session', { modelImageUrl, outfitHistory, wardrobe, currentOutfitIndex })
        .catch(e => console.error("Failed to save session to IndexedDB", e));
    }
  }, [modelImageUrl, outfitHistory, wardrobe, currentOutfitIndex, isSessionLoaded]);


  // Load saved outfits from localStorage on initial render
  useEffect(() => {
    try {
      const storedOutfits = localStorage.getItem('savedOutfits');
      if (storedOutfits) {
        setSavedOutfits(JSON.parse(storedOutfits));
      }
    } catch (e) {
      console.error("Failed to load saved outfits from localStorage", e);
    }
  }, []);

  // Persist saved outfits to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('savedOutfits', JSON.stringify(savedOutfits));
    } catch (e) {
      console.error("Failed to save outfits to localStorage", e);
    }
  }, [savedOutfits]);


  const activeOutfitLayers = useMemo(() => 
    outfitHistory.slice(0, currentOutfitIndex + 1), 
    [outfitHistory, currentOutfitIndex]
  );
  
  const activeGarmentIds = useMemo(() => 
    activeOutfitLayers.map(layer => layer.garment?.id).filter(Boolean) as string[], 
    [activeOutfitLayers]
  );
  
  const displayImageUrl = useMemo(() => {
    if (outfitHistory.length === 0) return modelImageUrl;
    const currentLayer = outfitHistory[currentOutfitIndex];
    if (!currentLayer) return modelImageUrl;

    const poseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
    return currentLayer.poseImages[poseInstruction] ?? Object.values(currentLayer.poseImages)[0];
  }, [outfitHistory, currentOutfitIndex, currentPoseIndex, modelImageUrl]);

  const availablePoseKeys = useMemo(() => {
    if (outfitHistory.length === 0) return [];
    const currentLayer = outfitHistory[currentOutfitIndex];
    return currentLayer ? Object.keys(currentLayer.poseImages) : [];
  }, [outfitHistory, currentOutfitIndex]);

  const handleModelFinalized = (url: string) => {
    if (!isOnline) {
      setError("You are offline. Please connect to the internet to start a new session.");
      return;
    }
    setModelImageUrl(url);
    setOutfitHistory([{
      garment: null,
      poseImages: { [POSE_INSTRUCTIONS[0]]: url }
    }]);
    setCurrentOutfitIndex(0);
  };

  const handleStartOver = () => {
    setModelImageUrl(null);
    setOutfitHistory([]);
    setCurrentOutfitIndex(0);
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setCurrentPoseIndex(0);
    setIsSheetCollapsed(false);
    setWardrobe(defaultWardrobe);
    dbDel('vto-session').catch(e => console.error("Failed to delete session from DB", e));
  };

  const handleGarmentSelect = useCallback(async (garmentFile: File, garmentInfo: WardrobeItem) => {
    if (!displayImageUrl || isLoading) return;

    const nextLayer = outfitHistory[currentOutfitIndex + 1];
    if (nextLayer && nextLayer.garment?.id === garmentInfo.id) {
        setCurrentOutfitIndex(prev => prev + 1);
        setCurrentPoseIndex(0);
        return;
    }
    
    if (!isOnline) {
      setError("You are offline. Connect to the internet to add new items.");
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Adding ${garmentInfo.name}...`);

    try {
      const newImageUrl = await generateVirtualTryOnImage(displayImageUrl, garmentFile);
      const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
      
      const newLayer: OutfitLayer = { 
        garment: garmentInfo, 
        poseImages: { [currentPoseInstruction]: newImageUrl } 
      };

      setOutfitHistory(prevHistory => {
        const newHistory = prevHistory.slice(0, currentOutfitIndex + 1);
        return [...newHistory, newLayer];
      });
      setCurrentOutfitIndex(prev => prev + 1);
      
      setWardrobe(prev => {
        if (prev.find(item => item.id === garmentInfo.id)) {
            return prev;
        }
        return [...prev, garmentInfo];
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to apply garment'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentPoseIndex, outfitHistory, currentOutfitIndex, isOnline]);

  const handleRemoveLastGarment = () => {
    if (currentOutfitIndex > 0) {
      setCurrentOutfitIndex(prevIndex => prevIndex - 1);
      setCurrentPoseIndex(0);
    }
  };
  
  const handlePoseSelect = useCallback(async (newIndex: number) => {
    if (isLoading || outfitHistory.length === 0 || newIndex === currentPoseIndex) return;
    
    const poseInstruction = POSE_INSTRUCTIONS[newIndex];
    const currentLayer = outfitHistory[currentOutfitIndex];

    if (currentLayer.poseImages[poseInstruction]) {
      setCurrentPoseIndex(newIndex);
      return;
    }
    
    if (!isOnline) {
      setError("You are offline. Connect to the internet to generate new poses.");
      return;
    }

    const baseImageForPoseChange = Object.values(currentLayer.poseImages)[0];
    if (!baseImageForPoseChange) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing pose...`);
    
    const prevPoseIndex = currentPoseIndex;
    setCurrentPoseIndex(newIndex);

    try {
      const newImageUrl = await generatePoseVariation(baseImageForPoseChange, poseInstruction);
      setOutfitHistory(prevHistory => {
        const newHistory = [...prevHistory];
        const updatedLayer = newHistory[currentOutfitIndex];
        updatedLayer.poseImages[poseInstruction] = newImageUrl;
        return newHistory;
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to change pose'));
      setCurrentPoseIndex(prevPoseIndex);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [currentPoseIndex, outfitHistory, isLoading, currentOutfitIndex, isOnline]);

  const handleBackgroundChange = useCallback(async (backgroundImage: File | string) => {
    if (!displayImageUrl || isLoading) return;
    if (!isOnline) {
      setError("You are offline. Connect to the internet to change backgrounds.");
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingMessage('Changing background...');

    try {
      const newImageUrl = await changeBackgroundImage(displayImageUrl, backgroundImage);
      
      const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];

      setOutfitHistory(prevHistory => {
        const newHistory = [...prevHistory];
        const updatedLayer = newHistory[currentOutfitIndex];
        // Replace the image for the current pose with the new background version
        updatedLayer.poseImages[currentPoseInstruction] = newImageUrl;
        return newHistory;
      });

    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to change background'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentOutfitIndex, currentPoseIndex, isOnline]);

  const handleSaveOutfit = () => {
    if (!displayImageUrl || activeOutfitLayers.length <= 1) return;

    const newSavedOutfit: SavedOutfit = {
      id: `saved-outfit-${Date.now()}`,
      previewImageUrl: displayImageUrl,
      layers: activeOutfitLayers,
      createdAt: Date.now(),
    };
    setSavedOutfits(prev => [newSavedOutfit, ...prev]);
  };

  const handleLoadOutfit = (outfitToLoad: SavedOutfit) => {
    if (isLoading) return;
    if (!modelImageUrl) return;

    const baseModelFromOutfit = outfitToLoad.layers[0].poseImages[POSE_INSTRUCTIONS[0]];
    if (modelImageUrl !== baseModelFromOutfit) {
        setError("This outfit was created for a different base model and cannot be loaded.");
        return;
    }

    setOutfitHistory(outfitToLoad.layers);
    setCurrentOutfitIndex(outfitToLoad.layers.length - 1);
    setCurrentPoseIndex(0);
    setError(null);
  };

  const handleDeleteOutfit = (outfitId: string) => {
    setSavedOutfits(prev => prev.filter(outfit => outfit.id !== outfitId));
  };

  const handleEnhanceAndSave = async () => {
    if (!displayImageUrl || isLoading) return;
    if (!isOnline) {
      setError("You are offline. Connect to the internet to enhance and save images.");
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingMessage('Enhancing image quality...');

    try {
        const enhancedImageUrl = await enhanceAndUpscaleImage(displayImageUrl);
        downloadImage(enhancedImageUrl, `virtual-try-on-${Date.now()}.png`);
    } catch (err) {
        // FIX: Changed catch block variable type from 'any' to 'unknown' for better type safety.
        setError(getFriendlyErrorMessage(err, 'Failed to enhance image'));
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  };

  const viewVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  };

  return (
    <div className="font-sans">
      <AnimatePresence mode="wait">
        {!modelImageUrl ? (
          <motion.div
            key="start-screen"
            className="w-screen min-h-screen flex items-start sm:items-center justify-center bg-gray-50 p-4 pb-20"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <StartScreen onModelFinalized={handleModelFinalized} isOnline={isOnline} />
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            className="relative flex flex-col h-screen bg-white overflow-hidden"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <AnimatePresence>
              {!isOnline && (
                <motion.div
                  className="fixed top-0 left-0 right-0 bg-yellow-400 text-center p-2 text-sm text-yellow-900 font-semibold z-50 shadow"
                  initial={{ y: "-100%" }}
                  animate={{ y: "0%" }}
                  exit={{ y: "-100%" }}
                  transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
                >
                  You are offline. Browsing is available, but new creations are disabled.
                </motion.div>
              )}
            </AnimatePresence>
            <main className={`flex-grow relative flex flex-col md:flex-row overflow-hidden transition-all duration-300 ${!isOnline ? 'pt-9' : ''}`}>
              <div className="w-full h-full flex-grow flex items-center justify-center bg-white pb-16 relative">
                <Canvas 
                  displayImageUrl={displayImageUrl}
                  onStartOver={handleStartOver}
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                  onSelectPose={handlePoseSelect}
                  poseInstructions={POSE_INSTRUCTIONS}
                  currentPoseIndex={currentPoseIndex}
                  availablePoseKeys={availablePoseKeys}
                  onEnhanceAndSave={handleEnhanceAndSave}
                  isOnline={isOnline}
                />
              </div>

              <aside 
                className={`absolute md:relative md:flex-shrink-0 bottom-0 right-0 h-auto md:h-full w-full md:w-1/3 md:max-w-sm bg-white/80 backdrop-blur-md flex flex-col border-t md:border-t-0 md:border-l border-gray-200/60 transition-transform duration-500 ease-in-out ${isSheetCollapsed ? 'translate-y-[calc(100%-4.5rem)]' : 'translate-y-0'} md:translate-y-0`}
                style={{ transitionProperty: 'transform' }}
              >
                  <button 
                    onClick={() => setIsSheetCollapsed(!isSheetCollapsed)} 
                    className="md:hidden w-full h-8 flex items-center justify-center bg-gray-100/50"
                    aria-label={isSheetCollapsed ? 'Expand panel' : 'Collapse panel'}
                  >
                    {isSheetCollapsed ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
                  </button>
                  <div className="p-4 md:p-6 pb-20 overflow-y-auto flex-grow flex flex-col gap-8">
                    {error && (
                      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                      </div>
                    )}
                    <OutfitStack 
                      outfitHistory={activeOutfitLayers}
                      onRemoveLastGarment={handleRemoveLastGarment}
                      onSaveOutfit={handleSaveOutfit}
                    />
                    <WardrobePanel
                      onGarmentSelect={handleGarmentSelect}
                      activeGarmentIds={activeGarmentIds}
                      isLoading={isLoading}
                      wardrobe={wardrobe}
                      isOnline={isOnline}
                    />
                    <SavedOutfitsPanel
                      outfits={savedOutfits}
                      onLoad={handleLoadOutfit}
                      onDelete={handleDeleteOutfit}
                      isLoading={isLoading}
                    />
                    <BackgroundPanel
                      backgrounds={defaultBackgrounds}
                      onSelect={handleBackgroundChange}
                      isLoading={isLoading}
                      isOnline={isOnline}
                    />
                    <div className="pt-6 border-t border-gray-400/50">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center">Advertisement</h3>
                        <AdComponent />
                    </div>
                  </div>
              </aside>
            </main>
            <AnimatePresence>
              {isLoading && isMobile && (
                <motion.div
                  className="fixed inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Spinner />
                  {loadingMessage && (
                    <p className="text-lg font-serif text-gray-700 mt-4 text-center px-4">{loadingMessage}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer isOnDressingScreen={!!modelImageUrl} />
    </div>
  );
};

export default App;