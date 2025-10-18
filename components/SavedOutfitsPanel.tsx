/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { SavedOutfit } from '../types';
import { RotateCcwIcon, Trash2Icon } from './icons';
import { AnimatePresence, motion } from 'framer-motion';

interface SavedOutfitsPanelProps {
  outfits: SavedOutfit[];
  onLoad: (outfit: SavedOutfit) => void;
  onDelete: (outfitId: string) => void;
  isLoading: boolean;
}

const SavedOutfitsPanel: React.FC<SavedOutfitsPanelProps> = ({ outfits, onLoad, onDelete, isLoading }) => {
  return (
    <div className="pt-6 border-t border-gray-400/50">
      <h2 className="text-xl font-serif tracking-wider text-gray-800 mb-3">Saved Outfits</h2>
      <div className="space-y-3">
        <AnimatePresence>
          {outfits.length > 0 ? (
            outfits.map((outfit) => (
              <motion.div
                key={outfit.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="flex items-center gap-3 bg-white/50 p-2 rounded-lg border border-gray-200/80"
              >
                <img
                  src={outfit.previewImageUrl}
                  alt="Saved outfit preview"
                  className="w-16 h-24 object-cover rounded-md flex-shrink-0 bg-gray-100"
                />
                <div className="flex-grow overflow-hidden">
                  <p className="font-semibold text-gray-800 text-sm truncate">
                    Outfit from {new Date(outfit.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {outfit.layers.length - 1} item{outfit.layers.length - 1 !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                        onClick={() => onLoad(outfit)}
                        disabled={isLoading}
                        className="p-2 rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Load this outfit"
                    >
                        <RotateCcwIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDelete(outfit.id)}
                        disabled={isLoading}
                        className="p-2 rounded-md text-gray-600 bg-gray-100 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Delete this outfit"
                    >
                        <Trash2Icon className="w-4 h-4" />
                    </button>
                </div>
              </motion.div>
            ))
          ) : (
            <p className="text-center text-sm text-gray-500 pt-4">
              Your saved outfits will appear here. Style a look and press 'Save' to add it.
            </p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SavedOutfitsPanel;