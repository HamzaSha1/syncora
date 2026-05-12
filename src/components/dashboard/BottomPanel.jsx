import { useState } from 'react';
import AdvisorPanel from './AdvisorPanel';
import EmailIntelPanel from './EmailIntelPanel';

const TABS = [
  { key: 'advisor', label: 'Advisor Tracking' },
  { key: 'email', label: 'Email Intel' },
];

export default function BottomPanel({ onDragStart, onDragEnd }) {
  const [activeTab, setActiveTab] = useState('advisor');

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0 px-4 pt-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors mr-2 ${
              activeTab === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'advisor' ? (
          <AdvisorPanel />
        ) : (
          <EmailIntelPanel onDragStart={onDragStart} onDragEnd={onDragEnd} />
        )}
      </div>
    </div>
  );
}