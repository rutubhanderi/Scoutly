import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FaSearch, FaUpload, FaFileAlt, FaCheck, FaMapMarkerAlt, FaBriefcase, FaUserTie,
  FaGithub, FaLinkedin, FaHistory, FaTimes, FaSignOutAlt
} from 'react-icons/fa';
import axios from 'axios';

const Dashboard = () => {
  const [jobDescription, setJobDescription] = useState('');
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const pollIntervalRef = useRef(null);
  
  // JD processing states
  const [jdProcessingState, setJdProcessingState] = useState(null);
  const [structuredJD, setStructuredJD] = useState(null);
  const [generatedPrompts, setGeneratedPrompts] = useState(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const [editablePrompts, setEditablePrompts] = useState({ linkedin: '', github: '' });
  const [searchHistory, setSearchHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('new');
  
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const API_URL = 'http://localhost:5000';
  const FASTAPI_URL = 'http://127.0.0.1:8000';

  // Load search history on mount
  const loadSearchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`${FASTAPI_URL}/sourcing-jobs/recent?limit=5`);
      const data = await response.json();
      console.log('Loaded search history:', data);
      setSearchHistory(data.jobs || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadSearchHistory();
  }, []);

  // Re-load history after a successful search
  useEffect(() => {
    if (!isLoading && results && results.candidates && results.candidates.length > 0) {
      loadSearchHistory();
    }
  }, [results, isLoading]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    if (selectedFile) {
      setJobDescription('');
      setStructuredJD(null);
      setGeneratedPrompts(null);
      setJdProcessingState(null);
      setShowPrompts(false);
    }
  };
  
  const processJD = async () => {
    if (!jobDescription && !file) {
      alert('Please provide a job description or upload a file');
      return;
    }
    
    setJdProcessingState('processing');
    setLoadingMessage('Processing job description...');
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      
      if (file) {
        formData.append('file', file);
      } else if (jobDescription) {
        formData.append('jd_text', jobDescription);
      }
      
      const response = await axios.post(
        `${API_URL}/api/process-jd`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
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
        setJdProcessingState('completed');
        setShowPrompts(true);
        setLoadingMessage('');
      } else {
        throw new Error('Failed to process job description');
      }
    } catch (error) {
      console.error('Error processing JD:', error);
      setResults({ error: error.response?.data?.error || 'Failed to process job description' });
      setJdProcessingState(null);
    }
  };

  const pollForResults = (jobId) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    pollIntervalRef.current = setInterval(async () => {
      try {
        setLoadingMessage('Searching for candidates...');
        const response = await fetch(`${FASTAPI_URL}/sourcing-jobs/${jobId}/results`);
        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0) {
          setResults(data);
        }
        
        if (data.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          setIsLoading(false);
          setLoadingMessage('');
          setResults(data);
        } else if (data.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setIsLoading(false);
          setResults({ error: data.detail || 'Job failed' });
        } else {
          setLoadingMessage(`Found ${data.candidate_count || 0} candidates... Still searching...`);
        }
      } catch (error) {
        console.error('Polling error:', error);
        if (error.response?.status === 404) {
          setResults({ error: 'Job not found' });
          setIsLoading(false);
          clearInterval(pollIntervalRef.current);
        }
      }
    }, 5000);
  };

  const handleStartSearch = async () => {
    if (!editablePrompts.linkedin && !editablePrompts.github) {
      alert('Please provide at least one prompt (LinkedIn or GitHub)');
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
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }
      
      const jobData = await response.json();
      const { job_id } = jobData;
      
      if (job_id) {
        setLoadingMessage('Job created successfully! Now polling for results...');
        pollForResults(job_id);
      } else {
        throw new Error("Did not receive a job_id from the server.");
      }
    } catch (error) {
      console.error('Error creating sourcing job:', error);
      setResults({ error: 'Failed to create the sourcing job. Is the server running?' });
      setIsLoading(false);
    }
  };

  const loadPreviousSearch = async (jobId) => {
    setIsLoading(true);
    setResults(null);
    setLoadingMessage('Loading previous search results...');
    setActiveTab(`history-${jobId}`);
    
    try {
      const response = await fetch(`${FASTAPI_URL}/sourcing-jobs/${jobId}/results`);
      const data = await response.json();
      setResults(data);
      setIsLoading(false);
      setLoadingMessage('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error loading previous search:', error);
      setResults({ error: 'Failed to load previous search results' });
      setIsLoading(false);
    }
  };

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Scoutly
              </h1>
              <span className="text-sm text-gray-500">Welcome, {user?.name?.split(' ')[0] || 'User'}</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition"
              >
                <FaSignOutAlt /> Logout
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                {getUserInitials()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('new')}
              className={`px-6 py-3 text-sm font-semibold transition ${
                activeTab === 'new'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              New Search
            </button>
            {searchHistory.map((job) => {
              const date = new Date(job.created_at);
              const shortDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const tabId = `history-${job.job_id}`;
              
              return (
                <button
                  key={job.job_id}
                  onClick={() => loadPreviousSearch(job.job_id)}
                  className={`px-6 py-3 text-sm font-semibold transition truncate max-w-xs ${
                    activeTab === tabId
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title={job.linkedin_prompt || job.github_prompt || 'Previous Search'}
                >
                  {shortDate}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* New Search Tab */}
        {activeTab === 'new' && (
          <>
            {/* JD Input Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Start New Search</h2>
              <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Job Description
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Paste a Job Description (JD) here or upload a file..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    disabled={!!file}
                    rows={8}
                  />
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <span className="text-sm font-semibold text-gray-500">or</span>
                    <label htmlFor="file-upload" className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-gray-700 font-medium transition shadow-sm">
                      <FaUpload /> Upload File
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
                        <p className="text-sm font-medium text-gray-700">{file.name}</p>
                        <button
                          onClick={() => {
                            setFile(null);
                            setStructuredJD(null);
                            setGeneratedPrompts(null);
                            setShowPrompts(false);
                          }}
                          className="text-xs text-red-600 hover:text-red-700 mt-1"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    className={`flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all ${jdProcessingState === 'processing' ? 'opacity-60 cursor-not-allowed' : 'hover:from-blue-700 hover:to-indigo-700'}`}
                    onClick={processJD}
                    disabled={jdProcessingState === 'processing'}
                  >
                    {jdProcessingState === 'processing' ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <FaFileAlt /> Process JD
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Structured JD Display */}
            {structuredJD && showPrompts && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <FaCheck className="text-green-600" /> Job Description Processed
                </h2>
                
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {structuredJD.job_title && (
                      <div className="flex items-start gap-3">
                        <FaBriefcase className="text-blue-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Job Title</p>
                          <p className="text-lg font-bold text-gray-900">{structuredJD.job_title}</p>
                        </div>
                      </div>
                    )}
                    {structuredJD.location && (
                      <div className="flex items-start gap-3">
                        <FaMapMarkerAlt className="text-blue-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Location</p>
                          <p className="text-lg font-bold text-gray-900">{structuredJD.location}</p>
                        </div>
                      </div>
                    )}
                    {structuredJD.experience_required && (
                      <div className="flex items-start gap-3">
                        <FaUserTie className="text-blue-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Experience</p>
                          <p className="text-lg font-bold text-gray-900">{structuredJD.experience_required}</p>
                        </div>
                      </div>
                    )}
                    {structuredJD.skills_required && structuredJD.skills_required.length > 0 && (
                      <div className="flex items-start gap-3">
                        <FaMapMarkerAlt className="text-blue-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Skills</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {structuredJD.skills_required.slice(0, 5).map((skill, idx) => (
                              <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Generated Prompts */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Generated Search Prompts</h3>
                  
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      LinkedIn Prompt
                    </label>
                    <textarea
                      value={editablePrompts.linkedin}
                      onChange={(e) => setEditablePrompts({ ...editablePrompts, linkedin: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      GitHub Prompt
                    </label>
                    <textarea
                      value={editablePrompts.github}
                      onChange={(e) => setEditablePrompts({ ...editablePrompts, github: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>

                  <button
                    className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all hover:from-green-700 hover:to-emerald-700"
                    onClick={handleStartSearch}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Searching Candidates...
                      </>
                    ) : (
                      <>
                        <FaSearch /> Start Candidate Search
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Results Section */}
            {results && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                {isLoading && (
                  <div className="text-center py-12">
                    <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-blue-600 font-semibold text-lg">{loadingMessage}</p>
                  </div>
                )}
                
                {!isLoading && results.error && (
                  <div className="text-center py-12">
                    <p className="text-red-600 font-semibold text-lg">{results.error}</p>
                  </div>
                )}

                {!isLoading && !results.error && results.candidates && results.candidates.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-gray-900">Top Candidate Matches</h2>
                      <p className="text-sm text-gray-600">{results.candidate_count || 0} candidates found</p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                      {results.candidates.map((candidate, index) => {
                        const isGitHub = candidate.source === 'GitHub';
                        const isLinkedIn = candidate.source === 'LinkedIn';
                        const scoreColor = candidate.match_score >= 80 ? 'bg-green-100 text-green-800' :
                                         candidate.match_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                         'bg-orange-100 text-orange-800';
                        
                        return (
                          <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-gray-50">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-900">{candidate.name || 'N/A'}</h3>
                                {candidate.title && (
                                  <p className="text-sm text-gray-500 mt-1">{candidate.title}</p>
                                )}
                              </div>
                              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${scoreColor}`}>
                                {candidate.match_score || 0}%
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2 mb-4">
                              {isLinkedIn && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded">
                                  <FaLinkedin /> LinkedIn
                                </span>
                              )}
                              {isGitHub && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                                  <FaGithub /> GitHub
                                </span>
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-4 line-clamp-3">{candidate.snippet || 'N/A'}</p>
                            
                            {candidate.reasoning && (
                              <p className="text-xs text-gray-500 mb-4 italic">{candidate.reasoning}</p>
                            )}
                            
                            <a 
                              href={candidate.link} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition"
                            >
                              View Profile →
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {!isLoading && !results.error && (!results.candidates || results.candidates.length === 0) && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No candidates found yet. Start a search to find candidates.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* History Tabs - Show results for selected history item */}
        {activeTab.startsWith('history-') && results && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            {isLoading && (
              <div className="text-center py-12">
                <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-blue-600 font-semibold text-lg">{loadingMessage}</p>
              </div>
            )}

            {!isLoading && results.error && (
              <div className="text-center py-12">
                <p className="text-red-600 font-semibold text-lg">{results.error}</p>
              </div>
            )}

            {!isLoading && !results.error && results.candidates && results.candidates.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Previous Search Results</h2>
                  <p className="text-sm text-gray-600">{results.candidate_count || 0} candidates found</p>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {results.candidates.map((candidate, index) => {
                    const isGitHub = candidate.source === 'GitHub';
                    const isLinkedIn = candidate.source === 'LinkedIn';
                    const scoreColor = candidate.match_score >= 80 ? 'bg-green-100 text-green-800' :
                                     candidate.match_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                     'bg-orange-100 text-orange-800';
                    
                    return (
                      <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-gray-50">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900">{candidate.name || 'N/A'}</h3>
                            {candidate.title && (
                              <p className="text-sm text-gray-500 mt-1">{candidate.title}</p>
                            )}
                          </div>
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${scoreColor}`}>
                            {candidate.match_score || 0}%
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-4">
                          {isLinkedIn && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded">
                              <FaLinkedin /> LinkedIn
                            </span>
                          )}
                          {isGitHub && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                              <FaGithub /> GitHub
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3">{candidate.snippet || 'N/A'}</p>
                        
                        {candidate.reasoning && (
                          <p className="text-xs text-gray-500 mb-4 italic">{candidate.reasoning}</p>
                        )}
                        
                        <a 
                          href={candidate.link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition"
                        >
                          View Profile →
                        </a>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;