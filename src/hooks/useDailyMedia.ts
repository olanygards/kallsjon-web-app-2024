import { useCallback, useEffect, useState } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface DailyMediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  originalName: string;
  createdAt: Timestamp | null;
  storagePath: string;
  capturedAt?: string; // HH:mm
  description?: string;
  uploaderName?: string;
  windData?: {
    avg: number;
    gust: number;
    direction: number;
  };
}

/**
 * Media för en specifik dag (Firestore `media_items`).
 * Delas mellan dagvyns sammanfattning, grafmarkörer och galleri.
 */
export function useDailyMedia(date: string) {
  const [items, setItems] = useState<DailyMediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'media_items'), where('date', '==', date));
      const snapshot = await getDocs(q);

      const fetched: DailyMediaItem[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as DailyMediaItem);
      });

      // Kronologiskt efter tidpunkt på dagen (poster utan tid sist)
      fetched.sort((a, b) => (a.capturedAt ?? '99:99').localeCompare(b.capturedAt ?? '99:99'));
      setItems(fetched);
    } catch (error) {
      console.error('Error fetching daily media:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  return { items, loading, refetch: fetchMedia, removeItem };
}
