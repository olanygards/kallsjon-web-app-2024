import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { X, Play, Trash2, AlertTriangle, Wind, User } from 'lucide-react';

interface MediaItem {
    id: string;
    url: string;
    type: 'image' | 'video';
    originalName: string;
    createdAt: any;
    storagePath: string; // Needed for deletion
    capturedAt?: string; // HH:mm
    description?: string;
    uploaderName?: string;
    windData?: {
        avg: number;
        gust: number;
        direction: number;
    };
}

interface DailyGalleryProps {
    date: string; // YYYY-MM-DD
}

export const DailyGallery: React.FC<DailyGalleryProps> = ({ date }) => {
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

    // Delete state
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteCode, setDeleteCode] = useState('');
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const SHARED_CODE = "kallsjon2024";

    useEffect(() => {
        fetchMedia();
    }, [date]);

    const fetchMedia = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'media_items'),
                where('date', '==', date)
            );

            const querySnapshot = await getDocs(q);
            const items: MediaItem[] = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as MediaItem);
            });

            // Sort in memory
            items.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });

            setMediaItems(items);
        } catch (error) {
            console.error('Error fetching media:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedItem) return;

        if (deleteCode !== SHARED_CODE) {
            setDeleteError('Fel kod');
            return;
        }

        setIsDeleting(true);
        setDeleteError(null);

        try {
            // 1. Delete from Storage
            if (selectedItem.storagePath) {
                const storageRef = ref(storage, selectedItem.storagePath);
                await deleteObject(storageRef);
            }

            // 2. Delete from Firestore
            await deleteDoc(doc(db, 'media_items', selectedItem.id));

            // 3. Update UI
            setMediaItems(prev => prev.filter(item => item.id !== selectedItem.id));
            setSelectedItem(null);
            setShowDeleteConfirm(false);
            setDeleteCode('');
        } catch (error) {
            console.error('Error deleting media:', error);
            setDeleteError('Kunde inte ta bort filen. Kontrollera behörigheter.');
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) return <div className="text-white/40 text-sm py-4">Laddar bilder...</div>;
    if (mediaItems.length === 0) return null;

    return (
        <div className="mt-6">
            <h3 className="text-lg font-medium text-white mb-4">Bilder & Film från dagen</h3>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {mediaItems.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className="relative aspect-square bg-black/20 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group"
                    >
                        {item.type === 'video' ? (
                            <>
                                <video src={item.url} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                                    <Play className="w-8 h-8 text-white fill-white/50" />
                                </div>
                            </>
                        ) : (
                            <img src={item.url} alt="Daily capture" className="w-full h-full object-cover" />
                        )}
                        {item.capturedAt && (
                            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded backdrop-blur-sm">
                                {item.capturedAt}
                            </div>
                        )}
                        {item.windData && (
                            <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
                                <Wind className="w-3 h-3 text-emerald-400" />
                                <span>{item.windData.avg.toFixed(0)}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Lightbox */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
                    <button
                        onClick={() => {
                            setSelectedItem(null);
                            setShowDeleteConfirm(false);
                            setDeleteCode('');
                        }}
                        className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 text-white z-50"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {selectedItem.capturedAt && (
                        <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full backdrop-blur-md z-50 font-mono">
                            kl {selectedItem.capturedAt}
                        </div>
                    )}

                    {/* Delete Button (Bottom Right) */}
                    {!showDeleteConfirm ? (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="absolute bottom-4 right-4 p-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-full backdrop-blur-md z-50 transition-colors"
                            title="Ta bort"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    ) : (
                        <div className="absolute bottom-4 right-4 bg-black/80 border border-white/10 p-4 rounded-xl backdrop-blur-md z-50 flex flex-col gap-3 min-w-[250px]">
                            <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                                <AlertTriangle className="w-4 h-4" />
                                Ta bort fil?
                            </div>
                            <input
                                type="password"
                                value={deleteCode}
                                onChange={(e) => setDeleteCode(e.target.value)}
                                placeholder="Ange kod"
                                className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                                autoFocus
                            />
                            {deleteError && (
                                <p className="text-xs text-red-400">{deleteError}</p>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded transition-colors"
                                >
                                    Avbryt
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting || !deleteCode}
                                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors disabled:opacity-50"
                                >
                                    {isDeleting ? 'Tar bort...' : 'Bekräfta'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="max-w-5xl max-h-[90vh] w-full flex items-center justify-center">
                        {selectedItem.type === 'video' ? (
                            <video src={selectedItem.url} controls autoPlay className="max-h-[90vh] max-w-full rounded" />
                        ) : (
                            <img src={selectedItem.url} alt="Full view" className="max-h-[90vh] max-w-full object-contain rounded" />
                        )}
                    </div>

                    {/* Footer / Info Panel */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 p-4 space-y-4 z-40">
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
                    </div>
                </div>
            )}
        </div>
    );
};
