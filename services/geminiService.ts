/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

const fileToPart = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
};

const dataUrlToParts = (dataUrl: string) => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    return { mimeType: mimeMatch[1], data: arr[1] };
}

const dataUrlToPart = (dataUrl: string) => {
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
}

// A robust way to convert any image URL to a part, handling potential CORS issues by using a canvas.
const imageUrlToPart = (url: string) => {
    // FIX: Use Awaited to get the resolved type of the promise from fileToPart.
    // This fixes a type mismatch where a Promise was resolving to another Promise
    // instead of the expected image part object.
    return new Promise<Awaited<ReturnType<typeof fileToPart>>>((resolve, reject) => {
        const image = new Image();
        image.setAttribute('crossOrigin', 'anonymous');

        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context.'));
            ctx.drawImage(image, 0, 0);

            canvas.toBlob((blob) => {
                if (!blob) return reject(new Error('Canvas toBlob failed.'));
                
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onload = () => {
                    const { mimeType, data } = dataUrlToParts(reader.result as string);
                    resolve({ inlineData: { mimeType, data } });
                };
                reader.onerror = reject;
            }, 'image/png');
        };

        image.onerror = (error) => reject(new Error(`Could not load image from URL for conversion. Error: ${error}`));
        image.src = url;
    });
};


const handleApiResponse = (response: GenerateContentResponse): string => {
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        throw new Error(errorMessage);
    }

    // Find the first image part in any candidate
    for (const candidate of response.candidates ?? []) {
        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData;
            return `data:${mimeType};base64,${data}`;
        }
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `Image generation stopped unexpectedly. Reason: ${finishReason}. This often relates to safety settings.`;
        throw new Error(errorMessage);
    }
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image. ` + (textFeedback ? `The model responded with text: "${textFeedback}"` : "This can happen due to safety filters or if the request is too complex. Please try a different image.");
    throw new Error(errorMessage);
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
const model = 'gemini-2.5-flash-image';

export const generateModelImage = async (
    userImage: File,
    gender: string,
    skinTone: string,
    hairColor: string,
    stylePreferences: string
): Promise<string> => {
    const userImagePart = await fileToPart(userImage);
    
    let prompt = `You are an expert fashion photographer AI. Transform the person in this image into a full-body fashion model photo suitable for an e-commerce website.`;

    if (gender && gender.toLowerCase() !== 'unspecified') {
        prompt += ` The model should be ${gender}.`;
    }

    const details = [];
    if (skinTone) details.push(`skin tone: ${skinTone}`);
    if (hairColor) details.push(`hair color: ${hairColor}`);
    if (stylePreferences) details.push(`style and fit preferences: "${stylePreferences}"`);

    if (details.length > 0) {
        prompt += ` Pay close attention to these user-provided details: ${details.join(', ')}.`;
    }
    
    prompt += ` The background must be a clean, neutral studio backdrop (light gray, #f0f0f0). The person should have a neutral, professional model expression. Preserve the person's identity, unique features, and body type from the original image, while subtly enhancing them to a professional model standard. Place them in a standard, relaxed standing model pose. The final image must be photorealistic. Return ONLY the final image.`;
    
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [userImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const generateVirtualTryOnImage = async (modelImageUrl: string, garmentImage: File): Promise<string> => {
    const modelImagePart = dataUrlToPart(modelImageUrl);
    const garmentImagePart = await fileToPart(garmentImage);
    const prompt = `You are an expert virtual try-on AI. You will be given a 'model image' and a 'garment image'. Your task is to create a new photorealistic image where the person from the 'model image' is wearing the clothing from the 'garment image'.

**Crucial Rules:**
1.  **Complete Garment Replacement:** You MUST completely REMOVE and REPLACE the clothing item worn by the person in the 'model image' with the new garment. No part of the original clothing (e.g., collars, sleeves, patterns) should be visible in the final image.
2.  **Preserve the Model:** The person's face, hair, body shape, and pose from the 'model image' MUST remain unchanged.
3.  **Preserve the Background:** The entire background from the 'model image' MUST be preserved perfectly.
4.  **Apply the Garment:** Realistically fit the new garment onto the person. It should adapt to their pose with natural folds, shadows, and lighting consistent with the original scene.
5.  **Output:** Return ONLY the final, edited image. Do not include any text.`;
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [modelImagePart, garmentImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const generatePoseVariation = async (tryOnImageUrl: string, poseInstruction: string): Promise<string> => {
    const tryOnImagePart = dataUrlToPart(tryOnImageUrl);
    const prompt = `You are an expert fashion photographer AI. Take this image and regenerate it from a different perspective. The person, clothing, and background style must remain identical. The new perspective should be: "${poseInstruction}". Return ONLY the final image.`;
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [tryOnImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const enhanceAndUpscaleImage = async (imageUrl: string): Promise<string> => {
    const imagePart = dataUrlToPart(imageUrl);
    const prompt = `You are a world-class photo editing AI. Take this image and upscale it to a high-resolution, photorealistic quality suitable for a professional fashion lookbook or social media. Enhance the details, lighting, and textures. Do NOT change the person's identity, the clothing, the pose, or the background. Only improve the overall image quality and resolution. Return ONLY the final, enhanced image.`;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const changeBackgroundImage = async (modelImageUrl: string, backgroundImage: File | string): Promise<string> => {
    const modelImagePart = dataUrlToPart(modelImageUrl);
    const backgroundImagePart = typeof backgroundImage === 'string'
        ? await imageUrlToPart(backgroundImage)
        : await fileToPart(backgroundImage);
    
    const prompt = `You are an expert photo compositing AI. You will be given a 'model image' and a 'background image'.
**Primary Goal:** Place the person from the 'model image' into the scene from the 'background image'.

**Critical Instructions:**
1.  **Isolate the Person:** Perfectly isolate the person from their original background in the 'model image'.
2.  **Preserve the Person:** The person's appearance, clothing, pose, and any items they are holding must remain completely unchanged.
3.  **Composite:** Place the isolated person into the new 'background image'.
4.  **Realistic Integration:** Adjust the lighting, shadows, and color grading on the person to match the new background's environment seamlessly. The result must look like a single, cohesive photograph.
5.  **Output:** Return ONLY the final, composited image. Do not add any text or other elements.`;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [modelImagePart, backgroundImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};