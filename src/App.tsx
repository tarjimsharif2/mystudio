/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useRef } from "react";
import { Play, RefreshCw, ExternalLink, Tv, AlertCircle, ArrowLeft, Server, Calendar, Clock } from "lucide-react";
import Hls from "hls.js";
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link, useLocation } from "react-router-dom";

import { ClapprProxyPlayer } from './components/ClapprProxyPlayer';

interface Match {
  id: number;
  title: string;
  link: string;
  team1?: string;
  team2?: string;
  logo1?: string;
  logo2?: string;
  time?: string;
  status?: string;
  category?: string;
}

interface ServerOption {
  name: string;
  url: string;
}

const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF\-]+/g, '') // Keep Arabic characters and word characters
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

function MatchList({ matches, loading, error, fetchMatches }: { matches: Match[], loading: boolean, error: string | null, fetchMatches: () => void }) {
  const navigate = useNavigate();

  // Group matches by category
  const groupedMatches = matches.reduce((acc, match) => {
    const cat = match.category || 'Today';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {loading && matches.length === 0 ? (
        <div className="flex justify-center p-8">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      ) : matches.length === 0 ? (
        <div className="bg-gray-800 p-6 rounded-lg text-center text-gray-400">
          No matches found.
        </div>
      ) : (
        Object.entries(groupedMatches).map(([category, categoryMatches]) => (
          <div key={category} className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 border-b border-gray-700 pb-2">
              {category.includes('مباريات اليوم') || category === 'Today' ? (
                <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Today's Matches</>
              ) : category.includes('مباريات الغد') || category === 'Tomorrow' ? (
                <><Calendar className="w-5 h-5 text-blue-400" /> Tomorrow's Matches</>
              ) : (
                <><Calendar className="w-5 h-5 text-gray-400" /> {category}</>
              )}
            </h2>
            
            <div className="space-y-3">
              {categoryMatches.map((match) => (
                <Link
                  key={match.id}
                  to={`/match/${generateSlug(match.title)}`}
                  className="block bg-gray-800 border border-gray-700 hover:border-blue-500 p-4 rounded-lg cursor-pointer transition-all group relative overflow-hidden"
                >
                  {match.status && match.status.includes('جارية') && (
                    <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg animate-pulse">
                      LIVE
                    </div>
                  )}
                  
                  {match.team1 && match.team2 ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        {/* Team 1 */}
                        <div className="flex flex-col items-center gap-2 w-1/3">
                          {match.logo1 ? (
                            <img src={match.logo1} alt={match.team1} className="w-12 h-12 object-contain bg-white/5 rounded-full p-1" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-xs">T1</div>
                          )}
                          <span className="font-bold text-sm sm:text-base text-center text-white group-hover:text-blue-400 transition-colors line-clamp-2">{match.team1}</span>
                        </div>
                        
                        {/* VS & Time */}
                        <div className="flex flex-col items-center justify-center w-1/3">
                          <span className="text-xs font-mono bg-gray-700 px-2 py-1 rounded text-gray-300 mb-1">VS</span>
                          <span className="text-blue-400 font-bold text-lg">{match.time}</span>
                          {match.status && <span className="text-[10px] text-gray-400 mt-1 text-center">{match.status}</span>}
                        </div>
                        
                        {/* Team 2 */}
                        <div className="flex flex-col items-center gap-2 w-1/3">
                          {match.logo2 ? (
                            <img src={match.logo2} alt={match.team2} className="w-12 h-12 object-contain bg-white/5 rounded-full p-1" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-xs">T2</div>
                          )}
                          <span className="font-bold text-sm sm:text-base text-center text-white group-hover:text-blue-400 transition-colors line-clamp-2">{match.team2}</span>
                        </div>
                      </div>
                      <div className="text-center text-xs text-gray-500 truncate border-t border-gray-700/50 pt-2 mt-1" title={match.title}>
                        {match.title}
                      </div>
                    </div>
                  ) : (
                    <h3 className="font-medium text-sm sm:text-base leading-snug group-hover:text-blue-400 transition-colors">
                      {match.title}
                    </h3>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function MatchDetails({ matches, loading }: { matches: Match[], loading: boolean }) {
  const { slug } = useParams();
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [fetchingServers, setFetchingServers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedMatch = matches.find(m => generateSlug(m.title) === slug);

  useEffect(() => {
    if (!selectedMatch) return;
    
    let isMounted = true;
    const loadServers = async () => {
      try {
        const res = await fetch(`/api/match-stream?url=${encodeURIComponent(selectedMatch.link)}`);
        const data = await res.json();
        if (isMounted && data.success) {
          if (data.servers && data.servers.length > 0) {
            setServers(data.servers);
            setError(null);
          } else if (data.streamUrl && data.streamUrl !== "NOT_AVAILABLE") {
            setServers([{ name: 'Main Server', url: selectedMatch.link }]);
            setError(null);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setFetchingServers(false);
      }
    };

    loadServers();
    const interval = setInterval(loadServers, 15000); // Poll every 15s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedMatch]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!selectedMatch) {
    return (
      <div className="text-center text-red-400 p-6">
        <p>Match not found.</p>
        <Link to="/" className="text-blue-400 hover:underline mt-4 inline-block">Go Back</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Team 1 */}
          <div className="flex flex-col items-center gap-3 flex-1">
            {selectedMatch.logo1 ? (
              <img src={selectedMatch.logo1} alt={selectedMatch.team1} className="w-24 h-24 object-contain bg-white/5 rounded-full p-2" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center text-xl">T1</div>
            )}
            <span className="font-bold text-xl text-center text-white">{selectedMatch.team1}</span>
          </div>
          
          {/* VS & Time */}
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <span className="text-sm font-mono bg-gray-700 px-3 py-1 rounded-full text-gray-300 mb-2">VS</span>
            <span className="text-blue-400 font-bold text-2xl">{selectedMatch.time}</span>
            {selectedMatch.status && <span className="text-sm text-gray-400 mt-2">{selectedMatch.status}</span>}
            {selectedMatch.status && selectedMatch.status.toLowerCase().includes('live') && (
              <span className="mt-2 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                LIVE
              </span>
            )}
          </div>
          
          {/* Team 2 */}
          <div className="flex flex-col items-center gap-3 flex-1">
            {selectedMatch.logo2 ? (
              <img src={selectedMatch.logo2} alt={selectedMatch.team2} className="w-24 h-24 object-contain bg-white/5 rounded-full p-2" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center text-xl">T2</div>
            )}
            <span className="font-bold text-xl text-center text-white">{selectedMatch.team2}</span>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-700 text-center">
          <h2 className="text-lg text-gray-300">{selectedMatch.title}</h2>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-400" />
            Select Server
          </h3>
          <Link to={`/watch/${slug}`} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 font-medium transition-colors">
            <Play className="w-4 h-4" />
            Embedded Player
          </Link>
        </div>
        
        {servers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {servers.map((server, idx) => {
              const sSlug = generateSlug(server.name);
              return (
                <Link
                  key={idx}
                  to={`/match/${slug}/${sSlug}`}
                  className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-medium transition-colors group"
                >
                  <Play className="w-4 h-4 text-gray-400 group-hover:text-white" />
                  {server.name}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-gray-400 p-8 flex flex-col items-center">
            <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mb-4" />
            <p className="text-lg text-white mb-2">Finding Servers...</p>
            <p className="text-sm">Servers will appear automatically when the match is near. Please wait.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WatchMatch({ matches, loading }: { matches: Match[], loading: boolean }) {
  const { slug } = useParams();
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [fetchingServers, setFetchingServers] = useState(true);
  const [selectedServer, setSelectedServer] = useState<ServerOption | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const selectedMatch = matches.find(m => generateSlug(m.title) === slug);

  useEffect(() => {
    if (!selectedMatch) return;
    
    let isMounted = true;
    const loadServers = async () => {
      try {
        const res = await fetch(`/api/match-stream?url=${encodeURIComponent(selectedMatch.link)}`);
        const data = await res.json();
        if (isMounted && data.success) {
          if (data.servers && data.servers.length > 0) {
            setServers(data.servers);
            if (!selectedServer) {
              setSelectedServer(data.servers[0]);
            }
          } else if (data.streamUrl && data.streamUrl !== "NOT_AVAILABLE") {
            const defaultServer = { name: 'Main Server', url: selectedMatch.link };
            setServers([defaultServer]);
            if (!selectedServer) setSelectedServer(defaultServer);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setFetchingServers(false);
      }
    };

    loadServers();
    const interval = setInterval(loadServers, 15000); 
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedMatch]);

  useEffect(() => {
    if (!selectedServer || !selectedMatch) return;

    let isMounted = true;
    const fetchStream = async () => {
      setStreamUrl(null);
      try {
        let finalUrl = null;
        if (selectedServer.url !== selectedMatch.link) {
          const sRes = await fetch(`/api/match-stream?url=${encodeURIComponent(selectedServer.url)}`);
          const sData = await sRes.json();
          if (sData.success && sData.streamUrl && sData.streamUrl !== "NOT_AVAILABLE") {
            finalUrl = sData.streamUrl;
            if (finalUrl && finalUrl.includes('.m3u8')) {
              const finalReferer = sData.referer ? sData.referer : '';
              const refererParam = finalReferer ? `&referer=${encodeURIComponent(finalReferer)}` : '';
              finalUrl = `/api/proxy?url=${encodeURIComponent(finalUrl)}${refererParam}`;
            }
          }
        } else {
          // It's the main server fallback
          const res = await fetch(`/api/match-stream?url=${encodeURIComponent(selectedMatch.link)}`);
          const data = await res.json();
          if (data.success && data.streamUrl && data.streamUrl !== "NOT_AVAILABLE") {
            finalUrl = data.streamUrl;
            if (finalUrl && finalUrl.includes('.m3u8')) {
              const finalReferer = data.referer ? data.referer : '';
              const refererParam = finalReferer ? `&referer=${encodeURIComponent(finalReferer)}` : '';
              finalUrl = `/api/proxy?url=${encodeURIComponent(finalUrl)}${refererParam}`;
            }
          }
        }
        if (isMounted) setStreamUrl(finalUrl);
      } catch (err) {
        console.error(err);
      }
    };
    fetchStream();
  }, [selectedServer, selectedMatch]);

  if (loading || (!selectedMatch && fetchingServers)) {
    return (
      <div className="flex justify-center p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!selectedMatch) {
    return (
      <div className="text-center text-red-400 p-6">
        <p>Match not found.</p>
        <Link to="/" className="text-blue-400 hover:underline mt-4 inline-block">Go Back</Link>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden flex flex-col">
      {/* Overlaid Server Selection */}
      {!fetchingServers && servers.length > 1 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-2 overflow-x-auto max-w-[90vw] p-1.5 bg-black/60 rounded-full backdrop-blur-md hide-scrollbar border border-white/10 shadow-xl">
          {servers.map((server) => {
            const isActive = selectedServer?.name === server.name;
            return (
              <button
                key={server.url}
                onClick={() => setSelectedServer(server)}
                className={`px-4 py-1.5 rounded-full font-bold text-xs sm:text-sm whitespace-nowrap transition-all shadow-md ${
                  isActive ? 'bg-[#2ecc71] text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                }`}
              >
                {server.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Player Area */}
      <div className="w-full h-full relative flex-1">
        {fetchingServers ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
             <RefreshCw className="w-12 h-12 animate-spin text-blue-500" />
           </div>
        ) : servers.length > 0 ? (
           !streamUrl ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
               <RefreshCw className="w-12 h-12 animate-spin text-blue-500" />
             </div>
           ) : streamUrl.includes('.m3u8') || streamUrl.includes('/api/proxy') ? (
             <ClapprProxyPlayer streamUrl={streamUrl} />
           ) : (
             <iframe
               src={streamUrl}
               className="w-full h-full border-0 absolute inset-0"
               allowFullScreen
               sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
             ></iframe>
           )
        ) : (
          <div className="absolute inset-0 bg-black flex items-center justify-center text-center p-4">
            <RefreshCw className="w-12 h-12 animate-spin text-blue-500" />
          </div>
        )}
      </div>
    </div>
  );
}

function MatchPlayer({ matches, loading }: { matches: Match[], loading: boolean }) {
  const { slug, serverSlug } = useParams();
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'waiting' | 'playing'>('loading');

  const selectedMatch = matches.find(m => generateSlug(m.title) === slug);

  useEffect(() => {
    if (!selectedMatch || !serverSlug) return;

    let isMounted = true;
    let interval: NodeJS.Timeout;

    const checkStream = async () => {
      try {
        const res = await fetch(`/api/match-stream?url=${encodeURIComponent(selectedMatch.link)}`);
        const data = await res.json();

        if (!isMounted) return;

        if (data.success) {
          const servers = data.servers || [];
          const targetServer = servers.find((s: ServerOption) => generateSlug(s.name) === serverSlug);

          let finalUrl = null;
          let sData: any = null;

          if (targetServer) {
            if (targetServer.url !== selectedMatch.link) {
              const sRes = await fetch(`/api/match-stream?url=${encodeURIComponent(targetServer.url)}`);
              sData = await sRes.json();
              if (sData.success && sData.streamUrl && sData.streamUrl !== "NOT_AVAILABLE") {
                finalUrl = sData.streamUrl;
              }
            } else if (data.streamUrl && data.streamUrl !== "NOT_AVAILABLE") {
              finalUrl = data.streamUrl;
            }
          }

          if (finalUrl) {
            if (finalUrl.includes('.m3u8')) {
              // Use the referer from the final response (sData) if available, otherwise fallback to data.referer
              const finalReferer = (sData && sData.referer) ? sData.referer : data.referer;
              const refererParam = finalReferer ? `&referer=${encodeURIComponent(finalReferer)}` : '';
              finalUrl = `/api/proxy?url=${encodeURIComponent(finalUrl)}${refererParam}`;
            }
            setStreamUrl(finalUrl);
            setStatus('playing');
            clearInterval(interval);
          } else {
            setStatus('waiting');
          }
        } else {
          setStatus('waiting');
        }
      } catch (err) {
        console.error(err);
        if (isMounted) setStatus('waiting');
      }
    };

    if (status === 'loading' || status === 'waiting') {
      checkStream();
      interval = setInterval(checkStream, 15000); // Poll every 15s
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedMatch, serverSlug, status]);

  if (loading || !selectedMatch) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (status === 'waiting' || status === 'loading') {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-white p-4 text-center">
        <RefreshCw className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      {streamUrl && (streamUrl.includes('.m3u8') || streamUrl.includes('/api/proxy')) ? (
        <ClapprProxyPlayer streamUrl={streamUrl} />
      ) : (
        <iframe
          src={streamUrl || ''}
          className="w-full h-full border-0"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="no-referrer"
        ></iframe>
      )}
    </div>
  );
}

function MainApp() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  const isPlayerRoute = location.pathname.split('/').length === 4 || location.pathname.startsWith('/watch/');

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) {
         let errorText = await res.text();
         try {
            const errJson = JSON.parse(errorText);
            throw new Error(errJson.error || `Server returned ${res.status}`);
         } catch(e) {
            if (e.message.startsWith("Server returned")) throw e;
            throw new Error(`Server returned ${res.status}: ${errorText.substring(0, 100)}`);
         }
      }
      const data = await res.json();
      if (data.success) {
        setMatches(data.matches);
      } else {
        setError(data.error || "Failed to fetch matches");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching matches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
    // Auto update every 5 minutes
    const interval = setInterval(fetchMatches, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {/* Header */}
      {!isPlayerRoute && (
        <header className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Routes>
                <Route path="/match/*" element={
                  <Link 
                    to="/"
                    className="mr-2 p-2 hover:bg-gray-700 rounded-full transition-colors inline-block"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Link>
                } />
              </Routes>
              <Tv className="w-6 h-6 text-blue-500" />
              <h1 className="text-xl font-bold">Live Matches</h1>
            </div>
            <Routes>
              <Route path="/" element={
                <button
                  onClick={fetchMatches}
                  disabled={loading}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              } />
            </Routes>
          </div>
        </header>
      )}

      <main className={isPlayerRoute ? "" : "max-w-7xl mx-auto p-4"}>
        <Routes>
          <Route path="/" element={<MatchList matches={matches} loading={loading} error={error} fetchMatches={fetchMatches} />} />
          <Route path="/match/:slug" element={<MatchDetails matches={matches} loading={loading} />} />
          <Route path="/watch/:slug" element={<WatchMatch matches={matches} loading={loading} />} />
          <Route path="/match/:slug/:serverSlug" element={<MatchPlayer matches={matches} loading={loading} />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  );
}

