/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { OutfitLayer } from '../types';
import { Trash2Icon, SaveIcon } from './icons';

interface OutfitStackProps {
  outfitHistory: OutfitLayer[];
  onRemoveLastGarment: () => void;
  onSaveOutfit: () => void;
}

const OutfitStack: React.FC<OutfitStackProps> = ({ outfitHistory, onRemoveLastGarment, onSaveOutfit }) => {
  const canSave = outfitHistory.length > 1;
  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center border-b border-gray-400/50 pb-2 mb-3">
        <h2 className="text-xl font-serif tracking-wider text-gray-800">Outfit Stack</h2>
        <button
          onClick={onSaveOutfit}
          disabled={!canSave}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 bg-white/80 border border-gray-300/80 rounded-full py-1.5 px-3 transition-all hover:bg-white hover:border-gray-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          aria-label="Save current outfit"
        >
          <SaveIcon className="w-4 h-4" />
          Save
        </button>
      </div>
      <div className="space-y-2">
        {outfitHistory.map((layer, index) => (
          <div
            key={layer.garment?.id || 'base'}
            className="flex items-center justify-between bg-white/50 p-2 rounded-lg animate-fade-in border border-gray-200/80"
          >
            <div className="flex items-center overflow-hidden">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 mr-3 text-xs font-bold text-gray-600 bg-gray-200 rounded-full">
                  {index + 1}
                </span>
                {layer.garment && (
                    <img src={layer.garment.url} alt={layer.garment.name} className="flex-shrink-0 w-12 h-12 object-cover rounded-md mr-3" />
                )}
                <span className="font-semibold text-gray-800 truncate" title={layer.garment?.name}>
                  {layer.garment ? layer.garment.name : 'Base Model'}
                </span>
            </div>
            {index > 0 && index === outfitHistory.length - 1 && (
               <button
                onClick={onRemoveLastGarment}
                className="flex-shrink-0 text-gray-500 hover:text-red-600 transition-colors p-2 rounded-md hover:bg-red-50"
                aria-label={`Remove ${layer.garment?.name}`}
              >
                <Trash2Icon className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
        {outfitHistory.length === 1 && (
            <p className="text-center text-sm text-gray-500 pt-4">Your stacked items will appear here. Select an item from the wardrobe below.</p>
        )}
      </div>
    </div>
  );
};

export default OutfitStack;