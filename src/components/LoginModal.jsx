import React, { useState } from 'react';
import { 
  Shield, 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  Radio,
  Ambulance,
  Flame,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Preset credentials for Citizen, Responder, and Admin
const PRESET_ACCOUNTS = {
  admin: {
    key: 'admin',
    roleLabel: 'Admin (EOC)',
    title: 'EOC Operations Director',
    badge: 'Operations Command',
    email: 'admin@emergency.com',
    password: 'AdminPassword123!',
    orgId: 'org-emergency-01',
    accessSummary: 'Full administrative control, incident dispatch, responder assignment, escalation & analytics.',
    accentColor: 'amber'
  },
  responder: {
    key: 'responder',
    roleLabel: 'Responder',
    title: 'Emergency Unit Captain',
    badge: 'Field Response Unit',
    email: 'responder@emergency.com',
    password: 'ResponderPassword123!',
    orgId: 'org-emergency-01',
    accessSummary: 'Incoming dispatch alerts, route navigation HUD, status updates (en route, arrived, resolved).',
    accentColor: 'emerald'
  },
  user: {
    key: 'user',
    roleLabel: 'Citizen',
    title: 'Citizen Reporter',
    badge: 'Standard Citizen',
    email: 'user@emergency.com',
    password: 'UserPassword123!',
    orgId: 'org-emergency-01',
    accessSummary: 'Quick emergency reporting, GPS location confirmation, live status tracking & personal incident history.',
    accentColor: 'sky'
  }
};

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const { login, register } = useAuth();
  
  // Active mode: 'login' or 'register'
  const [mode, setMode] = useState('login');
  
  // Active role tab for 1-click test fill: 'admin', 'responder', 'user'
  const [activeRole, setActiveRole] = useState('user');
  
  // Form fields
  const [email, setEmail] = useState('user@emergency.com');
  const [password, setPassword] = useState('UserPassword123!');
  const [fullName, setFullName] = useState('Jane Citizen');
  const [phone, setPhone] = useState('+91-98765-43210');
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleSelectRole = (roleKey) => {
    setActiveRole(roleKey);
    const preset = PRESET_ACCOUNTS[roleKey];
    if (preset) {
      setEmail(preset.email);
      setPassword(preset.password);
      setErrorMessage('');
      setSuccessMessage('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (mode === 'register') {
        if (!fullName.trim() || !email.trim() || !password.trim()) {
          throw new Error('Please fill in all required fields.');
        }
        await register({
          email: email.trim(),
          password: password.trim(),
          full_name: fullName.trim(),
          phone: phone.trim() || undefined,
          role: 'USER'
        });
        setSuccessMessage('Registration successful! Redirecting...');
      } else {
        await login(email.trim(), password.trim());
        setSuccessMessage('Authentication successful! Welcome to the Emergency Platform.');
      }

      setTimeout(() => {
        if (onLoginSuccess) onLoginSuccess();
        if (onClose) onClose();
      }, 500);
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white font-heading">
                Emergency Response <span className="text-orange-500">Platform</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Secure Hyperlocal Access & Role Authentication
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Mode Toggle: Login vs Register */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800/80 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMessage(''); }}
            className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Sign In (Login)
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMessage(''); }}
            className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Register Citizen Account
          </button>
        </div>

        {/* 1-Click Role Switcher (Available in login mode) */}
        {mode === 'login' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-medium">
              <span>Select Role for Instant Demo:</span>
              <span className="text-[10px] uppercase font-mono text-orange-400 font-bold">1-Click Fill</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.keys(PRESET_ACCOUNTS).map((roleKey) => {
                const acc = PRESET_ACCOUNTS[roleKey];
                const isSelected = activeRole === roleKey;
                return (
                  <button
                    key={roleKey}
                    type="button"
                    onClick={() => handleSelectRole(roleKey)}
                    className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-orange-500/80 bg-orange-500/10 text-orange-400 shadow-md ring-1 ring-orange-500/40'
                        : 'border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                      {acc.roleLabel}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {acc.badge}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Error / Success Messages */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jane Citizen"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91-98765-43210"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@emergency.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : mode === 'register' ? (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Sign In as {PRESET_ACCOUNTS[activeRole]?.roleLabel || 'User'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

        </form>

        {/* Security Footer */}
        <div className="pt-2 text-center border-t border-slate-200 dark:border-slate-800/80">
          <p className="text-[10px] text-slate-400 font-mono flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>PBKDF2-HMAC-SHA256 Encrypted & Role Guarded</span>
          </p>
        </div>

      </div>

    </div>
  );
}
