import React from 'react';
import { Home, Map, Sprout, TrendingUp, Bell } from 'lucide-react';

export type AppTab = 'home' | 'weather' | 'fields' | 'insights' | 'notifications';

interface AppleTabBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  unreadCount?: number;
}

export const AppleTabBar: React.FC<AppleTabBarProps> = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
}) => {
  const tabs = [
    { id: 'home' as AppTab, label: 'Accueil', icon: Home },
    { id: 'weather' as AppTab, label: 'Carte', icon: Map },
    { id: 'fields' as AppTab, label: 'Parcelles', icon: Sprout },
    { id: 'insights' as AppTab, label: 'Analyses', icon: TrendingUp },
    { id: 'notifications' as AppTab, label: 'Alertes', icon: Bell, badge: unreadCount },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[700] pointer-events-none flex justify-center pb-[max(env(safe-area-inset-bottom,0px),12px)] px-3">
      <nav
        aria-label="Navigation principale"
        className="pointer-events-auto apple-glass rounded-full px-2 sm:px-3 py-1.5 shadow-2xl flex items-center justify-around gap-1 max-w-lg w-full border border-white/15"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              data-notification-trigger={tab.id === 'notifications' ? 'true' : undefined}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1.5 rounded-full transition-all active:scale-90 ${
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
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-[14px] rounded-full bg-[#ef4444] text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                    {tab.badge}
                  </span>
                ) : null}
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
