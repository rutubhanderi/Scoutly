import React, { useEffect } from 'react';
import { Card, CardContent } from '../ui/Card';
import { ExternalLink, Github, Info } from 'lucide-react';

const label = (text) => (
  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{text}</span>
);

const CandidateDetailModal = ({ open, onClose, candidate }) => {
  if (!open) return null;

  // Lock background scroll
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  const isGitHub = candidate?.source === 'GitHub' || /github\.com/i.test(candidate?.link || '');
  const projects = candidate?.projects || candidate?.repos || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4">
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">{candidate?.name || 'Candidate'}</h3>
                {candidate?.title && (
                  <p className="text-sm text-gray-400 mt-0.5">{candidate.title}</p>
                )}
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  {label('Match Score')}
                  <p className="mt-1 text-white font-semibold">{candidate?.match_score != null ? `${candidate.match_score}%` : '—'}</p>
                </div>
                <div>
                  {label('Profile Link')}
                  <div className="mt-1">
                    <a
                      href={candidate?.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="line-clamp-1 max-w-[20rem]">{candidate?.link || '—'}</span>
                    </a>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  {label('Source')}
                  <p className="mt-1 text-gray-300">{candidate?.source || (isGitHub ? 'GitHub' : '—')}</p>
                </div>
                {candidate?.location && (
                  <div>
                    {label('Location')}
                    <p className="mt-1 text-gray-300">{candidate.location}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              {label('Why this candidate matches')}
              <div className="mt-2 p-3.5 bg-gray-800/50 rounded-lg border border-gray-700/80">
                <p className="text-sm text-gray-300 whitespace-pre-line">
                  {candidate?.reasoning || 'No reasoning available for this candidate.'}
                </p>
              </div>
              {!candidate?.reasoning && (
                <p className="mt-2 text-xs text-gray-500 inline-flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  Reasoning will appear for searches where the backend provides it.
                </p>
              )}
            </div>

            {isGitHub && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Github className="w-4 h-4 text-gray-300" />
                  {label('GitHub projects')}
                </div>
                {Array.isArray(projects) && projects.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
                    {projects.slice(0, 8).map((p, i) => (
                      <li key={i} className="break-words">{typeof p === 'string' ? p : (p?.name || JSON.stringify(p))}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">No projects were provided for this profile.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CandidateDetailModal;


