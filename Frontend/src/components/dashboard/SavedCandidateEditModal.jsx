import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import toast from 'react-hot-toast';

const SavedCandidateEditModal = ({ open, onClose, initial, fastapiUrl, nodeApiUrl, onUpdated, onResumeUploaded }) => {
  const [form, setForm] = useState({ notes: '', contacted: false, review: '', email: '', linkedin: '' });
  const [noteInput, setNoteInput] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && initial) {
      setForm({
        notes: initial.notes || '',
        contacted: !!initial.contacted,
        review: typeof initial.review === 'number' ? String(initial.review) : '',
        email: initial.email || '',
        linkedin: initial.linkedin || '',
      });
      setUploadFile(null);
      setNoteInput('');
    }
  }, [open, initial]);

  // Lock background scroll while modal open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!initial?.job_id || !initial?.candidate_link) return;
    try {
      setSaving(true);
      const payload = {
        job_id: initial.job_id,
        candidate_link: initial.candidate_link,
        name: initial.name || undefined,
        notes: form.notes || undefined,
        contacted: !!form.contacted,
        review: form.review ? Math.max(1, Math.min(5, parseInt(form.review, 10))) : undefined,
        email: form.email || undefined,
        linkedin: form.linkedin || undefined,
      };
      const res = await fetch(`${fastapiUrl}/saved-candidates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success('Saved candidate updated');
      onUpdated?.();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update candidate');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Pick a file to upload');
      return;
    }
    try {
      setUploading(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('job_id', initial.job_id);
      formData.append('candidate_link', initial.candidate_link);
      const res = await fetch(`${nodeApiUrl}/api/saved-candidates/resume`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      toast.success('Resume uploaded');
      onResumeUploaded?.();
      setUploadFile(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to upload resume');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4">
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Edit Saved Candidate</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Notes (bullet points)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                  placeholder="Add a note and press Add"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (noteInput.trim()) {
                        const current = String(form.notes || '')
                          .split(/\r?\n|•/)
                          .map(s => s.trim())
                          .filter(Boolean);
                        const next = [...current, noteInput.trim()].slice(0, 20);
                        setForm({ ...form, notes: next.join('\n') });
                        setNoteInput('');
                      }
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (!noteInput.trim()) return;
                    const current = String(form.notes || '')
                      .split(/\r?\n|•/)
                      .map(s => s.trim())
                      .filter(Boolean);
                    const next = [...current, noteInput.trim()].slice(0, 20);
                    setForm({ ...form, notes: next.join('\n') });
                    setNoteInput('');
                  }}
                  variant="secondary"
                >
                  Add
                </Button>
              </div>
              <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-gray-300">
                {String(form.notes || '')
                  .split(/\r?\n|•/)
                  .map(s => s.trim())
                  .filter(Boolean)
                  .map((note, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="flex-1 break-words">{note}</span>
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:text-red-300"
                        onClick={() => {
                          const remaining = String(form.notes || '')
                            .split(/\r?\n|•/)
                            .map(s => s.trim())
                            .filter(Boolean)
                            .filter((_, i) => i !== idx);
                          setForm({ ...form, notes: remaining.join('\n') });
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="flex items-center justify-between gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.contacted}
                  onChange={(e) => setForm({ ...form, contacted: e.target.checked })}
                />
                Contacted
              </label>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Review (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  className="w-24 bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                  value={form.review}
                  onChange={(e) => setForm({ ...form, review: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">LinkedIn</label>
                <input
                  type="url"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                  value={form.linkedin}
                  onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Attach Resume (PDF/DOCX)</label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                />
                <Button onClick={handleUpload} disabled={uploading} loading={uploading}>
                  Upload
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} loading={saving}>Save</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SavedCandidateEditModal;
