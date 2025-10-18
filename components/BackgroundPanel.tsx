/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { BackgroundItem } from '../types';
import { UploadCloudIcon } from './icons';
import { cn } from '../lib/utils';

interface BackgroundPanelProps {
  backgrounds: BackgroundItem[];
  onSelect: (background: File | string) => void;
  isLoading: boolean;
  isOnline: boolean;
}

const BackgroundPanel: React.FC<BackgroundPanelProps> = ({ backgrounds, onSelect, isLoading, isOnline }) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
                console.error('Invalid file type. Please select an image.');
                return;
            }
            onSelect(file);
        }
    };

    return (
        <div className="pt-6 border-t border-gray-400/50">
            <h2 className="text-xl font-serif tracking-wider text-gray-800 mb-3">Backgrounds</h2>
            <div className="grid grid-cols-3 gap-3">
                {backgrounds.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onSelect(item.url)}
                        disabled={isLoading}
                        className="relative aspect-video border rounded-lg overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 group disabled:opacity-60 disabled:cursor-not-allowed"
                        aria-label={`Select ${item.name} background`}
                    >
                        <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs font-bold text-center p-1">{item.name}</p>
                        </div>
                    </button>
                ))}
                <label 
                  htmlFor="custom-background-upload" 
                  className={cn(
                    'relative aspect-video border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 transition-colors', 
                    (isLoading || !isOnline) 
                      ? 'cursor-not-allowed bg-gray-100 opacity-60' 
                      : 'hover:border-gray-400 hover:text-gray-600 cursor-pointer'
                  )}
                  title={!isOnline ? "Uploading is disabled while offline" : "Upload a custom background"}
                >
                    <UploadCloudIcon className="w-6 h-6 mb-1"/>
                    <span className="text-xs text-center">Upload</span>
                    <input id="custom-background-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif" onChange={handleFileChange} disabled={isLoading || !isOnline}/>
                </label>
            </div>
        </div>
    );
};

export default BackgroundPanel;