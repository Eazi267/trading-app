import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'

// Styled replacement for a raw <input type="file">, which otherwise
// renders as the browser's own unstyled button — the one control on
// KycVerification/AdminBusinessSettings that didn't match the rest
// of the panel system. Click or drag a file; shows a thumbnail once
// one's picked, matching the pattern KycVerification already used
// for previews (image, not any-file, since every current use case is
// a document photo).
export default function FileDropInput({ label, accept = 'image/*', value, onFile, onClear }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  function pick(files) {
    const file = files?.[0]
    if (file) onFile(file)
  }

  return (
    <div>
      {label && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>}
      {value ? (
        <div className="file-drop-preview">
          <img src={value} alt={label || 'Uploaded document preview'} />
          <button type="button" className="file-drop-remove" onClick={onClear} aria-label="Remove file">
            <X size={13} />
          </button>
        </div>
      ) : (
        <div
          className={`file-drop-zone${dragOver ? ' is-dragover' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files) }}
        >
          <Upload size={16} />
          <span>Click or drag a file to upload</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => { pick(e.target.files); e.target.value = '' }}
        style={{ display: 'none' }}
      />
    </div>
  )
}
