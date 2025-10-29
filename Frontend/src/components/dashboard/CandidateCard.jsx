import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Bookmark, BookmarkCheck } from 'lucide-react';
import { FaLinkedin, FaGithub } from 'react-icons/fa';
import { cn } from '../../utils/cn';
import Button from '../ui/Button';
import CandidateDetailModal from './CandidateDetailModal';

const CandidateCard = ({ candidate, onSave, isSaved, index = 0 }) => {
  const isGitHub = candidate.source === 'GitHub';
  const isLinkedIn = candidate.source === 'LinkedIn';
  
  const getScoreColor = (score) => {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 60) return 'from-yellow-500 to-orange-500';
    return 'from-orange-500 to-red-500';
  };

  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ y: -3 }}
      className="group relative bg-gray-900/60 backdrop-blur-sm border border-gray-800/80 rounded-2xl p-7 md:p-8 hover:border-blue-500/50 transition-all duration-300 shadow-sm hover:shadow-md"
    >

      {/* Gradient Background Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex-1">
            <button
              type="button"
              className="text-left text-xl font-semibold text-white mb-1.5 line-clamp-1 hover:text-blue-300"
              onClick={() => setDetailOpen(true)}
              title="View details"
            >
              {candidate.name || 'N/A'}
            </button>
            {candidate.title && (
              <p className="text-[13px] text-gray-400 line-clamp-1">{candidate.title}</p>
            )}
          </div>

          {/* Score Badge */}
          <div
            className={cn(
              "relative px-3.5 py-1.5 rounded-full text-white font-semibold text-sm",
              "bg-gradient-to-r shadow",
              getScoreColor(candidate.match_score || 0)
            )}
            title="Match score"
          >
            {candidate.match_score || 0}%
            <div className="absolute inset-0 rounded-full bg-white/10 blur-[2px]" />
          </div>
        </div>

        {/* Source Badges */}
        <div className="flex items-center gap-2.5 mb-4">
          {isLinkedIn && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium rounded-full">
              <FaLinkedin className="w-3 h-3" /> LinkedIn
            </span>
          )}
          {isGitHub && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-700/50 border border-gray-600 text-gray-300 text-xs font-medium rounded-full">
              <FaGithub className="w-3 h-3" /> GitHub
            </span>
          )}
        </div>

        {/* Snippet */}
        <p className="text-[13px] leading-6 text-gray-300/90 mb-4 line-clamp-2">
          {candidate.snippet || 'N/A'}
        </p>

        {/* Reasoning */}
        {candidate.reasoning && (
          <div className="mb-5 p-3.5 bg-gray-800/50 rounded-lg border border-gray-700/80">
            <p className="text-[12px] text-gray-400 italic line-clamp-2">
              {candidate.reasoning}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3.5">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 py-2"
            onClick={() => window.open(candidate.link, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            View Profile
          </Button>

          <Button
            size="sm"
            variant={isSaved ? 'success' : 'ghost'}
            onClick={onSave}
            disabled={isSaved}
            className={cn("py-2", isSaved && "cursor-not-allowed")}
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="w-4 h-4 mr-1" />
                Saved
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4 mr-1" />
                Save
              </>
            )}
          </Button>
        </div>

        <CandidateDetailModal
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          candidate={candidate}
        />

      </div>
    </motion.div>
  );
};

export default CandidateCard;