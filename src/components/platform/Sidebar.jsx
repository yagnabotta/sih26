import React from 'react';
import { 
  LayoutDashboard, 
  Cpu, 
  UploadCloud, 
  FileText, 
  Activity, 
  ShieldAlert, 
  ShieldCheck,
  Zap, 
  Settings, 
  LogOut, 
  X,
  ChevronLeft,
  ChevronRight,
  Menu,
  PhoneCall,
  Navigation,
  Radio,
  Flame,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ 
  currentPath = '/dashboard', 
  onNavigate, 
  isOpen = false, 
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  onExitPlatform
}) {
  const { user, logout, role, isAdmin, isResponder, isCitizen } = useAuth();

  // Role-Specific Navigation Groups
  let navGroups = [];

  if (isAdmin) {
    navGroups = [
      {
        title: 'EOC COMMAND',
        items: [
          { id: 'dashboard', path: '/dashboard', label: 'EOC Operations Center', icon: LayoutDashboard },
          { id: 'reports', path: '/reports', label: 'Emergency Incidents', icon: FileText },
          { id: 'risk_heatmap', path: '/risk-heatmap', label: 'Facility Risk Map', icon: ShieldAlert },
          { id: 'analytics', path: '/analytics', label: 'Response Telemetry', icon: Activity },
          { id: 'sif_precursors', path: '/sif-precursors', label: 'SIF Precursor Center', icon: Zap },
          { id: 'ai_analysis', path: '/ai-analysis', label: 'AI Incident Analysis', icon: Cpu, isAi: true },
          { id: 'bulk_upload', path: '/bulk-upload', label: 'Bulk Data Ingestion', icon: UploadCloud }
        ]
      },
      {
        title: 'MANAGEMENT',
        items: [
          { id: 'critical_alerts', path: '/critical-alerts', label: 'System Alerts', icon: Radio },
          { id: 'settings', path: '/settings', label: 'Fleet & EOC Settings', icon: Settings },
        ]
      }
    ];
  } else if (isResponder) {
    navGroups = [
      {
        title: 'RESPONDER OPERATIONS',
        items: [
          { id: 'dashboard', path: '/dashboard', label: 'Responder Workstation', icon: LayoutDashboard },
          { id: 'critical_alerts', path: '/critical-alerts', label: 'Active Dispatches', icon: ShieldAlert, badge: 'LIVE', badgeColor: 'rose' },
          { id: 'reports', path: '/reports', label: 'Assigned Incidents', icon: FileText },
          { id: 'life_saving_rules', path: '/life-saving-rules', label: 'Standard Operating Protocol', icon: ShieldCheck }
        ]
      },
      {
        title: 'UNIT TELEMETRY',
        items: [
          { id: 'settings', path: '/settings', label: 'Unit Readiness Settings', icon: Settings }
        ]
      }
    ];
  } else {
    // Standard Citizen / User
    navGroups = [
      {
        title: 'CITIZEN PORTAL',
        items: [
          { id: 'dashboard', path: '/dashboard', label: 'Emergency Overview', icon: LayoutDashboard },
          { id: 'submit_report', path: '/submit-report', label: 'Report Emergency', icon: Zap, badge: 'SOS', badgeColor: 'rose' },
          { id: 'reports', path: '/reports', label: 'My Reported Incidents', icon: FileText },
          { id: 'critical_alerts', path: '/critical-alerts', label: 'Community Alerts', icon: ShieldAlert }
        ]
      },
      {
        title: 'PERSONAL',
        items: [
          { id: 'settings', path: '/settings', label: 'Profile & Emergency Contacts', icon: Settings }
        ]
      }
    ];
  }

  const handleItemClick = (path) => {
    if (onNavigate) onNavigate(path);
    if (onClose) onClose();
  };

  const handleExit = () => {
    if (onExitPlatform) {
      onExitPlatform();
    } else {
      logout();
    }
  };

  // Role Badge Config
  const roleBadge = isAdmin
    ? { label: 'ADMIN (EOC)', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
    : isResponder
    ? { label: 'RESPONDER', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
    : { label: 'CITIZEN', bg: 'bg-sky-500/20 text-sky-400 border-sky-500/30' };

  const sidebarContent = (
    <div className={`flex flex-col h-full bg-[#0B1327] border-r border-slate-800/80 text-slate-300 shrink-0 select-none shadow-2xl transition-all duration-300 ${
      isCollapsed ? 'w-20' : 'w-64'
    }`}>
      
      {/* 1. Header: Brand Logo & Arrow */}
      {isCollapsed ? (
        <div className="p-3.5 border-b border-slate-800/80 flex flex-col items-center justify-center gap-2">
          <div 
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF6B4A] to-[#FF5A36] flex items-center justify-center text-white shadow-lg shadow-orange-500/25 shrink-0" 
            title="Hyperlocal Emergency Platform"
          >
            <ShieldCheck className="w-5 h-5 text-white stroke-[2.5]" />
          </div>
          
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="w-10 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-all cursor-pointer group shadow-xs"
              title="Expand navigation sidebar"
            >
              <Menu className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" />
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-400 transition-colors" />
            </button>
          )}
        </div>
      ) : (
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF6B4A] to-[#FF5A36] flex items-center justify-center text-white shadow-lg shadow-orange-500/25">
                <ShieldCheck className="w-5 h-5 text-white stroke-[2.5]" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-black tracking-tight text-white font-heading">
                  Emergency<span className="text-[#FF5A36]">Net</span>
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium tracking-tight truncate">
                Hyperlocal Response Platform
              </div>
            </div>
          </div>

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* 2. Navigation Items List grouped */}
      <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-2 py-3' : 'px-3 py-4'} space-y-3 custom-scrollbar`}>
        {navGroups.map((group, gIdx) => (
          <div key={group.title} className="space-y-1">
            {isCollapsed ? (
              gIdx > 0 ? <div className="my-2 border-t border-slate-800/80 mx-2" /> : null
            ) : (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
            )}

            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.path)}
                  title={item.label}
                  className={`w-full flex items-center rounded-xl text-left text-xs font-semibold transition-all duration-200 group relative cursor-pointer ${
                    isCollapsed
                      ? 'justify-center p-2.5 h-11'
                      : 'justify-between px-3.5 py-2.5'
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-[#FF5A36] to-[#FFA133] text-white font-bold shadow-md shadow-orange-500/25'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                    <div className="relative flex items-center justify-center">
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                      }`} />
                    </div>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && item.badge && (
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      item.badgeColor === 'rose'
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-orange-500 text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* 3. Bottom of Sidebar: Role Badge, User Profile & Exit Platform */}
      <div className={`border-t border-slate-800/80 ${isCollapsed ? 'p-2' : 'p-3'} space-y-2`}>
        
        {/* Active Role Badge */}
        {!isCollapsed && (
          <div className="px-2 py-1.5 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono">Current Role</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border font-mono ${roleBadge.bg}`}>
              {roleBadge.label}
            </span>
          </div>
        )}

        {/* User Card */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 px-2 py-1.5'}`}>
          <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-700">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">
                {user?.full_name || 'Emergency User'}
              </div>
              <div className="text-[10px] text-slate-400 truncate font-mono">
                {user?.email || 'user@emergency.com'}
              </div>
            </div>
          )}
        </div>

        {/* Exit / Sign Out Button */}
        <button
          onClick={handleExit}
          className={`w-full flex items-center rounded-xl text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-500/20 transition-all cursor-pointer ${
            isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
          }`}
          title="Sign out of platform"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>

      </div>

    </div>
  );

  return (
    <>
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 z-40 transition-all duration-300">
        {sidebarContent}
      </aside>

      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex animate-fadeIn">
          <div 
            onClick={onClose} 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" 
          />
          <div className="relative w-64 max-w-[85vw] h-full z-10 animate-slideRight">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
