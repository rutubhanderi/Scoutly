import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import CandidateCard from '../components/dashboard/CandidateCard';
import SavedCandidatesList from '../components/dashboard/SavedCandidatesList';
import Pagination from '../components/ui/Pagination';
import Button from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Upload, FileText, Search, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [activeSection, setActiveSection] = useState('search');
  const [activeTab, setActiveTab] = useState('new');
  
  // Search states
  const [jobDescription, setJobDescription] = useState('');
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [results, setResults] = useState(null);
  const [structuredJD, setStructuredJD] = useState(null);
  const [generatedPrompts, setGeneratedPrompts] = useState(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const [editablePrompts, setEditablePrompts] = useState({ linkedin: '', github: '' });
  const [currentJobId, setCurrentJobId] = useState(null);
  const [savedLinks, setSavedLinks] = useState(new Set());
  const { user } = useAuth();
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [searchHistory, setSearchHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const CANDIDATES_PER_PAGE = 6;
  const API_URL = 'http://localhost:5000';
  const FASTAPI_URL = 'http://127.0.0.1:8000';

  // Load search history
  const loadSearchHistory = async () => {
    try {
      const response = await fetch(`${FASTAPI_URL}/sourcing-jobs`);
      const data = await response.json();
      const jobs = (data.jobs || [])
        .filter((j) => j.status === 'completed' && (j.candidate_count || 0) > 0)
        .slice(0, 10);
      setSearchHistory(jobs);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const loadSavedForJob = async (jobId) => {
    if (!jobId) return;
    try {
      const res = await fetch(`${FASTAPI_URL}/saved-candidates?job_id=${encodeURIComponent(jobId)}`);
      const data = await res.json();
      const setLinks = new Set((data.items || []).map(i => i.candidate_link));
      setSavedLinks(setLinks);
    } catch (e) {
      console.error('Failed to load saved for job', e);
      setSavedLinks(new Set());
    }
  };

  useEffect(() => {
    loadSearchHistory();
  }, []);

  useEffect(() => {
    if (user) {
      setProfileForm({ name: user.name || '', email: user.email || '' });
    }
  }, [user]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    if (selectedFile) {
      setJobDescription('');
      setStructuredJD(null);
      setGeneratedPrompts(null);
      setShowPrompts(false);
    }
  };

  const processJD = async () => {
    if (!jobDescription && !file) {
      toast.error('Please provide a job description or upload a file');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Processing job description...');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();

      if (file) {
        formData.append('file', file);
      } else if (jobDescription) {
        formData.append('jd_text', jobDescription);
      }

      const response = await axios.post(`${API_URL}/api/process-jd`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setStructuredJD(response.data.structured_jd);
        setGeneratedPrompts({
          linkedin: response.data.linkedin_prompt,
          github: response.data.github_prompt
        });
        setEditablePrompts({
          linkedin: response.data.linkedin_prompt,
          github: response.data.github_prompt
        });
        setShowPrompts(true);
        toast.success('Job description processed successfully!');
      } else {
        throw new Error('Failed to process job description');
      }
    } catch (error) {
      console.error('Error processing JD:', error);
      toast.error(error.response?.data?.error || 'Failed to process job description');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleStartSearch = async () => {
    if (!editablePrompts.linkedin && !editablePrompts.github) {
      toast.error('Please provide at least one prompt (LinkedIn or GitHub)');
      return;
    }

    setIsLoading(true);
    setResults(null);
    setLoadingMessage('Creating sourcing job...');
    setShowPrompts(false);

    try {
      const response = await fetch(`${FASTAPI_URL}/sourcing-jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          linkedin_prompt: editablePrompts.linkedin,
          github_prompt: editablePrompts.github,
          structured_jd: structuredJD,
        }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.statusText}`);

      const jobData = await response.json();
      const { job_id } = jobData;

      if (job_id) {
        setCurrentJobId(job_id);
        loadSavedForJob(job_id);
        pollForResults(job_id);
        toast.success('Job created! Searching for candidates...');
      } else {
        throw new Error("Did not receive a job_id from the server.");
      }
    } catch (error) {
      console.error('Error creating sourcing job:', error);
      toast.error('Failed to create the sourcing job');
      setIsLoading(false);
    }
  };

  const pollForResults = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${FASTAPI_URL}/sourcing-jobs/${jobId}/results`);
        const data = await response.json();

        if (data.candidates && data.candidates.length > 0) {
          setResults(data);
        }

        if (data.status === 'completed') {
          clearInterval(interval);
          setIsLoading(false);
          setLoadingMessage('');
          setResults(data);
          toast.success(`Found ${data.candidate_count || 0} candidates!`);
          loadSearchHistory();
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setIsLoading(false);
          toast.error(data.detail || 'Job failed');
        } else {
          setLoadingMessage(`Found ${data.candidate_count || 0} candidates... Still searching...`);
        }
      } catch (error) {
        console.error('Polling error:', error);
        clearInterval(interval);
        setIsLoading(false);
        toast.error('Failed to fetch results');
      }
    }, 5000);
  };

  const handleSaveCandidate = async (jobId, candidate) => {
    try {
      await fetch(`${FASTAPI_URL}/saved-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          candidate_link: candidate.link,
          name: candidate.name,
          match_score: candidate.match_score,
          reasoning: candidate.reasoning,
        }),
      });
      setSavedLinks(prev => new Set([...prev, candidate.link]));
      toast.success('Candidate saved!');
    } catch (e) {
      console.error('Save failed', e);
      toast.error('Failed to save candidate');
    }
  };

  const loadPreviousSearch = async (index) => {
    if (!searchHistory[index]) return;
    
    setIsLoading(true);
    setResults(null);
    setLoadingMessage('Loading previous search results...');

    try {
      const jobId = searchHistory[index].job_id;
      const response = await fetch(`${FASTAPI_URL}/sourcing-jobs/${jobId}/results`);
      const data = await response.json();
      setResults(data);
      setCurrentJobId(jobId);
      loadSavedForJob(jobId);
      setCurrentPage(1);
      toast.success('Previous search loaded!');
    } catch (error) {
      console.error('Error loading previous search:', error);
      toast.error('Failed to load previous search results');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  useEffect(() => {
    if (activeTab === 'old' && searchHistory.length > 0) {
      loadPreviousSearch(historyIndex);
    }
  }, [historyIndex, activeTab]);

  // Pagination logic
  const paginatedCandidates = results?.candidates?.slice(
    (currentPage - 1) * CANDIDATES_PER_PAGE,
    currentPage * CANDIDATES_PER_PAGE
  ) || [];
  
  const totalPages = Math.ceil((results?.candidates?.length || 0) / CANDIDATES_PER_PAGE);

  // Derive structured JD from prompts when structured not present
  const deriveStructuredJD = (job) => {
    if (!job) return null;
    const lp = job.linkedin_prompt || '';
    const gp = job.github_prompt || '';
    const text = lp || gp;
    if (!text) return null;
    let job_title = text;
    const lower = text.toLowerCase();
    const cutWith = lower.indexOf(' with ');
    const cutIn = lower.indexOf(' in ');
    let cut = -1;
    if (cutWith !== -1 && cutIn !== -1) cut = Math.min(cutWith, cutIn);
    else cut = cutWith !== -1 ? cutWith : cutIn;
    if (cut !== -1) job_title = text.slice(0, cut).trim();
    let location = null;
    if (cutIn !== -1) location = text.slice(cutIn + 4).split(/[.,\n]/)[0].trim();
    let experience_required = null;
    const expMatch = text.match(/(\d+\+?\s*years?)/i) || text.match(/(\d+\+)/i) || text.match(/(\d+)/);
    if (expMatch) experience_required = expMatch[1];
    let skills_required = [];
    const withIdx = lower.indexOf(' with ');
    if (withIdx !== -1) {
      const after = text.slice(withIdx + 6).split(/[.\n]/)[0];
      const parts = after.split(/,| and |\s+/).map(s => s.trim()).filter(Boolean);
      const stop = new Set(['in','the','a','an','of','for','to','on','and','with','developer','engineer']);
      const uniq = [];
      parts.forEach(p => {
        const key = p.replace(/[^a-z0-9+#.]/gi, '');
        if (key && !stop.has(key.toLowerCase()) && !uniq.includes(key)) uniq.push(key);
      });
      skills_required = uniq.slice(0, 8);
    }
    return { job_title: job_title || null, company: null, location: location || null, experience_required, skills_required, job_type: null, salary_range: null };
  };

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Toaster position="top-right" toastOptions={{
        className: 'bg-gray-800 text-white',
        style: { background: '#1f2937', color: '#fff' }
      }} />
      
      <Sidebar 
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header darkMode={darkMode} setDarkMode={setDarkMode} onProfileClick={() => setActiveSection('settings')} />

        {/* Tabs for Search Section */}
        {activeSection === 'search' && (
          <div className="bg-gray-900/50 border-b border-gray-800">
            <div className="px-6 md:px-8">
              <div className="flex gap-3 md:gap-4">
                {['new', 'old'].map(tab => (
                  <motion.button
                    key={tab}
                    whileHover={{ y: -2 }}
                    onClick={() => {
                      setActiveTab(tab);
                      setCurrentPage(1);
                    }}
                    className={`px-6 md:px-8 py-3.5 text-sm md:text-[15px] font-semibold transition-all relative ${
                      activeTab === tab
                        ? 'text-blue-400'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {tab === 'new' ? 'New Search' : 'Search History'}
                    {activeTab === tab && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600"
                      />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-auto">
          <AnimatePresence mode="wait">
            {/* New Search Tab */}
            {activeSection === 'search' && activeTab === 'new' && (
              <motion.div
                key="new-search"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 md:space-y-10"
              >
                {/* JD Input */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-xl md:text-2xl">
                      <Sparkles className="w-6 h-6 md:w-7 md:h-7 text-blue-500" />
                      Start New Search
                    </CardTitle>
                    <CardDescription>
                      Paste a job description or upload a file to begin
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col lg:flex-row gap-8 md:gap-10">
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Job Description
                        </label>
                        <textarea
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 md:p-5 text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                          placeholder="Paste a Job Description here..."
                          value={jobDescription}
                          onChange={(e) => setJobDescription(e.target.value)}
                          disabled={!!file}
                          rows={8}
                        />
                      </div>
                      
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col items-center gap-3 p-6 md:p-7 border-2 border-dashed border-gray-700 rounded-xl bg-gray-800/50 hover:border-blue-500/50 transition-colors">
                          <span className="text-sm font-semibold text-gray-400">or</span>
                          <label htmlFor="file-upload" className="cursor-pointer">
                            <div className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                              <Upload className="w-5 h-5 text-gray-300" />
                              <span className="text-gray-300 font-medium">Upload File</span>
                            </div>
                          </label>
                          <input
                            id="file-upload"
                            type="file"
                            accept=".txt,.md,.pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={handleFileChange}
                          />
                          {file && (
                            <div className="text-center">
                              <p className="text-sm font-medium text-gray-300">{file.name}</p>
                              <button
                                onClick={() => setFile(null)}
                                className="text-xs text-red-400 hover:text-red-300 mt-1"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <Button
                        onClick={processJD}
                        disabled={(!jobDescription && !file) || isLoading}
                        loading={isLoading}
                        size="lg"
                      >
                        <FileText className="w-5 h-5 mr-2" />
                        Process Job Description
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Structured JD Display */}
                {structuredJD && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl md:text-2xl">Job Details Extracted</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                        {Object.entries(structuredJD).map(([key, value]) => {
                          if (!value || (Array.isArray(value) && value.length === 0)) return null;
                          return (
                            <div key={key} className="p-4 md:p-5 bg-gray-800/50 rounded-xl border border-gray-700/80">
                              <p className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">
                                {key.replace(/_/g, ' ')}
                              </p>
                              {Array.isArray(value) ? (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {value.slice(0, 6).map((item, idx) => (
                                    <span key={idx} className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[13px] rounded-full">
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-white font-semibold">{value}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Prompts Section */}
                {showPrompts && generatedPrompts && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl md:text-2xl">Review & Edit Search Prompts</CardTitle>
                      <CardDescription>Customize the search queries before starting</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                            LinkedIn Search Prompt
                          </label>
                          <textarea
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={editablePrompts.linkedin}
                            onChange={(e) => setEditablePrompts({ ...editablePrompts, linkedin: e.target.value })}
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                            GitHub Search Prompt
                          </label>
                          <textarea
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={editablePrompts.github}
                            onChange={(e) => setEditablePrompts({ ...editablePrompts, github: e.target.value })}
                            rows={3}
                          />
                        </div>
                      </div>

                      <div className="mt-6 flex gap-4">
                        <Button
                          onClick={handleStartSearch}
                          disabled={isLoading}
                          loading={isLoading}
                          variant="success"
                          size="lg"
                        >
                          <Search className="w-5 h-5 mr-2" />
                          Start Search
                        </Button>
                        <Button
                          onClick={() => setShowPrompts(false)}
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Loading State */}
                {isLoading && (
                  <Card>
                    <CardContent className="py-12 md:py-16">
                      <LoadingSpinner message={loadingMessage} />
                    </CardContent>
                  </Card>
                )}

                {/* Results */}
                {!isLoading && results && results.candidates && results.candidates.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl md:text-2xl">Search Results</CardTitle>
                        <span className="text-sm md:text-[13px] text-gray-400">
                          {results.candidate_count || 0} candidates found
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-8 md:gap-10 md:grid-cols-2 mb-10">
                        {paginatedCandidates.map((candidate, index) => (
                          <CandidateCard
                            key={index}
                            candidate={candidate}
                            index={index}
                            isSaved={savedLinks.has(candidate.link)}
                            onSave={() => handleSaveCandidate(currentJobId, candidate)}
                          />
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div className="mt-10">
                          <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}

            {/* Old Searches Tab */}
            {activeSection === 'search' && activeTab === 'old' && (
              <motion.div
                key="old-searches"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl md:text-2xl">Search History</CardTitle>
                      <div className="text-sm md:text-[13px] text-gray-400">
                        {searchHistory.length > 0 ? `${historyIndex + 1} of ${searchHistory.length}` : 'No history'}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {searchHistory.length > 0 && (
                      <div className="mb-6 md:mb-8">
                        <Pagination
                          currentPage={historyIndex + 1}
                          totalPages={searchHistory.length}
                          onPageChange={(page) => setHistoryIndex(page - 1)}
                        />
                      </div>
                    )}

                    {isLoading ? (
                      <LoadingSpinner message={loadingMessage} />
                    ) : results ? (
                      <>
                        {/* JD Summary */}
                        {(() => {
                          const jd = results.job_details?.structured_jd || deriveStructuredJD(results.job_details);
                          if (!jd) return null;
                          return (
                            <Card className="mb-6 md:mb-8">
                              <CardHeader>
                                <CardTitle className="text-xl md:text-2xl">Job Summary</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                                  {Object.entries(jd).map(([key, value]) => {
                                    if (!value || (Array.isArray(value) && value.length === 0)) return null;
                                    return (
                                      <div key={key} className="p-4 md:p-5 bg-gray-800/50 rounded-xl border border-gray-700/80">
                                        <p className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">{key.replace(/_/g, ' ')}</p>
                                        {Array.isArray(value) ? (
                                          <div className="flex flex-wrap gap-2 mt-2">
                                            {value.slice(0, 6).map((item, idx) => (
                                              <span key={idx} className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[13px] rounded-full">{item}</span>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-white font-semibold">{value}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })()}

                        {/* Candidates */}
{results.candidates && results.candidates.length > 0 ? (
  <>
    <div className="grid gap-6 md:grid-cols-2 mb-8">
      {paginatedCandidates.map((candidate, index) => (
        <CandidateCard
          key={index}
          candidate={candidate}
          index={index}
          isSaved={savedLinks.has(candidate.link)}
          onSave={() => handleSaveCandidate(currentJobId, candidate)}
        />
      ))}
    </div>

    {totalPages > 1 && (
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    )}
  </>
) : (
  <div className="text-center py-12 text-gray-400">
    No candidates stored for this search.
  </div>
)}

                      </>
                    ) : (
                      <div className="text-center py-12 md:py-16 text-gray-400">No search history available</div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Saved Candidates Section */}
            {activeSection === 'saved' && (
              <SavedCandidatesList fastapiUrl={FASTAPI_URL} nodeApiUrl={API_URL} />
            )}

            {/* Settings Section */}
            {activeSection === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl md:text-2xl">Profile</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Name</label>
                        <input
                          type="text"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Email</label>
                        <input
                          type="email"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={async () => {
                          try {
                            setSavingProfile(true);
                            await axios.put('/api/auth/profile', profileForm);
                            toast.success('Profile updated');
                          } catch (e) {
                            const msg = e.response?.data?.message || 'Failed to update profile';
                            toast.error(msg);
                          } finally {
                            setSavingProfile(false);
                          }
                        }}
                        loading={savingProfile}
                      >
                        Save Changes
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl md:text-2xl">Change Password</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Current Password</label>
                        <input
                          type="password"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
                          value={pwdForm.currentPassword}
                          onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">New Password</label>
                        <input
                          type="password"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
                          value={pwdForm.newPassword}
                          onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Confirm New Password</label>
                        <input
                          type="password"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
                          value={pwdForm.confirm}
                          onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={async () => {
                          if (!pwdForm.newPassword || pwdForm.newPassword !== pwdForm.confirm) {
                            toast.error('Passwords do not match');
                            return;
                          }
                          try {
                            setSavingPwd(true);
                            await axios.post('/api/auth/change-password', {
                              currentPassword: pwdForm.currentPassword,
                              newPassword: pwdForm.newPassword,
                            });
                            toast.success('Password changed successfully');
                            setPwdForm({ currentPassword: '', newPassword: '', confirm: '' });
                          } catch (e) {
                            const msg = e.response?.data?.message || 'Failed to change password';
                            toast.error(msg);
                          } finally {
                            setSavingPwd(false);
                          }
                        }}
                        loading={savingPwd}
                      >
                        Update Password
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;