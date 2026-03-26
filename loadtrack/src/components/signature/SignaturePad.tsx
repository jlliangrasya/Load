import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
  clientName?: string;
  amount?: string;
}

type Tab = 'signature' | 'text';

export default function SignaturePad({ onConfirm, onCancel, clientName, amount }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [activeTab, setActiveTab] = useState<Tab>('signature');
  const [typedName, setTypedName] = useState('');

  const handleClear = () => {
    sigRef.current?.clear();
  };

  const handleConfirm = () => {
    if (sigRef.current?.isEmpty()) return;

    const canvas = sigRef.current?.getCanvas();
    if (!canvas) return;

    const maxWidth = 400;
    const scale = canvas.width > maxWidth ? maxWidth / canvas.width : 1;
    const newWidth = Math.round(canvas.width * scale);
    const newHeight = Math.round(canvas.height * scale);

    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = newWidth;
    smallCanvas.height = newHeight;

    const ctx = smallCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, newWidth, newHeight);
    ctx.drawImage(canvas, 0, 0, newWidth, newHeight);

    const compressedDataUrl = smallCanvas.toDataURL('image/jpeg', 0.5);
    onConfirm(compressedDataUrl);
  };

  const isTextConfirmValid = (): boolean => {
    if (!typedName.trim()) return false;
    if (!clientName) return true;
    const firstWord = clientName.trim().split(/\s+/)[0].toLowerCase();
    return typedName.trim().toLowerCase().startsWith(firstWord);
  };

  const handleTextConfirm = () => {
    if (!isTextConfirmValid()) return;
    const timestamp = new Date().toISOString();
    onConfirm(`text-confirm::${typedName.trim()}::${timestamp}`);
  };

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <button onClick={onCancel} className="text-gray-600 font-medium text-sm">
          Cancel
        </button>
        <h2 className="text-base font-semibold text-gray-900">Client Signature</h2>
        <div className="w-12" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('signature')}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
            activeTab === 'signature'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500'
          }`}
        >
          Signature
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
            activeTab === 'text'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500'
          }`}
        >
          Text Confirm
        </button>
      </div>

      {activeTab === 'signature' ? (
        <>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <p className="text-sm text-gray-500 mb-4">Please have the client sign below</p>
            <div className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex-1 max-h-[60vh]">
              <SignatureCanvas
                ref={sigRef}
                penColor="black"
                canvasProps={{
                  className: 'w-full h-full rounded-xl',
                }}
              />
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={handleClear}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm"
            >
              Clear
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm active:bg-blue-700"
            >
              Confirm & Save
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-700 leading-relaxed">
                I, <span className="font-semibold">{clientName || '[client name]'}</span>, confirm
                receipt of payment of{' '}
                <span className="font-semibold">{amount || '[amount]'}</span> on{' '}
                <span className="font-semibold">{todayFormatted}</span>.
              </p>
            </div>

            <label className="text-sm text-gray-600 mb-2 font-medium">
              Type your full name to confirm
            </label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={clientName || 'Full name'}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {typedName.trim() && !isTextConfirmValid() && (
              <p className="text-xs text-red-500 mt-2">
                Name must start with "{clientName?.trim().split(/\s+/)[0]}"
              </p>
            )}
          </div>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleTextConfirm}
              disabled={!isTextConfirmValid()}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                isTextConfirmValid()
                  ? 'bg-blue-600 text-white active:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Confirm
            </button>
          </div>
        </>
      )}
    </div>
  );
}
