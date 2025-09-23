import React, { useState, useRef } from 'react';
import {
  FaBars, FaTimes, FaSearch, FaUpload, FaChartLine, FaUsers, FaEnvelope, FaCog, FaQuestionCircle,
} from 'react-icons/fa';
import './Dashboard.css';

const Dashboard = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  // Use a ref to hold the polling interval ID
  const pollIntervalRef = useRef(null);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenu-Open);
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    // Clear text area if a file is selected
    if (e.target.files[0]) {
      setJobDescription('');
    }
  };

  // Function to poll for job results
  const pollForResults = (jobId) => {
    // Stop any existing polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        setLoadingMessage('Checking job status...');
        const response = await fetch(`http://127.0.0.1:8000/sourcing-jobs/${jobId}/results`);
        
        if (response.status === 200) {
          // If status is 200, the job is complete!
          clearInterval(pollIntervalRef.current); // Stop polling
          const data = await response.json();
          setResults(data);
          setIsLoading(false);
        } else if (response.status === 400) {
          // Job is not yet complete, continue polling
          const errorData = await response.json();
          setLoadingMessage(`Job Status: ${errorData.detail.split(': ')[1] || 'In Progress...'}`);
        } else {
          // Handle other errors like 404 Not Found
          throw new Error(`Failed to get job status: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Polling error:', error);
        setResults({ error: 'Failed to retrieve job results.' });
        setIsLoading(false);
        clearInterval(pollIntervalRef.current); // Stop polling on error
      }
    }, 5000); // Check every 5 seconds
  };

  // NEW handleSearch function for FastAPI
  const handleSearch = async () => {
    setIsLoading(true);
    setResults(null);
    setLoadingMessage('Creating sourcing job...');
    let promptText = jobDescription;

    // If a file is provided, read its text content
    if (file) {
      try {
        promptText = await file.text();
      } catch (error) {
        console.error('Error reading file:', error);
        setResults({ error: 'Could not read the uploaded file.' });
        setIsLoading(false);
        return;
      }
    }

    if (!promptText) {
      console.error("No job description or file content provided.");
      setResults({ error: 'Please provide a job description or a file.' });
      setIsLoading(false);
      return;
    }

    try {
      // Step 1: POST to create the job
      const response = await fetch('http://127.0.0.1:8000/sourcing-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          linkedin_prompt: promptText,
          // You can add a github_prompt here if you have one
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      // Step 2: Get the job_id from the response
      const jobData = await response.json();
      const { job_id } = jobData;

      if (job_id) {
        setLoadingMessage('Job created successfully! Now polling for results...');
        // Step 3: Start polling for the results
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

  return (
    <div className="dashboard-container">
      {/* Sidebar Menu */}
      <div className={`sidebar ${isMenuOpen ? 'open' : ''}`}>
        <div className="menu-header">
          <h2 className="logo">Scoutly</h2>
          <button className="close-btn" onClick={toggleMenu}><FaTimes /></button>
        </div>
        <ul className="menu-list">
          <li className="menu-item active"><FaChartLine /> <span>Dashboard</span></li>
          <li className="menu-item"><FaUsers /> <span>Candidates</span></li>
          <li className="menu-item"><FaEnvelope /> <span>Messages</span></li>
          <li className="menu-item"><FaCog /> <span>Settings</span></li>
          <li className="menu-item"><FaQuestionCircle /> <span>Help</span></li>
        </ul>
      </div>

      {/* Main Content Area */}
      <div className={`main-content ${isMenuOpen ? 'pushed' : ''}`}>
        <header className="header">
          <button className="hamburger-btn" onClick={toggleMenu}><FaBars /></button>
          <div className="header-title"><h1>Scoutly Dashboard</h1></div>
        </header>

        {/* Search Section */}
        <main>
          <div className="search-section">
            <div className="search-box">
              <textarea
                className="search-input"
                placeholder="Paste a Job Description (JD) here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                disabled={!!file}
              />
              <span className="or-divider">or</span>
              <div className="upload-box">
                <label htmlFor="file-upload" className="upload-label">
                  <FaUpload /> Upload JD File
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".txt,.md,.pdf,.doc,.docx" // Added more file types
                  className="file-input"
                  onChange={handleFileChange}
                />
                {file && <span className="file-name">{file.name}</span>}
              </div>
              <button className="search-btn" onClick={handleSearch} disabled={isLoading}>
                {isLoading ? 'Searching...' : <><FaSearch /> Search</>}
              </button>
            </div>
          </div>

          {/* Results Section */}
          <div className="results-section">
            {isLoading && <p>{loadingMessage}</p>}
            {results && !results.error && (
              <div className="results-container">
                <h2>Top Candidate Matches</h2>
                {results.candidates && results.candidates.length > 0 ? (
                  results.candidates.map((candidate, index) => (
                    <div key={index} className="candidate-card">
                      <h3>{candidate.name || 'N/A'}</h3>
                      {/* You will need to adjust these fields based on what your worker.py returns */}
                      <p><strong>LinkedIn:</strong> <a href={candidate.link} target="_blank" rel="noopener noreferrer">{candidate.link}</a></p>
                      <p><strong>Description:</strong> {candidate.snippet || 'N/A'}</p>
                    </div>
                  ))
                ) : (
                  <p>No candidates found for the given job description.</p>
                )}
              </div>
            )}
            {results && results.error && <p style={{ color: 'red' }}>{results.error}</p>}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;