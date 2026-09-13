import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function ProductOptionsModal({ product, onClose, onConfirm }) {
  const [selected, setSelected] = useState({});
  const [currentImage, setCurrentImage] = useState(0);
  
  console.log('ProductOptionsModal - product:', product);
  console.log('ProductOptionsModal - product.product_options:', product.product_options);
  
  const options = product.product_options || [];
  const images = product.images && product.images.length > 0 ? product.images : (product.media_url ? [product.media_url] : []);
  const description = product.content;
  const allSelected = options.every(opt => selected[opt.name]);
  
  console.log('ProductOptionsModal - options:', options);
  console.log('ProductOptionsModal - images:', images);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  
  return (
    <div 
      className="fixed inset-0 bg-black z-[9999] overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="min-h-screen py-5">
        {/* Header */}
        <div className="flex justify-end px-5 pb-3 sticky top-0 bg-black z-10">
          <button
            onClick={onClose}
            className="text-white p-2"
          >
            <X size={28} />
          </button>
        </div>
        
        {/* Content */}
        <div className="px-5 pb-24">
          
          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="mb-6">
              <div className="w-full h-[300px] bg-neutral-900 rounded-lg overflow-hidden">
                <img 
                  src={images[currentImage]} 
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Image Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImage(idx)}
                      className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 ${
                        currentImage === idx ? 'ring-2 ring-white' : 'ring-1 ring-white/20'
                      }`}
                    >
                      <img 
                        src={img} 
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Title & Price */}
          <h2 className="text-white text-2xl font-light mb-3">
            {product.title}
          </h2>
          
          <div className="text-white text-3xl font-normal mb-6">
            {product.price}
          </div>
          
          {/* Description */}
          {description && (
            <div 
              className="text-white text-base leading-relaxed mb-8"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          )}
          
          {/* Options */}
          {options.map(opt => (
            <div key={opt.name} className="mb-7">
              <div className="text-white text-sm font-medium mb-3 uppercase tracking-wider">
                {opt.name}
              </div>
              
              <div className="flex flex-col gap-2">
                {opt.values.map(val => {
                  const isSelected = selected[opt.name] === val;
                  return (
                    <label
                      key={val}
                      className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-all ${
                        isSelected ? 'bg-white' : 'bg-neutral-900 border border-white/20'
                      }`}
                    >
                      <input
                        type="radio"
                        name={opt.name}
                        value={val}
                        checked={isSelected}
                        onChange={() => setSelected({...selected, [opt.name]: val})}
                        className="w-5 h-5 accent-black cursor-pointer"
                      />
                      <span className={`text-base ${isSelected ? 'text-black font-medium' : 'text-white'}`}>
                        {val}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        {/* Fixed Bottom Button */}
        <div className="fixed bottom-0 left-0 right-0 px-5 py-4 bg-gradient-to-t from-black via-black to-transparent pt-10">
          <button
            onClick={() => allSelected && onConfirm(selected)}
            disabled={!allSelected}
            className={`w-full py-5 text-lg font-medium rounded-xl tracking-wide ${
              allSelected 
                ? 'bg-white text-black cursor-pointer' 
                : 'bg-neutral-800 text-white cursor-not-allowed'
            }`}
          >
            {allSelected ? 'Ajouter au panier' : 'Sélectionnez toutes les options'}
          </button>
        </div>
      </div>
    </div>
  );
}