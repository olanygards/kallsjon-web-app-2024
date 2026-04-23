import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Play, X, Calendar, Wind, User, ArrowRight, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface MediaItem {
    id: string;
    url: string;
    type: 'image' | 'video';
    originalName: string;
    createdAt: any;
    date: string; // YYYY-MM-DD
    capturedAt?: string; // HH:mm
    description?: string;
    uploaderName?: string;
    windData?: {
        avg: number;
        gust: number;
        direction: number;
    };
}

interface MediaViewProps {
    onNavigateToDate: (date: Date) => void;
    onUploadClick: () => void;
    onBackToOverview?: () => void;
}

export const MediaView: React.FC<MediaViewProps> = ({ onNavigateToDate, onUploadClick, onBackToOverview }) => {
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
    const [touchStartY, setTouchStartY] = useState<number | null>(null);
    const [touchEndY, setTouchEndY] = useState<number | null>(null);

    useEffect(() => {
        fetchMedia();
    }, []);

    // Close modal on Escape
    useEffect(() => {
        if (!selectedItem) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedItem(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedItem]);

    // Prevent background scroll while lightbox is open
    useEffect(() => {
        if (!selectedItem) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [selectedItem]);

    const fetchMedia = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'media_items'),
                orderBy('date', 'desc'),
                orderBy('createdAt', 'desc'),
                limit(50) // Initial limit, could add pagination later
            );

            const querySnapshot = await getDocs(q);
            const items: MediaItem[] = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as MediaItem);
            });

            setMediaItems(items);
        } catch (error) {
            console.error('Error fetching media:', error);
        } finally {
            setLoading(false);
        }
    };

    // Group items by Month
    const groupedItems = useMemo(() => {
        const groups: { [key: string]: MediaItem[] } = {};

        mediaItems.forEach(item => {
            const date = new Date(item.date);
            const monthKey = format(date, 'MMMM yyyy', { locale: sv });
            // Capitalize first letter
            const formattedKey = monthKey.charAt(0).toUpperCase() + monthKey.slice(1);

            if (!groups[formattedKey]) {
                groups[formattedKey] = [];
            }
            groups[formattedKey].push(item);
        });

        return groups;
    }, [mediaItems]);

    return (
        <div className="animate-in fade-in duration-500 pb-24">
            <div className="flex justify-between items-center mb-6 sticky top-20 z-10 bg-emerald-950/90 backdrop-blur-md py-4 -mx-4 px-4 border-b border-emerald-800/50">
                <h2 className="text-xl font-bold text-white">Mediaflöde</h2>
                <button
                    onClick={onUploadClick}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all hover:scale-105"
                >
                    Ladda upp
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedItems).map(([month, items]) => (
                        <div key={month}>
                            <h3 className="text-emerald-400 text-sm font-bold uppercase tracking-wider mb-3 sticky top-[4.5rem] z-0 bg-emerald-950/80 backdrop-blur-sm py-2 w-fit px-3 rounded-full border border-emerald-800/30">
                                {month}
                            </h3>
                            <div className="grid grid-cols-3 gap-1">
                                {items.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedItem(item)}
                                        className="relative aspect-square bg-emerald-900/20 overflow-hidden cursor-pointer group"
                                    >
                                        {item.type === 'video' ? (
                                            <>
                                                <video src={item.url} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                                                    <Play className="w-8 h-8 text-white fill-white/50" />
                                                </div>
                                            </>
                                        ) : (
                                            <img src={item.url} alt="Thumbnail" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        )}

                                        {/* Wind Badge (Mini) */}
                                        {item.windData && (
                                            <div className="absolute top-1 right-1 bg-black/40 backdrop-blur-sm rounded px-1 py-0.5 flex items-center gap-0.5">
                                                <Wind className="w-2 h-2 text-emerald-400" />
                                                <span className="text-[8px] text-white font-bold">{item.windData.avg.toFixed(0)}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {mediaItems.length === 0 && (
                        <div className="text-center py-12 text-emerald-500/50">
                            <p>Inga bilder uppladdade än.</p>
                            <p className="text-sm mt-2">Bli den första!</p>
                        </div>
                    )}
                </div>
            )}

            {/* Lightbox */}
            {selectedItem && (
                <div
                    className="fixed inset-0 z-[60] bg-black/95 flex flex-col animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSelectedItem(null);
                    }}
                    onTouchStart={(e) => {
                        setTouchEndY(null);
                        setTouchStartY(e.targetTouches[0]?.clientY ?? null);
                    }}
                    onTouchMove={(e) => {
                        setTouchEndY(e.targetTouches[0]?.clientY ?? null);
                    }}
                    onTouchEnd={() => {
                        if (touchStartY == null || touchEndY == null) return;
                        const delta = touchEndY - touchStartY; // positive = swipe down
                        if (delta > 80) setSelectedItem(null);
                    }}
                >
                    {/* Header */}
                    <div
                        className="flex justify-between items-center p-4 bg-black/40 backdrop-blur-md border-b border-white/10"
                        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col">
                            <span className="text-white font-bold text-sm">
                                {format(new Date(selectedItem.date), 'd MMMM yyyy', { locale: sv })}
                            </span>
                            {selectedItem.capturedAt && (
                                <span className="text-white/50 text-xs">
                                    kl {selectedItem.capturedAt}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {onBackToOverview && (
                                <button
                                    onClick={() => {
                                        setSelectedItem(null);
                                        onBackToOverview();
                                    }}
                                    className="px-3 py-2 bg-white/10 rounded-xl hover:bg-white/20 text-white transition-colors text-sm font-bold flex items-center gap-2"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Läget
                                </button>
                            )}
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition-colors"
                                aria-label="Stäng"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div
                        className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-hidden relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {selectedItem.type === 'video' ? (
                            <video
                                src={selectedItem.url}
                                controls
                                autoPlay
                                playsInline
                                className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                            />
                        ) : (
                            <img src={selectedItem.url} alt="Full view" className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
                        )}
                    </div>

                    {/* Footer / Info Panel */}
                    <div
                        className="bg-black/80 backdrop-blur-xl border-t border-white/10 p-4 space-y-4 overflow-auto"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)', maxHeight: '40vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Wind Data */}
                        {selectedItem.windData && (
                            <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
                                <div className="p-2 bg-emerald-500/20 rounded-lg">
                                    <Wind className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Vind vid tillfället</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xl font-bold text-white">{selectedItem.windData.avg.toFixed(1)}</span>
                                        <span className="text-sm text-yellow-400 font-bold">({selectedItem.windData.gust.toFixed(1)})</span>
                                        <span className="text-xs text-white/50">m/s</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Description & Uploader */}
                        {(selectedItem.description || selectedItem.uploaderName) && (
                            <div className="space-y-2">
                                {selectedItem.description && (
                                    <p className="text-white/90 text-sm leading-relaxed italic">
                                        "{selectedItem.description}"
                                    </p>
                                )}
                                {selectedItem.uploaderName && (
                                    <div className="flex items-center gap-2 text-xs text-white/50">
                                        <User className="w-3 h-3" />
                                        <span>Foto: <span className="text-white">{selectedItem.uploaderName}</span></span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Navigation Button */}
                        <button
                            onClick={() => {
                                onNavigateToDate(new Date(selectedItem.date));
                                setSelectedItem(null);
                            }}
                            className="w-full bg-emerald-800 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                            <Calendar className="w-4 h-4" />
                            Gå till denna dag <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
