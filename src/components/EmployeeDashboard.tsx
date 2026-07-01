import React, { useState, useEffect, useRef } from 'react';
import { User, Attendance, AttendanceStatus, QRToken } from '../types';
import { database } from '../database';
import jsQR from 'jsqr';
import { 
  QrCode, 
  Clock, 
  HelpCircle, 
  CheckCircle2, 
  Calendar, 
  UserSquare, 
  Lock, 
  Sparkles, 
  Scan, 
  AlertCircle,
  Hash,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EmployeeDashboardProps {
  user: User;
  refreshTrigger: number;
}

export default function EmployeeDashboard({ user, refreshTrigger }: EmployeeDashboardProps) {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [currentShift, setCurrentShift] = useState<Attendance | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [scanMode, setScanMode] = useState<'camera' | 'token'>('camera');
  const [latestToken, setLatestToken] = useState<QRToken | null>(null);
  const [timeLeft, setTimeLeft] = useState(0); // active token seconds to live
  
  // UI feedback states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [operationType, setOperationType] = useState<AttendanceStatus>(AttendanceStatus.CHECKED_IN);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profile status references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isSubmittingRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);

  useEffect(() => {
    fetchEmployeeRecords();
    fetchCurrentAdminToken();
  }, [user.id, refreshTrigger]);

  // Periodic timer for active token expiration countdown
  useEffect(() => {
    const interval = setInterval(() => {
      if (latestToken) {
        const expiry = new Date(latestToken.expiryTime).getTime();
        const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
        setTimeLeft(diff);
        if (diff === 0) {
          // Reload latest token
          fetchCurrentAdminToken();
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [latestToken]);

  const fetchEmployeeRecords = async () => {
    try {
      const records = await database.getEmployeeAttendance(user.id);
      setAttendances(records);
      
      // Determine alternating cycle: find latest record
      if (records.length > 0) {
        const latest = records[0]; // Already sorted descending by date/time
        if (latest.status === AttendanceStatus.CHECKED_IN) {
          setCurrentShift(latest);
          setOperationType(AttendanceStatus.CHECKED_OUT);
        } else {
          setCurrentShift(null);
          setOperationType(AttendanceStatus.CHECKED_IN);
        }
      } else {
        setCurrentShift(null);
        setOperationType(AttendanceStatus.CHECKED_IN);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCurrentAdminToken = async (): Promise<QRToken | null> => {
    const t = await database.getLatestToken();
    setLatestToken(t);
    return t;
  };

  // Turn camera on/off
  const toggleCamera = async () => {
    if (cameraActive) {
      stopCamera();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setCameraStream(stream);
        setCameraActive(true);
      } catch (err) {
        setFeedback({
          type: 'error',
          message: 'Unable to start camera. Please verify device camera permissions.'
        });
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setCameraActive(false);
  };

  // Bind camera stream dynamically to video ref when element is mounted
  useEffect(() => {
    if (cameraActive && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraActive, cameraStream]);

  // Real-time canvas scanning loop for auto QR-stream decoding
  useEffect(() => {
    let active = true;
    let animationFrameId: number;

    const scanFrame = () => {
      if (!active) return;

      if (cameraActive && videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (decoded && decoded.data) {
            console.log("Dynamically decoded security QR code:", decoded.data);
            active = false;
            validateAndSubmitAttendance(decoded.data, 'QR').then((success) => {
              if (success === false) {
                // Wait 2.5 seconds to prevent spamming failed triggers in a row
                setTimeout(() => {
                  active = true;
                  scanFrame();
                }, 2500);
              }
            });
            return;
          }
        }
      }

      animationFrameId = requestAnimationFrame(scanFrame);
    };

    if (cameraActive) {
      scanFrame();
    }

    return () => {
      active = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [cameraActive, latestToken]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Process manual credential validation
  const validateAndSubmitAttendance = async (enteredCode: string, inputType: 'QR' | 'Token'): Promise<boolean> => {
    // 1. Concurrency lock
    if (isSubmittingRef.current || isSubmitting) {
      console.warn('Click or scan ignored - a submission is currently in progress.');
      return false;
    }

    // 2. Cooldown throttle to prevent rapid double-clicks/double-scans
    const now = Date.now();
    if (now - lastSubmitTimeRef.current < 3500) {
      console.warn('Click or scan throttled - please wait between scan/entry attempts.');
      return false;
    }

    lastSubmitTimeRef.current = now;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setFeedback(null);
    const checkedToken = await fetchCurrentAdminToken(); // Ensure we have the absolute latest

    if (!checkedToken) {
      setFeedback({
        type: 'error',
        message: 'No active authentication tokens could be found. Contact admin to generate a token.'
      });
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      return false;
    }

    // Expiry check - Allow up to 3 minutes of clock drift/skew or grace period to prevent lockout failures (180000ms as requested)
    const isExpired = new Date(checkedToken.expiryTime).getTime() + 180000 < Date.now();
    if (isExpired) {
      setFeedback({
        type: 'error',
        message: 'The token has expired. Wait for admin refresh cycle (creates once every 1 minute).'
      });
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      return false;
    }

    // Value matches
    const codeToCompare = inputType === 'QR' ? checkedToken.qrCodeValue : checkedToken.tokenValue;
    if (enteredCode !== codeToCompare) {
      setFeedback({
        type: 'error',
        message: `Incorrect ${inputType}. Make sure it matches the Admin's current panel.`
      });
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      return false;
    }

    try {
      // Execute alternating cycle
      if (operationType === AttendanceStatus.CHECKED_IN) {
        // Record Check In
        const doc = await database.registerCheckIn(user);
        setFeedback({
          type: 'success',
          message: `Check-In Successful on ${new Date(doc.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        });
      } else {
        // Record Check Out
        if (currentShift) {
          const doc = await database.registerCheckOut(currentShift.id);
          setFeedback({
            type: 'success',
            message: `Check-Out Successful on ${new Date(doc.checkOutTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          });
        }
      }
      stopCamera();
      setManualToken('');
      fetchEmployeeRecords();
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'A storage gate validation failure rejected the transaction.';
      setFeedback({
        type: 'error',
        message: errorMessage
      });
      return false;
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken) {
      setFeedback({ type: 'error', message: 'Please enter a 6-digit dynamic token.' });
      return;
    }
    validateAndSubmitAttendance(manualToken, 'Token');
  };

  // Computed metrics
  const totalShifts = attendances.length;
  const completedShifts = attendances.filter(a => a.status === AttendanceStatus.CHECKED_OUT).length;
  const activeCheckIns = attendances.filter(a => a.status === AttendanceStatus.CHECKED_IN).length;

  const calculateHours = (att: Attendance) => {
    if (!att.checkOutTime) return '-';
    const hrs = (new Date(att.checkOutTime).getTime() - new Date(att.checkInTime).getTime()) / (1000 * 60 * 60);
    return `${hrs.toFixed(1)} hrs`;
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 2. CORE ATTENDANCE SUBMIT MODULE */}
      <div className="w-full">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center">
                <Activity className="h-4 w-4 mr-2 text-indigo-600" />
                Attendance
              </h3>
              <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => { setScanMode('camera'); setFeedback(null); }}
                  className={`text-[11px] px-3 py-1.5 font-bold rounded-md transition cursor-pointer ${scanMode === 'camera' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-850'}`}
                >
                  <QrCode className="h-3.5 w-3.5 inline mr-1" />
                  QR Scan
                </button>
                <button
                  type="button"
                  onClick={() => { setScanMode('token'); setFeedback(null); }}
                  className={`text-[11px] px-3 py-1.5 font-bold rounded-md transition cursor-pointer ${scanMode === 'token' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-850'}`}
                >
                  <Hash className="h-3.5 w-3.5 inline mr-1" />
                  Manual Code
                </button>
              </div>
            </div>

            {feedback && (
              <div className="max-w-md mx-auto w-full">
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl border mb-5 flex items-start space-x-2 text-xs font-semibold ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.message}</span>
                </motion.div>
              </div>
            )}

            <div className="max-w-md mx-auto w-full">
              {scanMode === 'camera' ? (
                <div className="space-y-5">
                  <p className="text-xs text-slate-500 leading-relaxed text-center">
                    To take your attendance, open the camera below and scan the dynamic QR Code displayed on the office workstation PC.
                  </p>

                  {cameraActive ? (
                    <div className="relative rounded-2xl overflow-hidden aspect-square sm:aspect-video bg-neutral-950 border border-slate-200 flex flex-col justify-end w-full shadow-md">
                      <video 
                        ref={(el) => {
                          if (el) {
                            if (cameraStream && el.srcObject !== cameraStream) {
                              el.srcObject = cameraStream;
                            }
                            videoRef.current = el;
                          } else {
                            videoRef.current = null;
                          }
                        }} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="absolute inset-0 w-full h-full object-cover opacity-90" 
                      />
                      
                      {/* Centered target scanning frame overlay */}
                      <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center">
                        <div className="w-44 h-44 sm:w-56 sm:h-56 border-2 border-indigo-400 relative rounded-xl bg-transparent transition-all shadow-[0_0_80px_rgba(0,0,0,0.5)]">
                          <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-indigo-400 -mt-1 -ml-1 rounded-tl-md"></div>
                          <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-indigo-400 -mt-1 -mr-1 rounded-tr-md"></div>
                          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-indigo-400 -mb-1 -ml-1 rounded-bl-md"></div>
                          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-indigo-400 -mb-1 -mr-1 rounded-br-md"></div>
                          
                          {/* Interactive dynamic scanner bar */}
                          <div className="w-full h-0.5 bg-gradient-to-r from-red-500 via-rose-400 to-red-500 absolute top-1/2 -translate-y-1/2 shadow-lg animate-pulse" />
                        </div>
                        <span className="text-[10px] text-slate-100 font-extrabold uppercase tracking-widest mt-4 bg-slate-900/60 px-3 py-1 rounded-full backdrop-blur-xs">
                          Align Dynamic QR Code Inside
                        </span>
                      </div>

                      <div className="relative z-10 p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-200">
                        <span className="flex items-center space-x-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                          <span>Live Scanner Feed</span>
                        </span>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="bg-red-650 hover:bg-red-700 bg-red-600 px-3 py-1.5 rounded-lg text-white font-bold tracking-wider uppercase transition cursor-pointer"
                        >
                          Disconnect Lens
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={toggleCamera}
                      id="employee-camera-activation"
                      className="w-full flex items-center justify-center space-x-2 py-4 border border-dashed border-slate-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/10 text-slate-600 hover:text-indigo-600 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                      <Scan className="h-4.5 w-4.5" />
                      <span>Open Camera</span>
                    </button>
                  )}

                </div>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed text-center">
                    If you cannot scan the QR, please enter the 6-digit passcode displayed on the office workstation PC. Code is refreshed every 60 seconds.
                  </p>

                  <div>
                    <label htmlFor="manual-pass-code" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Manager Active OTP Token
                    </label>
                    <input
                      id="manual-pass-code"
                      type="text"
                      required
                      maxLength={6}
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-widest font-mono text-3xl py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800"
                      placeholder="000000"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || manualToken.length !== 6}
                    id="employee-token-submit"
                    className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider transition disabled:opacity-55 cursor-pointer shadow-sm"
                  >
                    {isSubmitting ? 'Verifying Token OTP...' : `Take Attendance`}
                  </button>
                </form>
              )}
            </div>
          </div>

          {currentShift ? (
            <div className="max-w-md mx-auto w-full mt-6">
              <div className="p-4 rounded-xl bg-indigo-50/45 border border-indigo-100 flex items-center justify-between text-xs font-semibold">
                <div>
                  <span className="font-bold text-indigo-700 flex items-center leading-none">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                    Successful Check-In Session Since:
                  </span>
                  <span className="block mt-1 bg-white inline-block px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-600 text-[10px]">
                    {new Date(currentShift.checkInTime).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto w-full mt-6">
              <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-100 flex items-center text-xs text-amber-800 font-semibold">
                <AlertCircle className="h-4 w-4 mr-2 shrink-0" />
                <span>No active shift found. Ready for new Check-in.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. HISTORICAL SHIFTS TABLE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight mb-4 flex items-center">
          <Calendar className="h-4 w-4 mr-2 text-indigo-600" />
          Attendance History
        </h3>

        {attendances.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 border border-dashed rounded-xl border-slate-200 text-slate-400 text-xs font-semibold">
            No attendance recorded for this account. Submit a scan or enter a code to begin logging.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs" id="employee-shifts-table">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Check-Out</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-705 text-slate-700">
                {attendances.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition font-sans">
                    <td className="py-3.5 px-4 font-bold text-slate-800">{record.date}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-650">
                      {new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-650">
                      {record.checkOutTime ? (
                        new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      ) : (
                        <span className="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">Active Shift</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {calculateHours(record)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${record.status === AttendanceStatus.CHECKED_OUT ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700 animate-pulse'}`}>
                        {record.status === AttendanceStatus.CHECKED_OUT ? 'Complete' : 'In Session'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
