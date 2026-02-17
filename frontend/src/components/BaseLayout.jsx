// src/layouts/BaseLayout.jsx
import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useWallet } from "../contexts/WalletContext";
import toast from "react-hot-toast";
import "./BaseLayout.css";

const BaseLayout = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { wallet, loading, availableBalance, refreshWallet } = useWallet();

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBottomMenuOpen, setIsBottomMenuOpen] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState("home");
  const [loadingGame, setLoadingGame] = useState(null);
  
  // Music player states
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [volume, setVolume] = useState(0.5);
  const [showMusicList, setShowMusicList] = useState(false);
  const [showMobileMusicControls, setShowMobileMusicControls] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);
  
  // List of available songs from components/sounds folder
  const songs = [
    { id: 1, name: "Ambient Gaming", file: "backroads_loading_screen.mp3" },
    { id: 2, name: "Chill Beats", file: "DustontheControllerw.mp3" },
    { id: 3, name: "Epic Adventure", file: "Dust_on_the_Controller.mp3" },
    { id: 4, name: "Focus Mode", file: "Cyber_Regular_Tuesday.mp3" },
    { id: 5, name: "Space Journey", file: "Hop_Cute_Little_Bunny_Hop.mp3" },
    { id: 6, name: "Velvet Odds", file: "Old_Witch_Road.mp3" },
    { id: 7, name: "Velvet Odds 2", file: "Sea_Sick.mp3" },
  ];

  // Function to get the full URL for an audio file
  const getAudioUrl = (filename) => {
    return `/sounds/${filename}`;
  };

  // Function to handle audio errors
  const handleAudioError = (error) => {
    console.error("Audio error:", error);
    setAudioError(true);
    setIsMusicPlaying(false);
    toast.error("Error playing audio. Please check the file.");
  };

  // Function to get fallback audio URL for testing
  const getFallbackAudioUrl = () => {
    return "https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3";
  };

  // Function to check if audio file exists
  const checkAudioFile = async (filename) => {
    try {
      const url = getAudioUrl(filename);
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.warn(`Audio file check failed for ${filename}:`, error);
      return false;
    }
  };

  // Initialize audio
  const initializeAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    const audio = new Audio();
    audio.volume = volume;
    audio.preload = "none";
    
    audio.addEventListener('error', handleAudioError);
    audio.addEventListener('ended', () => setIsMusicPlaying(false));
    
    audioRef.current = audio;
    return audio;
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("veltora-theme");
    if (savedTheme === "light") setIsDarkMode(false);
    
    // Set active nav based on current path
    const path = location.pathname;
    if (path === "/") setActiveNavItem("home");
    else if (path.includes("wallet")) setActiveNavItem("wallet");
    else if (path.includes("transactions")) setActiveNavItem("transactions");
    else if (path.includes("referrals")) setActiveNavItem("referrals");
    else if (path.includes("profile")) setActiveNavItem("profile");
    else if (path.includes("settings")) setActiveNavItem("settings");

    // Initialize audio
    initializeAudio();
    
    // Load saved music preferences
    const savedSongId = localStorage.getItem("veltora-current-song");
    const savedIsPlaying = localStorage.getItem("veltora-music-playing") === "true";
    const savedVolume = localStorage.getItem("veltora-music-volume");
    
    if (savedSongId) {
      const song = songs.find(s => s.id === parseInt(savedSongId));
      if (song) {
        setCurrentSong(song);
        
        // Pre-check the audio file
        checkAudioFile(song.file).then(exists => {
          if (exists && savedIsPlaying) {
            const audioUrl = getAudioUrl(song.file);
            audioRef.current.src = audioUrl;
            audioRef.current.play().catch(e => {
              console.log("Auto-play prevented:", e);
              setIsMusicPlaying(false);
              setAudioError(false);
            });
            setIsMusicPlaying(savedIsPlaying);
          } else if (!exists) {
            setAudioError(true);
          }
        });
      }
    }
    
    if (savedVolume) {
      const vol = parseFloat(savedVolume);
      setVolume(vol);
      if (audioRef.current) {
        audioRef.current.volume = vol;
      }
    }

    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('error', handleAudioError);
        audioRef.current.removeEventListener('ended', () => setIsMusicPlaying(false));
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      localStorage.setItem("veltora-music-volume", volume.toString());
    }
  }, [volume]);

  // Handle body scroll when modals are open
  useEffect(() => {
    if (isBottomMenuOpen || showMusicList) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isBottomMenuOpen, showMusicList]);

  const togglePlayPause = async () => {
    if (!currentSong) {
      // If no song selected, try first song
      const firstSong = songs[0];
      const exists = await checkAudioFile(firstSong.file);
      
      if (!exists) {
        // Use test audio if local files don't exist
        await handleTestAudio();
        return;
      }
      
      setCurrentSong(firstSong);
      const audioUrl = getAudioUrl(firstSong.file);
      audioRef.current.src = audioUrl;
      localStorage.setItem("veltora-current-song", firstSong.id.toString());
      
      try {
        await audioRef.current.play();
        setIsMusicPlaying(true);
        localStorage.setItem("veltora-music-playing", "true");
        setAudioError(false);
        toast.success(`Now playing: ${firstSong.name}`);
      } catch (error) {
        console.error("Error playing audio:", error);
        setAudioError(true);
        toast.error("Unable to play audio. Please try test audio.");
      }
    } else {
      if (isMusicPlaying) {
        audioRef.current.pause();
        setIsMusicPlaying(false);
        localStorage.setItem("veltora-music-playing", "false");
      } else {
        try {
          await audioRef.current.play();
          setIsMusicPlaying(true);
          localStorage.setItem("veltora-music-playing", "true");
          setAudioError(false);
        } catch (error) {
          console.error("Error playing audio:", error);
          setAudioError(true);
          toast.error("Unable to resume audio. Please try test audio.");
        }
      }
    }
  };

  const selectSong = async (song) => {
    const wasPlaying = isMusicPlaying;
    
    if (wasPlaying) {
      audioRef.current.pause();
    }
    
    setCurrentSong(song);
    
    // Check if it's a test song
    if (song.id === 99) {
      audioRef.current.src = song.file;
      setAudioError(false);
    } else {
      const audioUrl = getAudioUrl(song.file);
      const exists = await checkAudioFile(song.file);
      
      if (!exists) {
        setAudioError(true);
        toast.error("Audio file not found. Using test audio instead.");
        await handleTestAudio();
        return;
      }
      
      audioRef.current.src = audioUrl;
      localStorage.setItem("veltora-current-song", song.id.toString());
      setAudioError(false);
    }
    
    if (wasPlaying) {
      try {
        await audioRef.current.play();
        setIsMusicPlaying(true);
        toast.success(`Now playing: ${song.name}`);
      } catch (error) {
        console.error("Error playing audio:", error);
        setAudioError(true);
        toast.error("Unable to play selected song.");
      }
    } else {
      toast.success(`Selected: ${song.name}`);
    }
    
    setShowMusicList(false);
  };

  const toggleMusicList = () => {
    setShowMusicList(!showMusicList);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const toggleTheme = (mode) => {
    setIsDarkMode(mode);
    localStorage.setItem("veltora-theme", mode ? "dark" : "light");
  };

  const handleLogout = async () => {
    await onLogout();
    navigate("/login");
  };

  const formatBalance = (balance) => {
    if (balance === null || balance === undefined) return "0.00";
    return parseFloat(balance).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const displayBalance =
    wallet?.balance !== undefined ? wallet.balance : user?.balance || 0;

  // Function to handle test audio
  const handleTestAudio = async () => {
    const testSong = {
      id: 99,
      name: "Test Audio (Online)",
      file: getFallbackAudioUrl()
    };
    
    const wasPlaying = isMusicPlaying;
    
    if (wasPlaying) {
      audioRef.current.pause();
    }
    
    setCurrentSong(testSong);
    audioRef.current.src = testSong.file;
    setAudioError(false);
    
    if (wasPlaying) {
      try {
        await audioRef.current.play();
        setIsMusicPlaying(true);
        toast.success("Playing test audio");
      } catch (error) {
        console.error("Error playing test audio:", error);
        setAudioError(true);
      }
    } else {
      toast.success("Test audio loaded. Click play to start.");
    }
    
    setShowMusicList(false);
  };

  return (
    <>
      <div className={`dashboard ${isDarkMode ? "dark-mode" : "light-mode"}`}>
        {/* ANIMATED BACKGROUND ELEMENTS */}
        <div className="animated-bg">
          <div className="bg-orb orb-1"></div>
          <div className="bg-orb orb-2"></div>
          <div className="bg-orb orb-3"></div>
          <div className="bg-grid"></div>
        </div>

        {/* DESKTOP SIDEBAR */}
        <aside className="desktop-sidebar">
          <div className="sidebar-content">
            <div className="sidebar-logo-container">
              <div className="logo-icon-wrapper">
                <img src={require('../logo.png')} alt="Veltora" className="sidebar-logo-icon" />
              </div>
              <h2 className="logo-text">
                <span className="logo-gradient">VELTORA</span>
                <div className="logo-subtitle">Premium Gaming</div>
              </h2>
            </div>

            <div className="user-profile-card">
              <div className="profile-info">
                <h3 className="profile-username">{user?.username || "Guest"}</h3>
                <div className="profile-email" title={user?.email}>
                  {user?.email ? (
                    user.email.length > 20 ? `${user.email.substring(0, 20)}...` : user.email
                  ) : (
                    "No email"
                  )}
                </div>
                <div className="profile-balance">
                  <Icon icon="mdi:currency-ngn" className="balance-icon" />
                  <span className="balance-amount">{loading ? "Loading..." : formatBalance(availableBalance)}</span>
                </div>
              </div>
            </div>

            {/* MUSIC PLAYER SECTION - DESKTOP */}
            <div className="music-player-section">
              <div className="music-player-header">
                <Icon icon="mdi:music" className="music-icon" />
                <span className="music-title">Background Music</span>
                {audioError && (
                  <span className="audio-error-badge" title="Audio error - click test audio">
                    <Icon icon="mdi:alert-circle" />
                  </span>
                )}
              </div>
              
              <div className="music-controls">
                <button 
                  className="music-control-btn play-btn"
                  onClick={togglePlayPause}
                  title={isMusicPlaying ? "Pause" : "Play"}
                >
                  <Icon icon={isMusicPlaying ? "mdi:pause" : "mdi:play"} />
                </button>
                
                <div className="volume-control">
                  <Icon icon="mdi:volume-low" className="volume-icon" />
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="volume-slider"
                    title="Volume"
                  />
                  <Icon icon="mdi:volume-high" className="volume-icon" />
                </div>
                
                <button 
                  className="music-control-btn list-btn"
                  onClick={toggleMusicList}
                  title="Select Music"
                >
                  <Icon icon="mdi:playlist-music" />
                </button>
              </div>
              
              {currentSong ? (
                <div className="current-song-info">
                  <Icon icon="mdi:music-note" />
                  <span className="song-name" title={currentSong.name}>
                    {currentSong.name.length > 20 
                      ? `${currentSong.name.substring(0, 20)}...` 
                      : currentSong.name}
                  </span>
                  {isMusicPlaying && !audioError && (
                    <div className="playing-indicator">
                      <div className="sound-wave">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-song-selected">
                  <Icon icon="mdi:music-off" />
                  <span>No music selected</span>
                </div>
              )}
              
              {audioError && (
                <div className="audio-error-message">
                  <small>Local audio files not found. Try test audio.</small>
                  <button 
                    className="test-audio-btn"
                    onClick={handleTestAudio}
                  >
                    Use Test Audio
                  </button>
                </div>
              )}
            </div>

            {/* MUSIC LIST DROPDOWN */}
            {showMusicList && (
              <div className="music-list-dropdown">
                <div className="music-list-header">
                  <h4>Select Music</h4>
                  <button 
                    className="close-music-list"
                    onClick={() => setShowMusicList(false)}
                  >
                    <Icon icon="mdi:close" />
                  </button>
                </div>
                <div className="music-list-items">
                  {songs.map(song => (
                    <button
                      key={song.id}
                      className={`music-list-item ${currentSong?.id === song.id ? 'active' : ''}`}
                      onClick={() => selectSong(song)}
                    >
                      <Icon icon="mdi:music" />
                      <span className="song-item-name">{song.name}</span>
                      {currentSong?.id === song.id && (
                        <Icon icon="mdi:check" className="active-indicator" />
                      )}
                    </button>
                  ))}
                  <button
                    className="music-list-item fallback-btn"
                    onClick={handleTestAudio}
                  >
                    <Icon icon="mdi:test-tube" />
                    <span className="song-item-name">Test Audio (Online)</span>
                  </button>
                </div>
              </div>
            )}

            <nav className="sidebar-nav">
              {[
                { id: "home", label: "Home", icon: "mdi:home", path: "/" },
                { id: "wallet", label: "Wallet", icon: "mdi:wallet", path: "/wallet" },
                { id: "profile", label: "Profile", icon: "mdi:account", path: "/profile" },
                { id: "transactions", label: "Transactions", icon: "mdi:history", path: "/transactions" },
                { id: "referrals", label: "Referrals", icon: "mdi:account-multiple", path: "/referrals" },
                { id: "support", label: "Support", icon: "mdi:headset", path: "/support" },
                { id: "settings", label: "Settings", icon: "mdi:cog", path: "/settings" },
              ].map((item) => (
                <button
                  key={item.id}
                  className={`sidebar-nav-item ${
                    activeNavItem === item.id ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveNavItem(item.id);
                    navigate(item.path);
                  }}
                >
                  <div className="nav-item-glow"></div>
                  <div className="nav-icon-wrapper">
                    <Icon icon={item.icon} className="nav-icon" />
                  </div>
                  <span className="nav-label">{item.label}</span>
                  <div className="nav-indicator"></div>
                </button>
              ))}
            </nav>

            <div className="sidebar-footer">

              <button className="logout-btn" onClick={handleLogout}>
                <div className="logout-glow"></div>
                <Icon icon="mdi:logout" className="logout-icon" />
                <span className="logout-text">Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* MOBILE HEADER */}
        <header className="mobile-header">
          <div className="mobile-logo">
            <Icon icon="mdi:crown" className="mobile-logo-icon" />
            <span className="mobile-logo-text">Veltora</span>
          </div>
          
          <div className="mobile-header-right">
            {/* Mobile Music Controls in Header */}
            {showMobileMusicControls && currentSong && (
              <div className="mobile-music-controls">
                <button 
                  className="mobile-music-control-btn"
                  onClick={togglePlayPause}
                >
                  <Icon icon={isMusicPlaying ? "mdi:pause" : "mdi:play"} />
                </button>
                <div className="mobile-volume-control">
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="mobile-volume-slider"
                  />
                </div>
                <button 
                  className="mobile-music-control-btn"
                  onClick={toggleMusicList}
                >
                  <Icon icon="mdi:music" />
                </button>
              </div>
            )}
            
            <button 
              className="mobile-balance-btn"
              onClick={() => navigate("/wallet")}
            >
              <div className="balance-glow"></div>
              <Icon icon="mdi:currency-ngn" className="balance-icon" />
              <span className="balance-text">{formatBalance(availableBalance)}</span>
            </button>
            
            {/* Toggle Music Controls Button */}
            <button 
              className="mobile-music-toggle"
              onClick={() => setShowMobileMusicControls(!showMobileMusicControls)}
              title="Music Controls"
            >
              <Icon icon="mdi:headphones" />
              {currentSong && <div className="music-active-indicator"></div>}
            </button>
          </div>
        </header>

        {/* MAIN CONTENT - THIS IS WHERE YOUR PAGES RENDER */}
        <main className="dashboard-main">
          <div className="content-wrapper">
            <Outlet />
          </div>
        </main>

        {/* FIXED FOOTER (MOBILE) */}
        <footer className="fixed-footer">
            <div className="footer-nav">
                <button
                    className={`footer-nav-item ${activeNavItem === "home" ? "active" : ""}`}
                    onClick={() => {
                        setActiveNavItem("home");
                        navigate("/");
                    }}
                >
                    <div className="footer-icon-wrapper">
                        <Icon icon="mdi:home" />
                    </div>
                    <span className="footer-label">Home</span>
                </button>
                
                <button
                    className={`footer-nav-item ${activeNavItem === "wallet" ? "active" : ""}`}
                    onClick={() => {
                        setActiveNavItem("wallet");
                        navigate("/wallet");
                    }}
                >
                    <div className="footer-icon-wrapper">
                        <Icon icon="mdi:wallet" />
                    </div>
                    <span className="footer-label">Wallet</span>
                </button>
                
                <button
                    className={`footer-nav-item ${activeNavItem === "profile" ? "active" : ""}`}
                    onClick={() => {
                        setActiveNavItem("profile");
                        navigate("/profile");
                    }}
                >
                    <div className="footer-icon-wrapper">
                        <Icon icon="mdi:account" />
                    </div>
                    <span className="footer-label">Profile</span>
                </button>
                
                <button
                    className={`footer-nav-item ${isBottomMenuOpen ? "active" : ""}`}
                    onClick={() => setIsBottomMenuOpen(true)}
                >
                    <div className="footer-icon-wrapper">
                        <Icon icon="mdi:menu" />
                    </div>
                    <span className="footer-label">Menu</span>
                </button>
            </div>
        </footer>

        {/* BOTTOM MENU MODAL */}
        <div className={`bottom-menu-modal ${isBottomMenuOpen ? "open" : ""}`}>
          <div className="modal-backdrop" onClick={() => setIsBottomMenuOpen(false)}></div>
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-user-info">
                <div className="modal-avatar">
                  <Icon icon="mdi:account-circle" />
                  <div className="modal-status"></div>
                </div>
                <div className="modal-user-details">
                  <h4 className="modal-username">{user?.username || "Guest"}</h4>
                  <p className="modal-user-email" title={user?.email}>
                    {user?.email ? (user.email.length > 25 ? `${user.email.substring(0, 25)}...` : user.email) : "No email"}
                  </p>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsBottomMenuOpen(false)}
                aria-label="Close menu"
              >
                <Icon icon="mdi:close" />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-section">
                <h5 className="section-title">Background Music</h5>
                <div className="modal-music-controls">
                  <div className="mobile-modal-music-info">
                    {currentSong ? (
                      <>
                        <div className="mobile-current-song">
                          <Icon icon="mdi:music" />
                          <span>{currentSong.name}</span>
                        </div>
                        <div className="mobile-modal-music-buttons">
                          <button 
                            className="modal-music-btn"
                            onClick={togglePlayPause}
                          >
                            <Icon icon={isMusicPlaying ? "mdi:pause" : "mdi:play"} />
                          </button>
                          <button 
                            className="modal-music-btn"
                            onClick={toggleMusicList}
                          >
                            <Icon icon="mdi:playlist-music" />
                          </button>
                          <div className="modal-volume-control">
                            <Icon icon="mdi:volume-low" />
                            <input 
                              type="range" 
                              min="0" 
                              max="1" 
                              step="0.01"
                              value={volume}
                              onChange={handleVolumeChange}
                              className="modal-volume-slider"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <button 
                        className="modal-start-music-btn"
                        onClick={togglePlayPause}
                      >
                        <Icon icon="mdi:play" />
                        <span>Start Background Music</span>
                      </button>
                    )}
                  </div>
                  {audioError && (
                    <button 
                      className="modal-test-audio-btn"
                      onClick={handleTestAudio}
                    >
                      <Icon icon="mdi:test-tube" />
                      <span>Use Test Audio (Online)</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="modal-section">
                <h5 className="section-title">Navigation</h5>
                <div className="modal-actions">
                  <button
                    className="modal-action-btn"
                    onClick={() => {
                      navigate("/transactions");
                      setIsBottomMenuOpen(false);
                    }}
                  >
                    <div className="action-icon-wrapper">
                      <Icon icon="mdi:history" />
                    </div>
                    <span className="action-text">Transactions</span>
                    <Icon icon="mdi:chevron-right" className="action-arrow" />
                  </button>

                  <button
                    className="modal-action-btn"
                    onClick={() => {
                      navigate("/referrals");
                      setIsBottomMenuOpen(false);
                    }}
                  >
                    <div className="action-icon-wrapper">
                      <Icon icon="mdi:account-multiple" />
                    </div>
                    <span className="action-text">Referrals</span>
                    <Icon icon="mdi:chevron-right" className="action-arrow" />
                  </button>
                </div>
              </div>

              <div className="modal-section">
                <h5 className="section-title">Account</h5>
                <div className="modal-actions">
                  <button
                    className="modal-action-btn"
                    onClick={() => {
                      navigate("/settings");
                      setIsBottomMenuOpen(false);
                    }}
                  >
                    <div className="action-icon-wrapper">
                      <Icon icon="mdi:cog" />
                    </div>
                    <span className="action-text">Settings</span>
                    <Icon icon="mdi:chevron-right" className="action-arrow" />
                  </button>

                  <button
                    className="modal-action-btn"
                    onClick={() => {
                      navigate("/support");
                      setIsBottomMenuOpen(false);
                    }}
                  >
                    <div className="action-icon-wrapper">
                      <Icon icon="mdi:headset" />
                    </div>
                    <span className="action-text">Support</span>
                    <Icon icon="mdi:chevron-right" className="action-arrow" />
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-logout-btn"
                onClick={handleLogout}
              >
                <Icon icon="mdi:logout" className="logout-icon" />
                <span className="logout-text">Logout</span>
                <div className="logout-glow"></div>
              </button>
            </div>
          </div>
        </div>

        {/* MUSIC LIST MODAL FOR MOBILE */}
        {showMusicList && (
          <div className="mobile-music-list-modal">
            <div className="mobile-music-list-backdrop" onClick={() => setShowMusicList(false)}></div>
            <div className="mobile-music-list-content">
              <div className="mobile-music-list-header">
                <h3>Select Music</h3>
                <button 
                  className="mobile-close-music-list"
                  onClick={() => setShowMusicList(false)}
                >
                  <Icon icon="mdi:close" />
                </button>
              </div>
              <div className="mobile-music-list-items">
                {songs.map(song => (
                  <button
                    key={song.id}
                    className={`mobile-music-list-item ${currentSong?.id === song.id ? 'active' : ''}`}
                    onClick={() => selectSong(song)}
                  >
                    <Icon icon="mdi:music" />
                    <span className="mobile-song-item-name">{song.name}</span>
                    {currentSong?.id === song.id && (
                      <Icon icon="mdi:check" className="mobile-active-indicator" />
                    )}
                  </button>
                ))}
                <button
                  className="mobile-music-list-item fallback-btn"
                  onClick={handleTestAudio}
                >
                  <Icon icon="mdi:test-tube" />
                  <span className="mobile-song-item-name">Test Audio (Online)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GAME LOADING OVERLAY */}
      {loadingGame && (
        <div className="game-loading-overlay">
          <div className="loading-content">
            <div className="loading-icon-wrapper">
              <Icon icon="mdi:crown" className="loading-icon" />
              <div className="loading-glow"></div>
            </div>
            <h1 className="loading-title">{loadingGame.name}</h1>
            <p className="loading-subtitle">Loading premium experience...</p>
            <div className="loading-progress">
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
              <div className="progress-text">0%</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BaseLayout;