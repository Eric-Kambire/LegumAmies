import React from 'react';
import { CloudSun, Sprout, RefreshCw, Sparkles } from 'lucide-react';

export type AppTab = 'weather' | 'harvest' | 'circular' | 'copilot';

interface AppleTabBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  unreadCount?: number;
}

export const AppleTabBar: React.FC<AppleTabBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabs = [
    { id: 'weather' as AppTab, label: 'Météo', icon: CloudSun },
    { id: 'harvest' as AppTab, label: 'Récolte', icon: Sprout },
    { id: 'circular' as AppTab, label: 'Bourse', icon: RefreshCw },
    { id: 'copilot' as AppTab, label: 'Copilote IA', icon: Sparkles },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[500] pointer-events-none flex justify-center pb-[max(env(safe-area-inset-bottom,0px),12px)] px-3">
      <nav
        aria-label="Navigation principale"
        className="pointer-events-auto apple-glass rounded-full px-3 py-1.5 shadow-2xl flex items-center justify-around gap-1 max-w-md w-full border border-white/15"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-full transition-all active:scale-90 ${
                isActive
                  ? 'text-white'
                  : 'text-white/45 hover:text-white/75'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 text-white' : ''
                  }`}
                  strokeWidth={isActive ? 2.3 : 1.8}
                />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight font-medium ${isActive ? 'text-white font-semibold' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
