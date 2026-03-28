"use client";

import { useState } from "react";
import { RotateCw, RotateCcw, Trash2 } from "lucide-react";

type ImageProcessorProps = {
  file: File;
  onProcessed: (canvas: HTMLCanvasElement) => void;
  onReset: () => void;
};

export default function ImageProcessor({ file, onProcessed, onReset }: ImageProcessorProps) {
  const [rotation, setRotation] = useState(0);

  const rotate = (dir: "cw" | "ccw") => {
    setRotation(r => (dir === "cw" ? r + 90 : r - 90));
  };

  const processImage = () => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const isVertical = (rotation / 90) % 2 !== 0;
      canvas.width = isVertical ? img.height : img.width;
      canvas.height = isVertical ? img.width : img.height;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      onProcessed(canvas);
    };
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-video glass rounded-2xl overflow-hidden group">
        <img 
          src={URL.createObjectURL(file)} 
          style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.3s ease-out' }}
          className="w-full h-full object-contain"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
          <button onClick={() => rotate("ccw")} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
            <RotateCcw className="w-5 h-5 text-white" />
          </button>
          <button onClick={() => rotate("cw")} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
            <RotateCw className="w-5 h-5 text-white" />
          </button>
          <button onClick={onReset} className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-full transition-colors">
            <Trash2 className="w-5 h-5 text-red-500" />
          </button>
        </div>
      </div>
      <button 
        onClick={processImage} 
        className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-500"
      >
        ANALYZE THIS ORIENTATION
      </button>
    </div>
  );
}
