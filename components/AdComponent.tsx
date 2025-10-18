/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect } from 'react';

declare global {
    interface Window {
        adsbygoogle?: { [key: string]: unknown }[];
    }
}

const AdComponent: React.FC = () => {
  useEffect(() => {
    try {
      if (window.adsbygoogle) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) {
      console.error('AdSense error:', e);
    }
  }, []);

  return (
    <div className="w-full min-h-[100px] flex items-center justify-center bg-gray-100 rounded-lg text-sm text-gray-500 text-center overflow-hidden">
      {/* 
        This is a placeholder for a Google Ad.
        For it to work, you need to:
        1. Replace "ca-pub-XXXXXXXXXXXXXXXX" in index.html with your AdSense Publisher ID.
        2. Replace "YYYYYYYYYY" below with your AdSense Ad Slot ID.
        3. Make sure your AdSense account is approved and running.
      */}
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" // Must match the one in index.html
        data-ad-slot="YYYYYYYYYY" // TODO: Replace with your Ad Slot ID
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
};

export default AdComponent;
