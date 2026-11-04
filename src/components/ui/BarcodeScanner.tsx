// Barcode search (SPEC §12): the browser's BarcodeDetector, with ZXing as a lazy fallback.
// Loaded only when the user taps the barcode button; the camera stream never leaves the device.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

type Status = 'starting' | 'scanning' | 'denied' | 'unsupported';

export default function BarcodeScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [manual, setManual] = useState('');
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let stopZxing: (() => void) | null = null;

    const done = (code: string) => {
      if (stopped) return;
      stopped = true;
      onDetectedRef.current(code);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setStatus('unsupported');
      try {
        if (window.BarcodeDetector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          const v = video.current!;
          v.srcObject = stream;
          await v.play();
          setStatus('scanning');
          const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'code_128'] });
          const tick = async () => {
            if (stopped) return;
            const found = await detector.detect(v).catch(() => []);
            if (found[0]) return done(found[0].rawValue);
            setTimeout(tick, 250);
          };
          void tick();
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          setStatus('scanning');
          const controls = await reader.decodeFromVideoDevice(undefined, video.current!, (result) => {
            if (result) done(result.getText());
          });
          stopZxing = () => controls.stop();
        }
      } catch {
        setStatus('denied');
      }
    })();

    return () => {
      stopped = true;
      stream?.getTracks().forEach((tr) => tr.stop());
      stopZxing?.();
    };
  }, []);

  const submitManual = (e: FormEvent) => {
    e.preventDefault();
    if (manual.trim()) onDetected(manual.trim());
  };

  return (
    <Dialog open onClose={onClose} title={t('barcode.title')}>
      <div className="space-y-4">
        <video ref={video} muted playsInline aria-label={t('barcode.camera')} className="aspect-video w-full rounded-card bg-ink" />
        <p role="status" className="text-meta text-ink-muted">
          {t(`barcode.${status}`)}
        </p>
        <form onSubmit={submitManual} className="flex gap-2">
          <label className="sr-only" htmlFor="barcode-manual">
            {t('barcode.manual')}
          </label>
          <input
            id="barcode-manual"
            inputMode="numeric"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder={t('barcode.manual')}
            className="min-h-11 flex-1 rounded-control border border-border px-3"
          />
          <Button type="submit" variant="secondary">
            {t('search.submit')}
          </Button>
        </form>
      </div>
    </Dialog>
  );
}
