import { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function SignaturePad({ onConfirm, onCancel }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null);

  const handleClear = () => {
    sigRef.current?.clear();
  };

  const handleConfirm = () => {
    if (sigRef.current?.isEmpty()) return;
    const dataUrl = sigRef.current?.toDataURL('image/png') ?? '';
    onConfirm(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <button onClick={onCancel} className="text-gray-600 font-medium text-sm">
          Cancel
        </button>
        <h2 className="text-base font-semibold text-gray-900">Client Signature</h2>
        <div className="w-12" />
      </div>

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
    </div>
  );
}
