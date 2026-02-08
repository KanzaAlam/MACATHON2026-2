
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  X,
  Shirt, 
  Scissors, 
  HeartHandshake, 
  Calendar,
  Layers,
  Sparkles,
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  Check
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
      preferredStyles: ['Casual', 'Modern'],
      preferredColors: ['White', 'Black', 'Blue'],
      dislikedElements: []
    };
  });

  const [activeTab, setActiveTab] = useState<'wardrobe' | 'analysis' | 'profile' | 'folders'>('wardrobe');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [selectedFolder, setSelectedFolder] = useState<ItemStatus>(ItemStatus.ACTIVE);
  
  const [isAdding, setIsAdding] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResponse[]>([]);
  const [analysisIndex, setAnalysisIndex] = useState(0);

  const [selectedItemForDetail, setSelectedItemForDetail] = useState<WardrobeItem | null>(null);
  const [transformation, setTransformation] = useState<TransformationGuide | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('eco-wardrobe-items-v2', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('eco-wardrobe-profile-v2', JSON.stringify(profile));
  }, [profile]);

  const handleWornToday = (itemId: string) => {
    const now = new Date().toLocaleDateString();
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, wearCount: item.wearCount + 1, lastWornDate: now }
        : item
    ));
    if (selectedItemForDetail?.id === itemId) {
      setSelectedItemForDetail(prev => prev ? { ...prev, wearCount: prev.wearCount + 1, lastWornDate: now } : null);
    }
  };

  const handleImageInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const imageData = reader.result as string;
        const base64 = imageData.split(',')[1];
        setCapturedImage(imageData);
        setIsProcessingImage(true);
        try {
          const aiData = await categorizeItemFromImage(base64);
          const newItem: WardrobeItem = {
            id: Date.now().toString(),
            name: aiData.name,
            category: aiData.category,
            color: aiData.color,
            material: aiData.material,
            imageUrl: imageData,
            purchaseDate: new Date().toISOString().split('T')[0],
            lastWornDate: null,
            wearCount: 0,
            status: ItemStatus.ACTIVE
          };
          setItems(prev => [newItem, ...prev]);
          setIsAdding(false);
          setCapturedImage(null);
        } catch (error) {
          console.error("AI Categorization failed", error);
          alert("Could not automatically categorize. Please try again with a clearer photo.");
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

    let newStatus = item.status;
    if (direction === 'left') newStatus = ItemStatus.DONATED;
    else if (direction === 'right') newStatus = ItemStatus.TRANSFORMED;
    else if (direction === 'up') newStatus = ItemStatus.RESERVED;

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));

    if (analysisIndex < analysisResults.length - 1) {
      setAnalysisIndex(prev => prev + 1);
    } else {
      setIsAnalyzing(false);
      setAnalysisResults([]);
      setActiveTab('folders');
      setSelectedFolder(newStatus);
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

  const SwipeCard = ({ analysis, onSwipe }: { analysis: AnalysisResponse, onSwipe: (dir: 'left' | 'right' | 'up') => void }) => {
    const item = items.find(i => i.id === analysis.itemId);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotate = useTransform(x, [-150, 150], [-10, 10]);
    const opacity = useTransform(x, [-150, -100, 0, 100, 150], [0, 1, 1, 1, 0]);
    const donateOpacity = useTransform(x, [-120, -40], [1, 0]);
    const transformOpacity = useTransform(x, [40, 120], [0, 1]);

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
        <div className="relative w-full h-full bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-stone-200">
          <img src={item.imageUrl} className="w-full h-3/5 object-cover" />
          <motion.div style={{ opacity: donateOpacity }} className="absolute top-12 left-8 bg-red-500 text-white px-6 py-2 rounded-full font-black text-xl border-4 border-white shadow-lg -rotate-12">DONATE</motion.div>
          <motion.div style={{ opacity: transformOpacity }} className="absolute top-12 right-8 bg-emerald-500 text-white px-6 py-2 rounded-full font-black text-xl border-4 border-white shadow-lg rotate-12">TRANSFORM</motion.div>
          <div className="p-8">
            <h3 className="text-2xl font-black mb-1">{item.name}</h3>
            <p className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">{item.category}</p>
            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex gap-3">
              <Sparkles size={20} className="text-emerald-500 flex-shrink-0 mt-1" />
              <p className="text-sm text-stone-700 italic leading-snug">{analysis.reasoning}</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-24 selection:bg-emerald-100">
      <header className="bg-white/80 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-stone-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Shirt className="text-white" size={18} />
          </div>
          <h1 className="text-lg font-black tracking-tighter uppercase italic">EcoWardrobe</h1>
        </div>
        <button onClick={() => setActiveTab('profile')} className="w-9 h-9 rounded-full bg-stone-200 border-2 border-white shadow-sm overflow-hidden transition hover:scale-105 active:scale-95">
          <div className="w-full h-full bg-gradient-to-tr from-emerald-500 to-teal-400"></div>
        </button>
      </header>

      <main className="max-w-md mx-auto p-4">
        {activeTab === 'wardrobe' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black">My Collection</h2>
                <p className="text-xs font-bold text-stone-400 uppercase">{items.filter(i => i.status === ItemStatus.ACTIVE).length} Items</p>
              </div>
              <button 
                onClick={() => setIsAdding(true)}
                className="bg-stone-900 text-white p-3.5 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
              <button onClick={() => setSelectedCategory('All')} className={`px-5 py-2 rounded-full text-xs font-black uppercase transition ${selectedCategory === 'All' ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200'}`}>All</button>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-5 py-2 rounded-full text-xs font-black uppercase transition ${selectedCategory === cat ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200'}`}>{cat}</button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {items
                .filter(i => i.status === ItemStatus.ACTIVE && (selectedCategory === 'All' || i.category === selectedCategory))
                .map(item => (
                <motion.div layoutId={item.id} key={item.id} onClick={() => setSelectedItemForDetail(item)} className="bg-white rounded-3xl p-2 shadow-sm border border-stone-200 group cursor-pointer transition active:scale-95">
                  <div className="relative aspect-[4/5] mb-2 rounded-[1.25rem] overflow-hidden">
                    <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" />
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-[9px] font-black shadow-sm flex items-center gap-1">
                      <Check size={10} className="text-emerald-600" /> {item.wearCount}
                    </div>
                  </div>
                  <div className="px-2 pb-2">
                    <h3 className="font-bold text-sm truncate">{item.name}</h3>
                    <p className="text-[9px] text-stone-400 font-black uppercase tracking-tighter">{item.category}</p>
                  </div>
                </motion.div>
              ))}
              {items.filter(i => i.status === ItemStatus.ACTIVE).length === 0 && (
                <div className="col-span-2 py-20 text-center space-y-4">
                  <div className="bg-stone-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-stone-300">
                    <Shirt size={32} />
                  </div>
                  <p className="text-stone-400 text-sm font-bold uppercase">Your wardrobe is empty</p>
                  <button onClick={() => setIsAdding(true)} className="text-emerald-600 font-black text-sm uppercase underline decoration-2 underline-offset-4">Add your first item</button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="h-[75vh] flex flex-col justify-center">
            {!isAnalyzing && analysisResults.length === 0 ? (
              <div className="text-center space-y-8 animate-in zoom-in duration-300">
                <div className="relative mx-auto w-32 h-32">
                  <div className="absolute inset-0 bg-emerald-100 rounded-full animate-pulse"></div>
                  <div className="absolute inset-4 bg-emerald-200 rounded-full animate-ping"></div>
                  <div className="relative w-full h-full flex items-center justify-center text-emerald-600">
                    <Sparkles size={64} />
                  </div>
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tighter">WARDROBE AI</h2>
                  <p className="text-stone-500 mt-2 px-8">Gemini will analyze your style and usage to help you declutter sustainably.</p>
                </div>
                <button onClick={startAnalysis} className="bg-emerald-600 text-white py-5 px-12 rounded-[2rem] font-black text-lg shadow-2xl shadow-emerald-200 active:scale-95 transition">
                  ANALYZE MY CLOSET
                </button>
              </div>
            ) : isAnalyzing && analysisResults.length === 0 ? (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="font-black text-stone-400 uppercase tracking-widest text-xs animate-pulse">Gemini is thinking...</p>
              </div>
            ) : (
              <div className="relative w-full h-full max-h-[600px]">
                <div className="absolute -top-12 inset-x-0 flex justify-center">
                   <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Item {analysisIndex + 1} of {analysisResults.length}</p>
                </div>
                <div className="absolute inset-x-0 bottom-[-80px] flex justify-center gap-6">
                   <button onClick={() => handleSwipe('left')} className="p-5 bg-white shadow-xl rounded-full text-red-500 border border-stone-100 active:scale-90 transition hover:bg-red-50"><HeartHandshake size={28} /></button>
                   <button onClick={() => handleSwipe('up')} className="p-5 bg-white shadow-xl rounded-full text-stone-900 border border-stone-100 active:scale-90 transition hover:bg-stone-50"><Calendar size={28} /></button>
                   <button onClick={() => handleSwipe('right')} className="p-5 bg-white shadow-xl rounded-full text-emerald-500 border border-stone-100 active:scale-90 transition hover:bg-emerald-50"><Scissors size={28} /></button>
                </div>
                <AnimatePresence mode="popLayout">
                  <SwipeCard key={analysisResults[analysisIndex].itemId} analysis={analysisResults[analysisIndex]} onSwipe={handleSwipe} />
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {activeTab === 'folders' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-2xl font-black">Categories</h2>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setSelectedFolder(ItemStatus.DONATED)} className={`py-4 rounded-2xl font-black text-[10px] uppercase transition flex flex-col items-center gap-2 border ${selectedFolder === ItemStatus.DONATED ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-100' : 'bg-white border-stone-200'}`}>
                <HeartHandshake size={18} /> Charity
              </button>
              <button onClick={() => setSelectedFolder(ItemStatus.TRANSFORMED)} className={`py-4 rounded-2xl font-black text-[10px] uppercase transition flex flex-col items-center gap-2 border ${selectedFolder === ItemStatus.TRANSFORMED ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-100' : 'bg-white border-stone-200'}`}>
                <Scissors size={18} /> DIY Guide
              </button>
              <button onClick={() => setSelectedFolder(ItemStatus.RESERVED)} className={`py-4 rounded-2xl font-black text-[10px] uppercase transition flex flex-col items-center gap-2 border ${selectedFolder === ItemStatus.RESERVED ? 'bg-stone-900 text-white border-stone-900 shadow-lg shadow-stone-100' : 'bg-white border-stone-200'}`}>
                <Calendar size={18} /> Special
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {items.filter(i => i.status === selectedFolder).map(item => (
                <div key={item.id} onClick={() => setSelectedItemForDetail(item)} className="bg-white rounded-[2rem] p-2 shadow-sm border border-stone-200 cursor-pointer transition active:scale-95">
                  <div className="aspect-square rounded-[1.5rem] overflow-hidden mb-2">
                    <img src={item.imageUrl} className="w-full h-full object-cover" />
                  </div>
                  <div className="px-2 pb-2">
                    <h3 className="font-bold text-xs truncate">{item.name}</h3>
                    {selectedFolder === ItemStatus.TRANSFORMED && (
                      <span className="text-[8px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase">Guide ready</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {items.filter(i => i.status === selectedFolder).length === 0 && (
               <div className="text-center py-24 text-stone-300 space-y-4">
                 <Layers size={48} className="mx-auto opacity-20" />
                 <p className="text-[10px] font-black uppercase tracking-widest">Folder is empty</p>
               </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-8 animate-in slide-in-from-right duration-400">
             <div className="flex items-center gap-4">
               <button onClick={() => setActiveTab('wardrobe')} className="p-3 bg-white rounded-2xl shadow-sm border border-stone-200"><ArrowLeft size={20}/></button>
               <h2 className="text-2xl font-black">STYLE PROFILE</h2>
             </div>

             <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm space-y-10">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Preferred Vibes</h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.preferredStyles.map(s => (
                      <span key={s} className="bg-stone-50 border border-stone-100 px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2">
                        {s} <X size={14} className="text-stone-300 hover:text-red-500 cursor-pointer" onClick={() => setProfile({...profile, preferredStyles: profile.preferredStyles.filter(x => x !== s)})} />
                      </span>
                    ))}
                    <button className="px-5 py-2.5 border-2 border-dashed border-stone-200 rounded-2xl text-stone-300 text-xs font-black hover:border-stone-400 transition">+ ADD</button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Color Palette</h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.preferredColors.map(c => (
                      <span key={c} className="bg-stone-900 text-white px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2">
                        {c} <X size={14} className="text-stone-500 hover:text-red-400 cursor-pointer" onClick={() => setProfile({...profile, preferredColors: profile.preferredColors.filter(x => x !== c)})} />
                      </span>
                    ))}
                    <button className="px-5 py-2.5 border-2 border-dashed border-stone-200 rounded-2xl text-stone-300 text-xs font-black hover:border-stone-400 transition">+ ADD</button>
                  </div>
                </div>
             </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-6 right-6 bg-stone-900/95 backdrop-blur-xl rounded-[2rem] px-8 py-5 flex justify-between items-center z-40 max-w-md mx-auto shadow-2xl shadow-stone-900/40">
        <button onClick={() => setActiveTab('wardrobe')} className={`flex flex-col items-center gap-1.5 transition ${activeTab === 'wardrobe' ? 'text-emerald-400 scale-110' : 'text-stone-500 opacity-60'}`}>
          <Shirt size={22} />
          <span className="text-[8px] font-black uppercase tracking-tighter">Closet</span>
        </button>
        <button onClick={() => setActiveTab('analysis')} className={`flex flex-col items-center gap-1.5 transition ${activeTab === 'analysis' ? 'text-emerald-400 scale-110' : 'text-stone-500 opacity-60'}`}>
          <Sparkles size={22} />
          <span className="text-[8px] font-black uppercase tracking-tighter">Gemini</span>
        </button>
        <button onClick={() => setActiveTab('folders')} className={`flex flex-col items-center gap-1.5 transition ${activeTab === 'folders' ? 'text-emerald-400 scale-110' : 'text-stone-500 opacity-60'}`}>
          <Layers size={22} />
          <span className="text-[8px] font-black uppercase tracking-tighter">Vault</span>
        </button>
      </nav>

      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-white flex flex-col p-6 max-w-md mx-auto overflow-hidden">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black italic tracking-tighter">NEW ITEM</h2>
              <button onClick={() => setIsAdding(false)} className="p-3 bg-stone-100 rounded-full active:scale-90 transition"><X size={24}/></button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-12">
              <div className="w-full aspect-[4/5] bg-stone-50 rounded-[3rem] border-4 border-dashed border-stone-100 flex flex-col items-center justify-center gap-6 relative overflow-hidden shadow-inner">
                {isProcessingImage ? (
                  <div className="text-center space-y-6">
                    <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div>
                      <p className="font-black text-emerald-600 animate-pulse text-sm uppercase tracking-widest">Analyzing Image</p>
                      <p className="text-[10px] text-stone-400 mt-2">GEMINI API POWERED</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-6 rounded-full shadow-sm text-stone-300">
                      <Camera size={48} />
                    </div>
                    <div className="text-center px-8">
                      <p className="text-stone-900 font-black text-lg">Add to your Closet</p>
                      <p className="text-stone-400 text-sm mt-1">AI will automatically detect the category and material.</p>
                    </div>
                  </>
                )}
              </div>

              <div className="w-full space-y-4">
                <button onClick={() => cameraInputRef.current?.click()} className="w-full bg-stone-900 text-white py-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition">
                  <Camera size={24} /> SNAP PHOTO
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white text-stone-900 py-5 rounded-[2rem] font-black text-lg border-2 border-stone-100 flex items-center justify-center gap-3 active:scale-95 transition">
                  <ImageIcon size={24} /> UPLOAD IMAGE
                </button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageInput} accept="image/*" className="hidden" />
              <input type="file" ref={cameraInputRef} onChange={handleImageInput} accept="image/*" capture="environment" className="hidden" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedItemForDetail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex items-end justify-center backdrop-blur-md" onClick={() => {setSelectedItemForDetail(null); setTransformation(null);}}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-white w-full max-w-md rounded-t-[3rem] overflow-hidden max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="relative h-[45vh]">
                <img src={selectedItemForDetail.imageUrl} className="w-full h-full object-cover" />
                <button onClick={() => {setSelectedItemForDetail(null); setTransformation(null);}} className="absolute top-8 right-8 p-3 bg-white/95 backdrop-blur rounded-full shadow-2xl transition active:scale-90"><X size={20} /></button>
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[2rem] shadow-2xl border border-white/40">
                    <div className="flex justify-between items-start mb-1">
                      <h2 className="text-3xl font-black italic tracking-tighter">{selectedItemForDetail.name}</h2>
                      <div className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-black text-[10px] flex items-center gap-1 shadow-lg shadow-emerald-200">
                        <Check size={12} /> {selectedItemForDetail.wearCount}x
                      </div>
                    </div>
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{selectedItemForDetail.category}</p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-10">
                <div className="flex gap-3">
                  <button onClick={() => handleWornToday(selectedItemForDetail.id)} className="flex-1 bg-stone-900 text-white py-5 rounded-[2rem] font-black text-sm flex items-center justify-center gap-2 shadow-2xl active:scale-95 transition">
                    <Plus size={18} /> I WORE THIS TODAY
                  </button>
                  {(selectedItemForDetail.status === ItemStatus.TRANSFORMED || selectedItemForDetail.status === ItemStatus.ACTIVE) && (
                    <button onClick={() => fetchTransformation(selectedItemForDetail)} disabled={isTransforming} className="w-16 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center active:scale-95 transition disabled:opacity-30">
                      {isTransforming ? <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div> : <Scissors size={20} />}
                    </button>
                  )}
                </div>

                {transformation && (
                  <div className="bg-emerald-50/50 p-8 rounded-[2.5rem] border border-emerald-100 space-y-6 animate-in slide-in-from-bottom-4 duration-400">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <Scissors size={20} />
                        <h3 className="text-xl font-black uppercase italic tracking-tighter">{transformation.title}</h3>
                      </div>
                      <span className="text-[9px] font-black bg-emerald-600 text-white px-3 py-1 rounded-full uppercase">{transformation.difficulty}</span>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest">Required Tools</p>
                        <div className="flex flex-wrap gap-2">
                          {transformation.toolsNeeded.map(tool => (
                            <span key={tool} className="text-[10px] font-bold bg-white px-4 py-2 rounded-xl border border-emerald-100 shadow-sm">{tool}</span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest">Step-by-Step</p>
                        {transformation.steps.map((step, idx) => (
                          <div key={idx} className="flex gap-4 text-xs font-medium text-stone-700 leading-relaxed bg-white/60 p-4 rounded-2xl border border-emerald-50 shadow-sm">
                            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center flex-shrink-0 font-black">{idx + 1}</span>
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-8 text-[10px] font-black uppercase tracking-widest">
                  <div className="space-y-1">
                    <p className="text-stone-300">Color Palette</p>
                    <p className="text-stone-900 text-xs">{selectedItemForDetail.color}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-stone-300">Fabric</p>
                    <p className="text-stone-900 text-xs">{selectedItemForDetail.material}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-stone-300">Purchased</p>
                    <p className="text-stone-900 text-xs">{selectedItemForDetail.purchaseDate}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-stone-300">Last Encounter</p>
                    <p className="text-stone-900 text-xs">{selectedItemForDetail.lastWornDate || 'Never'}</p>
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
