/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloudIcon, CameraIcon, XIcon } from './icons';
import { Compare } from './ui/compare';
import { generateModelImage } from '../services/geminiService';
import Spinner from './Spinner';
import { getFriendlyErrorMessage } from '../lib/utils';
import { cn } from '../lib/utils';

interface StartScreenProps {
  onModelFinalized: (modelUrl: string) => void;
  isOnline: boolean;
}

const GENDER_OPTIONS = ['Female', 'Male', 'Unspecified'];
const SKIN_TONE_OPTIONS = ['Fair', 'Light', 'Medium', 'Tan', 'Brown', 'Dark Brown'];
const HAIR_COLOR_OPTIONS = ['Blonde', 'Brown', 'Black', 'Red', 'Gray', 'Other'];

const StartScreen: React.FC<StartScreenProps> = ({ onModelFinalized, isOnline }) => {
  const [userImageUrl, setUserImageUrl] = useState<string | null>(null);
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [skinTone, setSkinTone] = useState<string>('');
  const [hairColor, setHairColor] = useState<string>('');
  const [stylePreferences, setStylePreferences] = useState<string>('');
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
      throw new Error('Invalid data URL');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const openCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setCameraError("Camera permission denied. Please enable it in your browser settings.");
        } else {
          setCameraError("Could not access the camera. Please ensure it's not in use by another application.");
        }
      } else {
        setCameraError("An unknown error occurred while accessing the camera.");
      }
      setIsCameraOpen(false);
    }
  }, []);

  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCapturedImageUrl(null);
  }, []);

  useEffect(() => {
    if (isCameraOpen) {
      openCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOpen, openCamera]);

  const handleCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setCapturedImageUrl(dataUrl);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      }
    }
  };

  const handleRetake = () => {
    setCapturedImageUrl(null);
    openCamera();
  };

  const handleUsePhoto = () => {
    if (capturedImageUrl) {
      const file = dataURLtoFile(capturedImageUrl, `capture-${Date.now()}.png`);
      handleFileSelect(file);
      closeCamera();
    }
  };

  const handleFileSelect = useCallback(async (file: File) => {
    if (!isOnline) {
      setError('You are offline. Please connect to the internet to generate a model.');
      return;
    }
    if (!file.type.startsWith('image/')) {
        setError('Please select an image file.');
        return;
    }
    if (!selectedGender) {
        setError('Please select a gender for the model first.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setUserImageUrl(dataUrl);
        setIsGenerating(true);
        setGeneratedModelUrl(null);
        setError(null);
        try {
            const result = await generateModelImage(file, selectedGender, skinTone, hairColor, stylePreferences);
            setGeneratedModelUrl(result);
        } catch (err) {
            setError(getFriendlyErrorMessage(err, 'Failed to create model'));
            setUserImageUrl(null);
        } finally {
            setIsGenerating(false);
        }
    };
    reader.readAsDataURL(file);
  }, [selectedGender, skinTone, hairColor, stylePreferences, isOnline]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const reset = () => {
    setUserImageUrl(null);
    setGeneratedModelUrl(null);
    setIsGenerating(false);
    setError(null);
    setCameraError(null);
    setSelectedGender(null);
    setSkinTone('');
    setHairColor('');
    setStylePreferences('');
  };

  const screenVariants = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {!userImageUrl ? (
          <motion.div
            key="uploader"
            className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12"
            variants={screenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <div className="lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
              <div className="max-w-xl">
                <h1 className="text-5xl md:text-6xl font-serif font-bold text-gray-900 leading-tight">
                  Create Your Model for Any Look.
                </h1>
                <p className="mt-4 text-lg text-gray-600">
                  Ever wondered how an outfit would look on you? Stop guessing. Upload a photo or use your camera to see for yourself. Our AI creates your personal model, ready to try on anything.
                </p>
                <hr className="my-8 border-gray-200" />
                <div className="flex flex-col items-center lg:items-start w-full gap-6">
                    
                    <div>
                        <p className="font-semibold text-gray-700 mb-2">1. Describe your model (Optional)</p>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-600">Skin Tone</label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {SKIN_TONE_OPTIONS.map(tone => (
                                        <button key={tone} onClick={() => setSkinTone(tone)} className={cn('px-3 py-1 text-sm font-semibold rounded-full transition-colors', skinTone === tone ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')}>
                                            {tone}
                                        </button>
                                    ))}
                                </div>
                            </div>
                             <div>
                                <label className="text-sm font-medium text-gray-600">Hair Color</label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {HAIR_COLOR_OPTIONS.map(color => (
                                        <button key={color} onClick={() => setHairColor(color)} className={cn('px-3 py-1 text-sm font-semibold rounded-full transition-colors', hairColor === color ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')}>
                                            {color}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label htmlFor="style-prefs" className="text-sm font-medium text-gray-600">Style & Fit Preferences</label>
                                <textarea id="style-prefs" value={stylePreferences} onChange={(e) => setStylePreferences(e.target.value)} rows={2} className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-800 focus:border-gray-800 transition-colors" placeholder="e.g., athletic build, prefers oversized clothes, streetwear style..."></textarea>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p className="font-semibold text-gray-700 mb-2">2. Select Model's Gender</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            {GENDER_OPTIONS.map(gender => (
                                <button
                                    key={gender}
                                    onClick={() => setSelectedGender(gender)}
                                    className={cn(
                                        'w-full sm:w-auto px-6 py-3 text-base font-semibold rounded-md transition-colors',
                                        selectedGender === gender
                                            ? 'bg-gray-900 text-white'
                                            : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                                    )}
                                >
                                    {gender}
                                </button>
                            ))}
                        </div>
                    </div>

                  <div className="w-full">
                    <p className="font-semibold text-gray-700 mb-2">3. Provide a Photo</p>
                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                      <label 
                        htmlFor="image-upload-start" 
                        className={cn(
                            "w-full sm:w-auto flex-grow relative flex items-center justify-center px-8 py-3 text-base font-semibold rounded-md transition-colors",
                            !selectedGender || !isOnline
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'text-white bg-gray-900 cursor-pointer group hover:bg-gray-700'
                        )}
                        aria-disabled={!selectedGender || !isOnline}
                      >
                        <UploadCloudIcon className="w-5 h-5 mr-3" />
                        Upload Photo
                      </label>
                      <input id="image-upload-start" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif" onChange={handleFileChange} disabled={!selectedGender || !isOnline}/>
                      <button 
                        onClick={() => { if(selectedGender && isOnline) { setIsCameraOpen(true); setCameraError(null); }}}
                        className={cn(
                            "w-full sm:w-auto flex-grow relative flex items-center justify-center px-8 py-3 text-base font-semibold rounded-md transition-colors",
                            !selectedGender || !isOnline
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'text-gray-800 bg-gray-200 cursor-pointer group hover:bg-gray-300'
                        )}
                        disabled={!selectedGender || !isOnline}
                        >
                        <CameraIcon className="w-5 h-5 mr-3" />
                        Use Camera
                      </button>
                    </div>
                  </div>

                  <p className="text-gray-500 text-sm">Select a clear, full-body photo. Face-only photos also work, but full-body is preferred for best results.</p>
                  <p className="text-gray-500 text-xs mt-1">By uploading, you agree not to create harmful, explicit, or unlawful content. This service is for creative and responsible use only.</p>
                  {!isOnline && <p className="text-red-600 font-semibold text-sm mt-2">Offline Mode: Please connect to the internet to create a new model.</p>}
                  {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                  {cameraError && <p className="text-red-500 text-sm mt-2">{cameraError}</p>}
                </div>
              </div>
            </div>
            <div className="w-full lg:w-1/2 flex flex-col items-center justify-center">
              <Compare
                firstImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon.jpg"
                secondImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon-model.png"
                slideMode="drag"
                className="w-full max-w-sm aspect-[2/3] rounded-2xl bg-gray-200"
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="compare"
            className="w-full max-w-6xl mx-auto h-full flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12"
            variants={screenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <div className="md:w-1/2 flex-shrink-0 flex flex-col items-center md:items-start">
              <div className="text-center md:text-left">
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 leading-tight">
                  The New You
                </h1>
                <p className="mt-2 text-md text-gray-600">
                  Drag the slider to see your transformation.
                </p>
              </div>
              
              {isGenerating && (
                <div className="flex items-center gap-3 text-lg text-gray-700 font-serif mt-6">
                  <Spinner />
                  <span>Generating your model...</span>
                </div>
              )}
  
              {error && 
                <div className="text-center md:text-left text-red-600 max-w-md mt-6">
                  <p className="font-semibold">Generation Failed</p>
                  <p className="text-sm mb-4">{error}</p>
                  <button onClick={reset} className="text-sm font-semibold text-gray-700 hover:underline">Try Again</button>
                </div>
              }
              
              <AnimatePresence>
                {generatedModelUrl && !isGenerating && !error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col sm:flex-row items-center gap-4 mt-8"
                  >
                    <button 
                      onClick={reset}
                      className="w-full sm:w-auto px-6 py-3 text-base font-semibold text-gray-700 bg-gray-200 rounded-md cursor-pointer hover:bg-gray-300 transition-colors"
                    >
                      Use Different Photo
                    </button>
                    <button 
                      onClick={() => onModelFinalized(generatedModelUrl)}
                      className="w-full sm:w-auto relative inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-gray-900 rounded-md cursor-pointer group hover:bg-gray-700 transition-colors"
                    >
                      Proceed to Styling &rarr;
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="md:w-1/2 w-full flex items-center justify-center">
              <div 
                className={`relative rounded-[1.25rem] transition-all duration-700 ease-in-out ${isGenerating ? 'border border-gray-300 animate-pulse' : 'border-transparent'}`}
              >
                <Compare
                  firstImage={userImageUrl}
                  secondImage={generatedModelUrl ?? userImageUrl}
                  slideMode="drag"
                  className="w-[280px] h-[420px] sm:w-[320px] sm:h-[480px] lg:w-[400px] lg:h-[600px] rounded-2xl bg-gray-200"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCameraOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-xl shadow-xl flex flex-col"
            >
              <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="text-xl font-serif text-gray-800">{capturedImageUrl ? 'Preview' : 'Live Camera'}</h2>
                  <button onClick={closeCamera} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800">
                      <XIcon className="w-6 h-6"/>
                  </button>
              </div>

              <div className="p-4 bg-gray-100">
                  {capturedImageUrl ? (
                      <img src={capturedImageUrl} alt="Captured" className="rounded-lg w-full max-w-md mx-auto aspect-[3/4] object-cover" />
                  ) : (
                      <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg max-w-md mx-auto aspect-[3/4] object-cover bg-gray-200" style={{ transform: 'scaleX(-1)' }}/>
                  )}
              </div>
              
              <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
                  {capturedImageUrl ? (
                      <div className="flex justify-center gap-4">
                          <button onClick={handleRetake} className="px-6 py-3 text-base font-semibold text-gray-700 bg-gray-200 rounded-md cursor-pointer hover:bg-gray-300 transition-colors">
                              Retake
                          </button>
                          <button onClick={handleUsePhoto} className="relative inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-gray-900 rounded-md cursor-pointer group hover:bg-gray-700 transition-colors">
                              Use Photo
                          </button>
                      </div>
                  ) : (
                      <div className="flex justify-center">
                          <button onClick={handleCapture} className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 hover:bg-gray-100 transition-all active:scale-95 group" aria-label="Capture photo">
                              <div className="w-12 h-12 rounded-full bg-red-500 mx-auto group-hover:scale-105 transition-transform"></div>
                          </button>
                      </div>
                  )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StartScreen;
