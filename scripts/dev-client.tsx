import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MtgCard } from '../src/react/MtgCard';
import type { MtgCardDisplayData } from '../src/types';

interface RenderResult {
  display: MtgCardDisplayData;
  cardData: any;
  crucibleTextNormalized: string;
}

type Tab = 'card' | 'cardData' | 'scryfallJson' | 'scryfallText' | 'crucibleText' | 'crucibleTextNormalized' | 'rotations';

const TABS: { key: Tab; label: string }[] = [
  { key: 'card', label: 'Card' },
  { key: 'cardData', label: 'CardData' },
  { key: 'scryfallJson', label: 'Scryfall JSON' },
  { key: 'scryfallText', label: 'Scryfall Text' },
  { key: 'crucibleText', label: 'Crucible Text' },
  { key: 'crucibleTextNormalized', label: 'Crucible Text Normalized' },
  { key: 'rotations', label: 'Rotations' },
];

// const DEFAULT_TEXT = `Crucible of Legends {3}
// Art: https://raw.githubusercontent.com/nathanfdunn/mtg-crucible/refs/heads/main/logo/banner-image.png
// Rarity: Mythic Rare
// Legendary Artifact
// Whenever a legendary creature you control dies, return it to your hand at the beginning of the next end step.
// *Every great story begins with fire.*`;
const DEFAULT_TEXT = `{
  "name": "Invasion of Gobakhan",
  "manaCost": "{1}{W}",
  "types": ["battle"],
  "subtypes": ["Siege"],
  "abilities": "When Invasion of Gobakhan enters the battlefield, look at target opponent's hand. You may exile a nonland card from it. For as long as that card remains exiled, its owner may play it. A spell cast this way costs {2} more to cast.",
  "frameColor": "white",
  "rarity": "rare",
  "battleDefense": "3",
  "linkType": "transform",
  "linkedCard": {
    "name": "Lightshield Array",
    "types": ["enchantment", "creature"],
    "frameColor": "white",
    "rarity": "rare",
    "abilities": "At the beginning of your end step, put a +1/+1 counter on each creature you control.\\nSacrifice Lightshield Array: Creatures you control gain hexproof and indestructible until end of turn.",
    "power": "0",
    "toughness": "4"
  }
}`;

function App() {
  const [cardText, setCardText] = useState(DEFAULT_TEXT);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('card');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timing, setTiming] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const doRender = async () => {
    setLoading(true);
    setError(null);
    setTiming('');
    const t0 = performance.now();

    try {
      const res = await fetch('/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cardText }),
      });
      const serverMs = res.headers.get('X-Render-Time-Ms');

      if (!res.ok) {
        const err = await res.text();
        setError(err);
        return;
      }

      const json = await res.json();
      setResult({ display: json.display, cardData: json.cardData, crucibleTextNormalized: json.crucibleTextNormalized });

      const totalMs = Math.round(performance.now() - t0);
      setTiming(`Total: ${totalMs}ms${serverMs ? ` (server: ${serverMs}ms)` : ''}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') doRender();
  };

  const renderTabContent = () => {
    if (loading) return <div className="spinner" />;
    if (error) return <pre className="error">{error}</pre>;
    if (!result) return <span style={{ color: '#666' }}>Click Render to see output</span>;

    switch (activeTab) {
      case 'card':
        return (
          <div style={{ height: 500, display: 'flex', justifyContent: 'center' }}>
            <MtgCard card={result.display} cardText={result.display.scryfallText} />
          </div>
        );
      case 'cardData':
        return <pre>{JSON.stringify(result.cardData, null, 2)}</pre>;
      case 'scryfallJson':
        return <pre>{JSON.stringify(JSON.parse(result.display.scryfallJson), null, 2)}</pre>;
      case 'scryfallText':
        return <pre>{result.display.scryfallText}</pre>;
      case 'crucibleText':
        return <pre>{result.display.crucibleText}</pre>;
      case 'crucibleTextNormalized':
        return <pre>{result.crucibleTextNormalized}</pre>;
      case 'rotations':
        return <pre>{JSON.stringify(result.display.rotations, null, 2)}</pre>;
    }
  };

  return (
    <>
      <h1>MTG Crucible</h1>
      <div className="container">
        <div className="input-panel">
          <textarea
            ref={textareaRef}
            value={cardText}
            onChange={(e) => setCardText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="controls">
            <button onClick={doRender} disabled={loading}>Render</button>
          </div>
        </div>
        <div className="output-panel">
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={activeTab === t.key ? 'active' : ''}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div id="output">
            {renderTabContent()}
          </div>
          {timing && <div className="timing">{timing}</div>}
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
