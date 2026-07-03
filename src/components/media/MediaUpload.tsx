import React, { useState, useRef, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { signInAnonymously, signOut } from 'firebase/auth';
import { db, storage, auth } from '../../config/firebase';
import ExifReader from 'exifreader';
import { format, parseISO, isValid } from 'date-fns';
import { Upload, X, Image as ImageIcon, Calendar, Check, Wind, User, FileText, ArrowRight } from 'lucide-react';


interface MediaUploadProps {
    preselectedDate?: string; // YYYY-MM-DD
    onUploadComplete?: () => void;
}

export const MediaUpload: React.FC<MediaUploadProps> = ({ preselectedDate, onUploadComplete }) => {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Metadata state
    const [detectedDate, setDetectedDate] = useState<string>(preselectedDate || format(new Date(), 'yyyy-MM-dd'));
    const [capturedAt, setCapturedAt] = useState<string>('12:00');
    const [description, setDescription] = useState('');
    const [uploaderName, setUploaderName] = useState('');
    const [windData, setWindData] = useState<{ avg: number, gust: number, direction: number } | null>(null);

    // Upload state
    const [isUploading, setIsUploading] = useState(false);
    const [uploadCode, setUploadCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Simple client-side check for "auth"
    const SHARED_CODE = "kallsjon2024";

    // Fetch wind data when date/time changes
    useEffect(() => {
        const fetchWindData = async () => {
            if (!detectedDate || !capturedAt) return;

            try {
                const [hours, minutes] = capturedAt.split(':').map(Number);
                const mediaDate = new Date(detectedDate);
                mediaDate.setHours(hours, minutes, 0, 0);

                // Search window: +/- 2 hours
                const startSearch = new Date(mediaDate.getTime() - 2 * 60 * 60 * 1000);
                const endSearch = new Date(mediaDate.getTime() + 2 * 60 * 60 * 1000);

                const windRef = collection(db, 'wind');
                const q = query(
                    windRef,
                    where('time', '>=', Timestamp.fromDate(startSearch)),
                    where('time', '<=', Timestamp.fromDate(endSearch)),
                    orderBy('time', 'asc')
                );

                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    let closestDoc: any = null;
                    let minDiff = Infinity;

                    snapshot.forEach(doc => {
                        const data = doc.data() as any;
                        const recordTime = data.time.toDate().getTime();
                        const diff = Math.abs(recordTime - mediaDate.getTime());

                        if (diff < minDiff) {
                            minDiff = diff;
                            closestDoc = data;
                        }
                    });

                    if (closestDoc) {
                        setWindData({
                            avg: closestDoc.force || 0,
                            gust: closestDoc.forceMax || closestDoc.force || 0,
                            direction: closestDoc.direction || 0
                        });
                    } else {
                        setWindData(null);
                    }
                } else {
                    setWindData(null);
                }
            } catch (err) {
                console.warn('Could not fetch wind data:', err);
                setWindData(null);
            }
        };

        fetchWindData();
    }, [detectedDate, capturedAt]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setPreviewUrl(URL.createObjectURL(selectedFile));
        setError(null);
        setSuccess(false);
        setUploadProgress(0);

        // Reset metadata
        setDescription('');
        setUploaderName('');
        setUploadCode('');

        // Try to read EXIF data
        try {
            const tags = await ExifReader.load(selectedFile);
            const dateTag = tags['DateTimeOriginal'] || tags['DateTimeDigitized'] || tags['DateTime'];

            if (dateTag && dateTag.description) {
                const [datePart, timePart] = dateTag.description.split(' ');
                const isoDate = datePart.replace(/:/g, '-');

                if (isValid(parseISO(isoDate))) {
                    setDetectedDate(isoDate);
                    if (timePart) {
                        const [hours, minutes] = timePart.split(':');
                        setCapturedAt(`${hours}:${minutes}`);
                    }
                    return; // Successfully found EXIF date
                }
            }
            throw new Error("No valid EXIF date found");
        } catch (err) {
            console.log('Could not read EXIF data, using lastModified', err);
            // Fallback to file.lastModified
            const lastMod = new Date(selectedFile.lastModified);
            if (isValid(lastMod)) {
                setDetectedDate(format(lastMod, 'yyyy-MM-dd'));
                setCapturedAt(format(lastMod, 'HH:mm'));
            }
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        if (uploadCode !== SHARED_CODE) {
            setError('Fel kod. Kontakta admin för uppladdningskod.');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            // Force a fresh session
            if (auth.currentUser) {
                await signOut(auth);
            }
            await signInAnonymously(auth);

            // 1. Upload file to Storage
            const storagePath = `daily_uploads/${detectedDate}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, file);

            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress(progress);
                    },
                    (error) => {
                        console.error('Upload failed:', error);
                        reject(error);
                    },
                    () => resolve()
                );
            });

            const downloadURL = await getDownloadURL(storageRef);

            // 2. Save metadata to Firestore
            await addDoc(collection(db, 'media_items'), {
                date: detectedDate,
                url: downloadURL,
                type: file.type.startsWith('video/') ? 'video' : 'image',
                storagePath,
                createdAt: serverTimestamp(),
                capturedAt: capturedAt,
                windData: windData,
                description: description,
                uploaderName: uploaderName,
                originalName: file.name,
                uploadedBy: 'guest_with_code'
            });

            setSuccess(true);
            setFile(null);
            setPreviewUrl(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (onUploadComplete) onUploadComplete();

            setTimeout(() => setSuccess(false), 3000);

        } catch (err: any) {
            console.error('Upload failed:', err);
            if (err.code === 'storage/unauthenticated') {
                setError('Åtkomst nekad. Kontrollera att "Storage Rules" i Firebase tillåter skrivning.');
            } else {
                setError('Uppladdning misslyckades. Försök igen.');
            }
        } finally {
            setIsUploading(false);
        }
    };

    const clearSelection = () => {
        setFile(null);
        setPreviewUrl(null);
        setError(null);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="bg-app-surface p-6 rounded-2xl border border-app-border/50 backdrop-blur-sm">
            <h3 className="text-lg font-bold text-app-text mb-6 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-app-muted" />
                Ladda upp bild/film
            </h3>

            {!file ? (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-app-border/50 rounded-xl p-10 text-center cursor-pointer hover:border-app-accent/50 hover:bg-app-surface-elevated/30 transition-all group"
                >
                    <div className="bg-app-surface/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-app-muted" />
                    </div>
                    <p className="text-app-text font-medium">Klicka för att välja fil</p>
                    <p className="text-app-subtle/60 text-xs mt-1">Bilder och videoklipp</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Preview Section */}
                    <div className="relative rounded-xl overflow-hidden bg-black/40 border border-app-border/50">
                        {file.type.startsWith('video/') ? (
                            <video src={previewUrl!} className="max-h-80 w-full object-contain" controls />
                        ) : (
                            <img src={previewUrl!} alt="Preview" className="max-h-80 w-full object-contain" />
                        )}
                        <button
                            onClick={clearSelection}
                            className="absolute top-3 right-3 p-2 bg-black/60 rounded-full hover:bg-red-500/80 text-white transition-colors backdrop-blur-md"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Wind Overlay */}
                        {windData && (
                            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10 flex items-center gap-3">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-app-muted uppercase tracking-wider font-bold">Vind vid fototillfället</span>
                                    <div className="flex items-center gap-2 text-white font-bold">
                                        <Wind className="w-4 h-4 text-app-muted" />
                                        <span>{windData.avg.toFixed(1)}</span>
                                        <span className="text-yellow-400 text-xs">({windData.gust.toFixed(1)})</span>
                                        <span className="text-xs font-normal text-white/70">m/s</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Date & Time */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-app-muted uppercase tracking-wider flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                Datum & Tid
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={detectedDate}
                                    onChange={(e) => setDetectedDate(e.target.value)}
                                    className="flex-1 bg-app-bg/50 border border-app-border rounded-lg px-3 py-2 text-app-text focus:outline-none focus:border-app-accent transition-colors"
                                />
                                <input
                                    type="time"
                                    value={capturedAt}
                                    onChange={(e) => setCapturedAt(e.target.value)}
                                    className="w-24 bg-app-bg/50 border border-app-border rounded-lg px-3 py-2 text-app-text focus:outline-none focus:border-app-accent transition-colors"
                                />
                            </div>
                        </div>

                        {/* Uploader Name */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-app-muted uppercase tracking-wider flex items-center gap-2">
                                <User className="w-3 h-3" />
                                Ditt Namn
                            </label>
                            <input
                                type="text"
                                value={uploaderName}
                                onChange={(e) => setUploaderName(e.target.value)}
                                placeholder="Vem tog bilden?"
                                className="w-full bg-app-bg/50 border border-app-border rounded-lg px-3 py-2 text-app-text focus:outline-none focus:border-app-accent transition-colors placeholder:text-app-subtle"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-app-muted uppercase tracking-wider flex items-center gap-2">
                            <FileText className="w-3 h-3" />
                            Beskrivning
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Berätta lite om bilden... Hur var känslan?"
                            rows={3}
                            className="w-full bg-app-bg/50 border border-app-border rounded-lg px-3 py-2 text-app-text focus:outline-none focus:border-app-accent transition-colors placeholder:text-app-subtle resize-none"
                        />
                    </div>

                    {/* Code Input */}
                    <div className="space-y-2 pt-4 border-t border-app-border/50">
                        <label className="text-xs font-bold text-app-muted uppercase tracking-wider">Uppladdningskod</label>
                        <input
                            type="password"
                            value={uploadCode}
                            onChange={(e) => setUploadCode(e.target.value)}
                            placeholder="Ange kod för att ladda upp"
                            className="w-full bg-app-bg/50 border border-app-border rounded-lg px-3 py-2 text-app-text focus:outline-none focus:border-app-accent transition-colors placeholder:text-app-subtle"
                        />
                    </div>

                    {/* Progress Bar */}
                    {isUploading && (
                        <div className="w-full bg-app-bg rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-app-accent-green h-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                    )}

                    {error && (
                        <div className="text-red-300 text-sm bg-red-900/20 border border-red-800/50 p-3 rounded-lg">
                            <p className="font-bold mb-1">Fel vid uppladdning</p>
                            <p>{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="text-app-text text-sm bg-app-surface/20 border border-app-border/50 p-3 rounded-lg flex items-center gap-2">
                            <Check className="w-4 h-4" />
                            Uppladdning klar!
                        </div>
                    )}

                    <button
                        onClick={handleUpload}
                        disabled={isUploading || !uploadCode}
                        className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                  ${isUploading || !uploadCode
                                ? 'bg-app-surface/50 text-app-subtle/50 cursor-not-allowed'
                                : 'bg-app-accent-green hover:bg-app-accent-green/90 text-app-bg shadow-lg shadow-black/20 hover:scale-[1.02]'
                            }`}
                    >
                        {isUploading ? 'Laddar upp...' : (
                            <>
                                Bekräfta & Ladda upp <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};
