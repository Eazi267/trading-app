import { useRef } from 'react'
import { Upload, X } from 'lucide-react'

function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(file)
  })
}

// Multiple-image sibling of FileDropInput.jsx — same visual language
// (reuses its .file-drop-zone/.file-drop-preview CSS directly), but
// for evidence attachments where more than one screenshot might be
// needed (e.g. a transaction hash view plus a wallet balance view).
export default function ScreenshotUploader({ images, onChange, label }) {
  const inputRef = useRef(null)

  async function handleFiles(fileList) {
    const files = Array.from(fileList)
    if (files.length === 0) return
    const dataUrls = await Promise.all(files.map(readAsDataUrl))
    onChange([...images, ...dataUrls])
  }

  function removeAt(index) {
    onChange(images.filter((_, i) => i !== index))
  }

  return (
    <div>
      {label && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>}
      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {images.map((img, i) => (
            <div className="file-drop-preview" key={i}>
              <img src={img} alt={`Evidence ${i + 1}`} style={{ maxWidth: 130, maxHeight: 100 }} />
              <button type="button" className="file-drop-remove" onClick={() => removeAt(i)} aria-label="Remove screenshot">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div
        className="file-drop-zone"
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
      >
        <Upload size={15} />
        <span>{images.length > 0 ? 'Add another screenshot' : 'Add screenshot(s)'}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
        style={{ display: 'none' }}
      />
    </div>
  )
}
