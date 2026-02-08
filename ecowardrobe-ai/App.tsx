
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  X,
  Shirt, 
  TrendingUp, 
  Scissors, 
  HeartHandshake, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Info,
  Camera,
  Layers,
  Sparkles,
  ArrowLeft,
  Search
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { 
  WardrobeItem, 
  StyleProfile, 
  ItemStatus, 
  AnalysisResponse, 
  TransformationGuide, 
  Category 
} from './types';
import { 
  analyzeWardrobeUsage, 
  generateTransformationGuide, 
  categorizeItemFromImage 
} from './services/geminiService';

const CATEGORIES: Category[] = ['Shirts', 'Skirts', 'Jeans', 'Pajamas', 'Socks', 'Shoes', 'Dresses', 'Outerwear', 'Other'];

const App: React.FC = () => {
  const [items, setItems] = useState<WardrobeItem[]>(() => {
    const saved = localStorage.getItem('eco-wardrobe-items-v2');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [profile, setProfile] = useState<StyleProfile>(() => {
    const saved = localStorage.getItem('eco-wardrobe-profile-v2');
    return saved ? JSON.parse(saved) : {
      preferredStyles: ['Minimalist', 'Casual'],
      preferredColors: ['Beige', 'Black', 'White'],
      dislikedElements: []
    };
  });

  const [activeTab, setActiveTab] = useState<'wardrobe' | 'analysis' | 'profile' | 'folders'>('wardrobe');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [selectedFolder, setSelectedFolder] = useState<ItemStatus>(ItemStatus.ACTIVE);
  
  const [isAdding, setIsAdding] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResponse[]>([]);
  const [analysisIndex, setAnalysisIndex] = useState(0);

  const [selectedItemForDetail, setSelectedItemForDetail] = useState<WardrobeItem | null>(null);
  const [transformation, setTransformation] = useState<TransformationGuide | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('eco-wardrobe-items-v2', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('eco-wardrobe-profile-v2', JSON.stringify(profile));
  }, [profile]);

  const handleWornToday = (itemId: string) => {
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, wearCount: item.wearCount + 1, lastWornDate: new Date().toLocaleDateString() }
        : item
    ));
    if (selectedItemForDetail?.id === itemId) {
      setSelectedItemForDetail(prev => prev ? { ...prev, wearCount: prev.wearCount + 1, lastWornDate: new Date().toLocaleDateString() } : null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        setCapturedImage(reader.result as string);
        setIsProcessingImage(true);
        try {
          const aiData = await categorizeItemFromImage(base64);
          const newItem: WardrobeItem = {
            id: Date.now().toString(),
            name: aiData.name || 'New Item',
            category: aiData.category || 'Other',
            color: aiData.color || 'Unknown',
            material: aiData.material || 'Unknown',
            imageUrl: reader.result as string,
            purchaseDate: new Date().toISOString().split('T')[0],
            lastWornDate: null,
            wearCount: 0,
            status: ItemStatus.ACTIVE
          };
          setItems(prev => [...prev, newItem]);
          setIsAdding(false);
          setCapturedImage(null);
        } catch (error) {
          console.error(error);
        } finally {
          setIsProcessingImage(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    const activeItems = items.filter(i => i.status === ItemStatus.ACTIVE);
    if (activeItems.length === 0) {
      setIsAnalyzing(false);
      return;
    }
    const results = await analyzeWardrobeUsage(activeItems, profile);
    setAnalysisResults(results);
    setAnalysisIndex(0);
  };

  const handleSwipe = (direction: 'left' | 'right' | 'up') => {
    const currentAnalysis = analysisResults[analysisIndex];
    if (!currentAnalysis) return;

    const item = items.find(i => i.id === currentAnalysis.itemId);
    if (!item) return;

    if (direction === 'left') {
      // Donate
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: ItemStatus.DONATED } : i));
    } else if (direction === 'right') {
      // Transform
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: ItemStatus.TRANSFORMED } : i));
    } else if (direction === 'up') {
      // Reserve
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: ItemStatus.RESERVED } : i));
    }

    if (analysisIndex < analysisResults.length - 1) {
      setAnalysisIndex(prev => prev + 1);
    } else {
      setIsAnalyzing(false);
      setAnalysisResults([]);
      setActiveTab('folders');
    }
  };

  const fetchTransformation = async (item: WardrobeItem) => {
    setIsTransforming(true);
    try {
      const guide = await generateTransformationGuide(item, profile);
      setTransformation(guide);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTransforming(false);
    }
  };

  // Swiping Card Component
  const SwipeCard = ({ analysis, onSwipe }: { analysis: AnalysisResponse, onSwipe: (dir: 'left' | 'right' | 'up') => void }) => {
    const item = items.find(i => i.id === analysis.itemId);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotate = useTransform(x, [-150, 150], [-15, 15]);
    const opacity = useTransform(x, [-150, -100, 0, 100, 150], [0, 1, 1, 1, 0]);
    const donateOpacity = useTransform(x, [-100, -20], [1, 0]);
    const transformOpacity = useTransform(x, [20, 100], [0, 1]);

    if (!item) return null;

    return (
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        style={{ x, rotate, opacity }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -100) onSwipe('left');
          else if (info.offset.x > 100) onSwipe('right');
        }}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      >
        <div className="relative w-full h-full bg-white rounded-3xl shadow-xl overflow-hidden border border-stone-200">
          <img src={item.imageUrl} className="w-full h-2/3 object-cover" />
          
          <motion.div style={{ opacity: donateOpacity }} className="absolute top-8 left-8 bg-red-500 text-white px-4 py-2 rounded-lg font-bold rotate-[-15deg]">DONATE</motion.div>
          <motion.div style={{ opacity: transformOpacity }} className="absolute top-8 right-8 bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold rotate-[15deg]">TRANSFORM</motion.div>

          <div className="p-6">
            <h3 className="text-xl font-bold mb-1">{item.name}</h3>
            <p className="text-sm text-stone-500 mb-3">{item.category} • Worn {item.wearCount}x</p>
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
              <p className="text-sm text-stone-700 italic leading-relaxed">
                <Sparkles size={16} className="inline mr-2 text-emerald-600" />
                {analysis.reasoning}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans pb-24">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex justify-between items-center border-b border-stone-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Shirt className="text-emerald-600" size={24} />
          <h1 className="text-xl font-black tracking-tight">ECOWARDROBE</h1>
        </div>
        <button 
          onClick={() => setActiveTab('profile')}
          className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center overflow-hidden"
        >
          <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-600"></div>
        </button>
      </header>

      {/* Main Content Areas */}
      <main className="max-w-md mx-auto p-4 space-y-6">
        {activeTab === 'wardrobe' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Your Closet</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsAdding(true)}
                  className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg hover:scale-105 transition"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
              <button 
                onClick={() => setSelectedCategory('All')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${selectedCategory === 'All' ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200'}`}
              >
                All
              </button>
              {CATEGORIES.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${selectedCategory === cat ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-2 gap-4">
              {items
                .filter(i => i.status === ItemStatus.ACTIVE && (selectedCategory === 'All' || i.category === selectedCategory))
                .map(item => (
                <motion.div 
                  layoutId={item.id}
                  key={item.id} 
                  onClick={() => setSelectedItemForDetail(item)}
                  className="bg-white rounded-2xl p-2 shadow-sm border border-stone-200 overflow-hidden group cursor-pointer"
                >
                  <div className="relative aspect-[3/4] mb-2 rounded-xl overflow-hidden">
                    <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                    <div className="absolute top-2 right-2 bg-white/90 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm">
                      {item.wearCount}x
                    </div>
                  </div>
                  <div className="px-1 pb-1">
                    <h3 className="font-bold text-sm truncate">{item.name}</h3>
                    <p className="text-[10px] text-stone-500 uppercase tracking-widest">{item.category}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="h-[70vh] flex flex-col justify-center animate-in zoom-in duration-300">
            {!isAnalyzing && analysisResults.length === 0 ? (
              <div className="text-center space-y-6">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                  <Sparkles size={48} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Smart Analysis</h2>
                  <p className="text-stone-500 mt-2">Swipe on your items to reduce waste. Left for Charity, Right for Transform.</p>
                </div>
                <button 
                  onClick={startAnalysis}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-emerald-700 transition"
                >
                  Start Analyzing
                </button>
              </div>
            ) : isAnalyzing && analysisResults.length === 0 ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="font-medium text-stone-600 italic">Gemini is looking through your closet...</p>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <div className="absolute inset-x-0 bottom-[-60px] flex justify-center gap-8">
                   <button onClick={() => handleSwipe('left')} className="p-4 bg-white shadow-lg rounded-full text-red-500 border border-stone-200"><HeartHandshake size={28} /></button>
                   <button onClick={() => handleSwipe('up')} className="p-4 bg-white shadow-lg rounded-full text-stone-900 border border-stone-200"><Calendar size={28} /></button>
                   <button onClick={() => handleSwipe('right')} className="p-4 bg-white shadow-lg rounded-full text-emerald-500 border border-stone-200"><Scissors size={28} /></button>
                </div>
                <AnimatePresence>
                  {analysisResults.slice(analysisIndex, analysisIndex + 1).map(res => (
                    <SwipeCard key={res.itemId} analysis={res} onSwipe={handleSwipe} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {activeTab === 'folders' && (
          <div className="space-y-6">
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedFolder(ItemStatus.DONATED)}
                className={`flex-1 py-3 rounded-2xl font-bold text-sm transition ${selectedFolder === ItemStatus.DONATED ? 'bg-red-500 text-white' : 'bg-white border border-stone-200'}`}
              >
                Charity
              </button>
              <button 
                onClick={() => setSelectedFolder(ItemStatus.TRANSFORMED)}
                className={`flex-1 py-3 rounded-2xl font-bold text-sm transition ${selectedFolder === ItemStatus.TRANSFORMED ? 'bg-emerald-500 text-white' : 'bg-white border border-stone-200'}`}
              >
                Transform
              </button>
              <button 
                onClick={() => setSelectedFolder(ItemStatus.RESERVED)}
                className={`flex-1 py-3 rounded-2xl font-bold text-sm transition ${selectedFolder === ItemStatus.RESERVED ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200'}`}
              >
                Reserved
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {items.filter(i => i.status === selectedFolder).map(item => (
                <div key={item.id} onClick={() => setSelectedItemForDetail(item)} className="bg-white rounded-2xl p-2 shadow-sm border border-stone-200 overflow-hidden cursor-pointer">
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-2">
                    <img src={item.imageUrl} className="w-full h-full object-cover" />
                  </div>
                  <h3 className="font-bold text-sm truncate">{item.name}</h3>
                  {selectedFolder === ItemStatus.TRANSFORMED && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">Needs DIY</span>
                  )}
                </div>
              ))}
            </div>
            {items.filter(i => i.status === selectedFolder).length === 0 && (
               <div className="text-center py-20 text-stone-400">
                 <Layers size={48} className="mx-auto mb-4 opacity-20" />
                 <p>Nothing in this folder yet.</p>
               </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-8 animate-in slide-in-from-right duration-300">
             <div className="flex items-center gap-4">
               <button onClick={() => setActiveTab('wardrobe')} className="p-2"><ArrowLeft /></button>
               <h2 className="text-2xl font-black">STYLE PROFILE</h2>
             </div>

             <div className="bg-white p-6 rounded-3xl border border-stone-200 space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase text-stone-400 tracking-tighter mb-4">Preferred Styles</h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.preferredStyles.map(s => (
                      <span key={s} className="bg-stone-100 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                        {s} <X size={14} className="cursor-pointer" onClick={() => setProfile({...profile, preferredStyles: profile.preferredStyles.filter(x => x !== s)})} />
                      </span>
                    ))}
                    <button className="px-4 py-2 border border-dashed border-stone-300 rounded-xl text-stone-400 text-sm font-bold">+ Style</button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase text-stone-400 tracking-tighter mb-4">Favorite Colors</h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.preferredColors.map(c => (
                      <span key={c} className="bg-stone-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                        {c} <X size={14} className="cursor-pointer" onClick={() => setProfile({...profile, preferredColors: profile.preferredColors.filter(x => x !== c)})} />
                      </span>
                    ))}
                    <button className="px-4 py-2 border border-dashed border-stone-300 rounded-xl text-stone-400 text-sm font-bold">+ Color</button>
                  </div>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-stone-200 px-6 py-3 flex justify-between items-center z-40 max-w-md mx-auto">
        <button onClick={() => setActiveTab('wardrobe')} className={`flex flex-col items-center gap-1 ${activeTab === 'wardrobe' ? 'text-emerald-600' : 'text-stone-400'}`}>
          <Shirt size={20} />
          <span className="text-[10px] font-bold">CLOSET</span>
        </button>
        <button onClick={() => setActiveTab('analysis')} className={`flex flex-col items-center gap-1 ${activeTab === 'analysis' ? 'text-emerald-600' : 'text-stone-400'}`}>
          <Sparkles size={20} />
          <span className="text-[10px] font-bold">ANALYZE</span>
        </button>
        <button onClick={() => setActiveTab('folders')} className={`flex flex-col items-center gap-1 ${activeTab === 'folders' ? 'text-emerald-600' : 'text-stone-400'}`}>
          <Layers size={20} />
          <span className="text-[10px] font-bold">FOLDERS</span>
        </button>
      </nav>

      {/* Add Item Modal */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-50 bg-stone-100 flex flex-col p-6 max-w-md mx-auto"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">ADD CLOTHES</h2>
              <button onClick={() => setIsAdding(false)} className="p-2 bg-white rounded-full shadow-sm"><X /></button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <div className="w-full aspect-square bg-white rounded-3xl border-4 border-dashed border-stone-200 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                {isProcessingImage ? (
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="font-bold text-stone-600 animate-pulse">GEMINI IS CATEGORIZING...</p>
                  </div>
                ) : capturedImage ? (
                  <img src={capturedImage} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera size={48} className="text-stone-300" />
                    <p className="text-stone-400 font-medium">Take or Upload a photo</p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 w-full">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-stone-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl"
                >
                  <Camera size={20} /> CAMERA
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white text-stone-900 py-4 rounded-2xl font-bold border border-stone-200 flex items-center justify-center gap-2 shadow-sm"
                >
                  <Search size={20} /> GALLERY
                </button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item Detail View */}
      <AnimatePresence>
        {selectedItemForDetail && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-0 backdrop-blur-sm"
            onClick={() => {setSelectedItemForDetail(null); setTransformation(null);}}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-md rounded-t-[40px] overflow-hidden max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative">
                <img src={selectedItemForDetail.imageUrl} className="w-full h-[40vh] object-cover" />
                <button 
                  onClick={() => {setSelectedItemForDetail(null); setTransformation(null);}} 
                  className="absolute top-6 right-6 p-3 bg-white/90 backdrop-blur rounded-full shadow-lg"
                >
                  <X size={20} />
                </button>
                <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                  <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-2xl shadow-sm border border-white/20">
                    <h2 className="text-xl font-black">{selectedItemForDetail.name}</h2>
                    <p className="text-xs text-stone-500 uppercase tracking-widest">{selectedItemForDetail.category}</p>
                  </div>
                  <div className="bg-emerald-600 text-white px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2 font-bold">
                    {selectedItemForDetail.wearCount} Wears
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* Stats & Quick Actions */}
                <div className="flex gap-4">
                  <button 
                    onClick={() => handleWornToday(selectedItemForDetail.id)}
                    className="flex-1 bg-stone-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl active:scale-95 transition"
                  >
                    <Plus size={18} /> WORN TODAY
                  </button>
                  {selectedItemForDetail.status === ItemStatus.TRANSFORMED && !transformation && (
                    <button 
                      onClick={() => fetchTransformation(selectedItemForDetail)}
                      disabled={isTransforming}
                      className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl disabled:opacity-50"
                    >
                      {isTransforming ? 'LOADING...' : 'DIY GUIDE'}
                    </button>
                  )}
                </div>

                {/* Transformation Guide Detail */}
                {transformation && (
                  <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-between items-start">
                      <h3 className="text-xl font-bold text-emerald-900">{transformation.title}</h3>
                      <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded uppercase">{transformation.difficulty}</span>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-black uppercase text-emerald-700 tracking-tighter mb-2">Tools Needed</p>
                        <div className="flex flex-wrap gap-2">
                          {transformation.toolsNeeded.map(tool => (
                            <span key={tool} className="text-xs bg-white/50 px-3 py-1 rounded-full border border-emerald-200">{tool}</span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase text-emerald-700 tracking-tighter">Steps</p>
                        {transformation.steps.map((step, idx) => (
                          <div key={idx} className="flex gap-3 text-sm text-stone-700 leading-relaxed">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center flex-shrink-0 font-bold">{idx + 1}</span>
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter mb-1">Color</p>
                    <p className="font-bold">{selectedItemForDetail.color}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter mb-1">Material</p>
                    <p className="font-bold">{selectedItemForDetail.material}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter mb-1">Added</p>
                    <p className="font-bold">{selectedItemForDetail.purchaseDate}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter mb-1">Last Worn</p>
                    <p className="font-bold">{selectedItemForDetail.lastWornDate || 'Never'}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
