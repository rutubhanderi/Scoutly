import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import { Trash2, Pencil, X } from 'lucide-react';
import SavedCandidateEditModal from './SavedCandidateEditModal';

const SavedCandidatesList = ({ fastapiUrl, nodeApiUrl }) => {
  const [groups, setGroups] = useState({});
  const [jobs, setJobs] = useState([]);
  const [jobIdByTitle, setJobIdByTitle] = useState({});
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedJobTitle, setSelectedJobTitle] = useState(null);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [hiringInProgress, setHiringInProgress] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${fastapiUrl}/saved-candidates/grouped`);
      const data = await res.json();
      setGroups(data.groups || {});
      
      const jobsRes = await fetch(`${fastapiUrl}/sourcing-jobs`);
      const jobsData = await jobsRes.json();
      setJobs(jobsData.jobs || []);
      
      const map = {};
      (jobsData.jobs || []).forEach(j => {
        const title = (j?.structured_jd && j.structured_jd.job_title) || 'Untitled Job';
        if (j?.job_id) map[title] = j.job_id;
      });
      setJobIdByTitle(map);
    } catch (e) {
      console.error(e);
      setGroups({});
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [fastapiUrl]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    const handler = () => { setSelectedJobTitle(null); setJobModalOpen(false); };
    window.addEventListener('nav:saved', handler);
    return () => window.removeEventListener('nav:saved', handler);
  }, []);

  // Lock background scroll when job modal is open
  useEffect(() => {
    if (!jobModalOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [jobModalOpen]);

  const handleDelete = async (jobId, candidateLink) => {
    try {
      const url = `${fastapiUrl}/saved-candidates?job_id=${encodeURIComponent(jobId)}&candidate_link=${encodeURIComponent(candidateLink)}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Removed from saved');
      loadGroups();
    } catch (e) {
      console.error(e);
      toast.error('Failed to remove');
    }
  };

  const openEdit = (item) => {
    setSelected(item);
    setModalOpen(true);
  };

  const markCandidateHired = async (jobId, candidate) => {
    if (hiringInProgress) return;
    setHiringInProgress(true);
    try {
      await fetch(`${fastapiUrl}/sourcing-jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hired' })
      });
      
      await fetch(`${fastapiUrl}/saved-candidates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          candidate_link: candidate.candidate_link,
          name: candidate.name,
          email: candidate.email,
          linkedin: candidate.linkedin,
          notes: candidate.notes,
          contacted: candidate.contacted,
          review: candidate.review,
          rank: candidate.rank,
          match_score: candidate.match_score,
          reasoning: candidate.reasoning,
          hired: true
        })
      });
      
      toast.success(`${candidate.name || 'Candidate'} marked as hired!`);
      // Optimistic UI update: set job status and hired flag locally
      setJobs(prev => prev.map(j => j.job_id === jobId ? { ...j, status: 'hired' } : j));
      setGroups(prev => {
        const titleKey = selectedJobTitle || Object.keys(prev).find(t => (prev[t] || []).some(x => x.job_id === jobId));
        if (!titleKey) return prev;
        const updated = (prev[titleKey] || []).map(x => x.candidate_link === candidate.candidate_link ? { ...x, hired: true } : x);
        return { ...prev, [titleKey]: updated };
      });
      await loadGroups();
    } catch (e) {
      console.error(e);
      toast.error('Failed to mark as hired');
    } finally {
      setHiringInProgress(false);
    }
  };

  const updateRank = async (jobId, candidate_link, newRank) => {
    try {
      await fetch(`${fastapiUrl}/saved-candidates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, candidate_link, rank: newRank })
      });
      await loadGroups();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update rank');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl md:text-3xl">Jobs</CardTitle>
              <p className="text-sm text-gray-400 mt-1">Manage your job postings and candidates</p>
            </div>
            <div className="text-sm text-gray-400">
              {Object.keys(groups).length} job{Object.keys(groups).length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading jobs...</div>
          ) : Object.keys(groups).length === 0 ? (
            <div className="text-center py-12 text-gray-400">No jobs yet.</div>
          ) : (false && selectedJobTitle) ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">{selectedJobTitle}</h3>
                  {(() => {
                    const items = (groups[selectedJobTitle] || []);
                    const jobId = items[0]?.job_id || jobIdByTitle[selectedJobTitle];
                    const job = jobs.find(j => j.job_id === jobId);
                    const isHired = job?.status === 'hired';
                    const hiredCandidate = items.find(c => c.hired);
                    return (
                      <div className="mt-2 flex items-center gap-3 text-sm text-gray-400">
                        <span className={`px-3 py-1 rounded-full border font-medium ${isHired ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50' : 'bg-gray-700/40 text-gray-300 border-gray-600/60'}`}>
                          {isHired ? '✓ Hired' : 'Active'}
                        </span>
                        {hiredCandidate && (
                          <span className="text-emerald-300">Hired: <strong>{hiredCandidate.name || 'Candidate'}</strong></span>
                        )}
                        <span>{items.length} candidate{items.length !== 1 ? 's' : ''}</span>
                      </div>
                    );
                  })()}
                </div>
                <Button variant="ghost" onClick={() => setSelectedJobTitle(null)}>← Back to Jobs</Button>
              </div>

              {(() => {
                const items = (groups[selectedJobTitle] || []);
                const jobId = items[0]?.job_id || jobIdByTitle[selectedJobTitle];
                const job = jobs.find(j => j.job_id === jobId);
                const isHired = job?.status === 'hired';
                
                // Sort by rank
                const sorted = items.slice().sort((a, b) => {
                  const rankA = typeof a.rank === 'number' ? a.rank : 999999;
                  const rankB = typeof b.rank === 'number' ? b.rank : 999999;
                  return rankA - rankB;
                });
                
                return (
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {sorted.map((candidate, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl border p-5 transition-all relative ${
                          candidate.hired
                            ? 'bg-emerald-900/20 border-emerald-600/60 shadow-lg shadow-emerald-500/10'
                            : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                        }`}
                      >
                        {candidate.hired && (
                          <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 rounded-md text-xs font-bold">
                            ✓ HIRED
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-semibold text-white truncate">
                              {candidate.name || 'Candidate'}
                            </h4>
                            {candidate.match_score && (
                              <div className="mt-1 text-xs text-blue-300">
                                {candidate.match_score}% match
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {candidate.hired && (
                              <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 font-medium">
                                ✓ Hired
                              </span>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => openEdit(candidate)} title="Edit">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(candidate.job_id, candidate.candidate_link)} title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {candidate.notes && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-400 mb-1">Notes:</p>
                            <ul className="list-disc list-inside text-sm text-gray-300 space-y-0.5">
                              {String(candidate.notes)
                                .split(/\r?\n|•/)
                                .map(s => s.trim())
                                .filter(Boolean)
                                .slice(0, 3)
                                .map((note, i) => (
                                  <li key={i} className="line-clamp-1">{note}</li>
                                ))}
                            </ul>
                          </div>
                        )}

                        {(candidate.email || candidate.linkedin) && (
                          <div className="mb-3 text-xs text-gray-400 space-y-1">
                            {candidate.email && (
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Email:</span>
                                <span className="text-blue-300 truncate">{candidate.email}</span>
                              </div>
                            )}
                            {candidate.linkedin && (
                              <div className="flex items-center gap-1">
                                <span className="font-medium">LinkedIn:</span>
                                <a
                                  href={candidate.linkedin}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-300 hover:text-blue-200 truncate"
                                >
                                  View Profile
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {candidate.contacted ? 'Contacted' : 'Not contacted'}
                            </span>
                            {jobId && typeof candidate.rank === 'number' && (
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); updateRank(jobId, candidate.candidate_link, Math.max(0, candidate.rank - 1)); }}>↑</Button>
                                <span className="text-xs text-gray-400">#{candidate.rank + 1}</span>
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); updateRank(jobId, candidate.candidate_link, candidate.rank + 1); }}>↓</Button>
                              </div>
                            )}
                          </div>
                          {!candidate.hired && !isHired && jobId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={hiringInProgress}
                              disabled={hiringInProgress}
                              onClick={(e) => { e.stopPropagation(); markCandidateHired(jobId, candidate); }}
                            >
                              Mark as Hired
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(groups).map(([title, items]) => {
                const jobId = items[0]?.job_id || jobIdByTitle[title];
                const job = jobs.find(j => j.job_id === jobId);
                const isHired = job?.status === 'hired';
                const hiredCandidate = items.find(i => i.hired);
                const avatars = items.slice(0, 4);
                return (
                  <div
                    key={title}
                    className={`relative p-6 rounded-xl border transition-all cursor-pointer hover:shadow-lg ${
                      isHired
                        ? 'border-emerald-600/60 bg-emerald-900/20 shadow-emerald-500/10'
                        : 'border-gray-800 bg-gray-900/40 hover:border-gray-700'
                    }`}
                    onClick={() => { setSelectedJobTitle(title); setJobModalOpen(true); }}
                  >
                    {isHired && (
                      <span className="absolute top-3 right-3 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50">Hired</span>
                    )}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-white truncate mb-2">{title}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                            isHired
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                              : 'bg-gray-700/40 text-gray-300 border-gray-600/60'
                          }`}>
                            {isHired ? '✓ Hired' : 'Active'}
                          </span>
                          <span className="text-xs text-gray-400">{items.length} candidate{items.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>

                    {hiredCandidate && (
                      <div className="mb-4 p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/40 shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm font-semibold text-emerald-300">
                            ✓ Hired Candidate
                          </p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50">
                            Selected
                          </span>
                        </div>
                        <p className="text-base font-bold text-white mb-1">{hiredCandidate.name || 'Candidate'}</p>
                        {hiredCandidate.email && (
                          <p className="text-xs text-emerald-400/90">{hiredCandidate.email}</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {avatars.map((c, i) => (
                          <div
                            key={i}
                            className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-gray-900 flex items-center justify-center text-white text-xs font-semibold"
                            title={c.name || 'Candidate'}
                          >
                            {(c.name || 'C').split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase()}
                          </div>
                        ))}
                        {items.length > avatars.length && (
                          <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-gray-300 text-xs font-semibold">
                            +{items.length - avatars.length}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {job?.updated_at ? `Updated ${new Date(job.updated_at).toLocaleDateString()}` : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedJobTitle && jobModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-6xl max-h-[85vh] overflow-y-auto bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-900 rounded-t-2xl">
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedJobTitle}</h3>
                {(() => {
                  const items = (groups[selectedJobTitle] || []);
                  const jobId = items[0]?.job_id || jobIdByTitle[selectedJobTitle];
                  const job = jobs.find(j => j.job_id === jobId);
                  const isHired = job?.status === 'hired';
                  const hiredCandidate = items.find(c => c.hired);
                  return (
                    <div className="mt-2 flex items-center gap-3 text-sm text-gray-400">
                      <span className={`px-3 py-1 rounded-full border font-medium ${isHired ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50' : 'bg-gray-700/40 text-gray-300 border-gray-600/60'}`}>
                        {isHired ? '✓ Hired' : 'Active'}
                      </span>
                      {hiredCandidate && (
                        <span className="text-emerald-300">Hired: <strong>{hiredCandidate.name || 'Candidate'}</strong></span>
                      )}
                      <span>{items.length} candidate{items.length !== 1 ? 's' : ''}</span>
                    </div>
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={() => { setJobModalOpen(false); setSelectedJobTitle(null); }}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                aria-label="Close"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {(() => {
                const items = (groups[selectedJobTitle] || []);
                const jobId = items[0]?.job_id || jobIdByTitle[selectedJobTitle];
                const job = jobs.find(j => j.job_id === jobId);
                const isHired = job?.status === 'hired';
                const sorted = items.slice().sort((a, b) => {
                  const rankA = typeof a.rank === 'number' ? a.rank : 999999;
                  const rankB = typeof b.rank === 'number' ? b.rank : 999999;
                  return rankA - rankB;
                });
                return (
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {sorted.map((candidate, idx) => (
                      <div
                        key={idx}
                        draggable={!candidate.hired && !isHired}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(candidate.rank));
                          e.dataTransfer.setData('candidate_link', candidate.candidate_link);
                        }}
                        onDragOver={(e) => { if (!candidate.hired && !isHired) e.preventDefault(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromRank = parseInt(e.dataTransfer.getData('text/plain'), 10);
                          const toRank = candidate.rank;
                          if (Number.isInteger(fromRank) && Number.isInteger(toRank) && fromRank !== toRank && jobId) {
                            const draggedLink = e.dataTransfer.getData('candidate_link');
                            updateRank(jobId, draggedLink, toRank);
                          }
                        }}
                        className={`rounded-xl border p-5 transition-all relative ${
                          candidate.hired
                            ? 'bg-emerald-900/20 border-emerald-600/60 shadow-lg shadow-emerald-500/10'
                            : 'bg-gray-900/50 border-gray-800 hover:border-gray-700 cursor-move'
                        }`}
                      >
                        {candidate.hired && (
                          <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 rounded-md text-xs font-bold">
                            ✓ HIRED
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-semibold text-white truncate">
                              {candidate.name || 'Candidate'}
                            </h4>
                            {candidate.match_score && (
                              <div className="mt-1 text-xs text-blue-300">
                                {candidate.match_score}% match
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {candidate.hired && (
                              <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 font-medium">
                                ✓ Hired
                              </span>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => openEdit(candidate)} title="Edit">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(candidate.job_id, candidate.candidate_link)} title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {candidate.notes && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-400 mb-1">Notes:</p>
                            <ul className="list-disc list-inside text-sm text-gray-300 space-y-0.5">
                              {String(candidate.notes)
                                .split(/\r?\n|•/)
                                .map(s => s.trim())
                                .filter(Boolean)
                                .slice(0, 3)
                                .map((note, i) => (
                                  <li key={i} className="line-clamp-1">{note}</li>
                                ))}
                            </ul>
                          </div>
                        )}

                        {(candidate.email || candidate.linkedin) && (
                          <div className="mb-3 text-xs text-gray-400 space-y-1">
                            {candidate.email && (
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Email:</span>
                                <span className="text-blue-300 truncate">{candidate.email}</span>
                              </div>
                            )}
                            {candidate.linkedin && (
                              <div className="flex items-center gap-1">
                                <span className="font-medium">LinkedIn:</span>
                                <a
                                  href={candidate.linkedin}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-300 hover:text-blue-200 truncate"
                                >
                                  View Profile
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {candidate.contacted ? 'Contacted' : 'Not contacted'}
                            </span>
                            {jobId && typeof candidate.rank === 'number' && (
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); updateRank(jobId, candidate.candidate_link, Math.max(0, candidate.rank - 1)); }}>↑</Button>
                                <span className="text-xs text-gray-400">#{candidate.rank + 1}</span>
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); updateRank(jobId, candidate.candidate_link, candidate.rank + 1); }}>↓</Button>
                              </div>
                            )}
                          </div>
                          {!candidate.hired && !isHired && jobId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={hiringInProgress}
                              disabled={hiringInProgress}
                              onClick={(e) => { e.stopPropagation(); markCandidateHired(jobId, candidate); }}
                            >
                              Mark as Hired
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <SavedCandidateEditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={selected}
        fastapiUrl={fastapiUrl}
        nodeApiUrl={nodeApiUrl}
        onUpdated={loadGroups}
        onResumeUploaded={loadGroups}
      />
    </>
  );
};

export default SavedCandidatesList;
