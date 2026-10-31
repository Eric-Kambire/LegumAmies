import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Mic } from 'lucide-react';
import type { SelectedField } from '../../types/agricultural';
import { getCropNameFr } from '../../services/agriRiskService';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface BedrockCopilotViewProps {
  field: SelectedField | null;
}

let messageCounter = 0;
function formatMessage(sender: 'user' | 'assistant', text: string): Message {
  messageCounter += 1;
  const d = new Date();
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return {
    id: `msg_${messageCounter}`,
    sender,
    text: text.trim(),
    timestamp: timeStr,
  };
}

export const BedrockCopilotView: React.FC<BedrockCopilotViewProps> = ({ field }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init_1',
      sender: 'assistant',
      text: `Bonjour ! Je suis votre copilote agronomique Legum'Amies, propulsé par Amazon Bedrock et entraîné sur les données techniques Terres Inovia & INRAE. Comment puis-je vous aider sur votre parcelle de ${field ? getCropNameFr(field.cropType) : 'légumineuses'} ?`,
      timestamp: '17:40',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    "Faut-il récolter avant la pluie prévue mardi ?",
    "Comment ventiler 15t de pois à 16.8% d'humidité ?",
    "Quel cahier des charges pour l'extrusion végétale ?",
    "Comment éviter l'égrenage de mes lentilles par 30°C ?",
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMsg = formatMessage('user', text);
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      let reply = "D'après les fiches Terres Inovia, pour sécuriser votre récolte, il est recommandé de surveiller le taux d'humidité du grain aux heures les plus chaudes. Si l'hygrométrie descend sous 14%, réduisez la vitesse du batteur pour éviter de briser la graine.";

      const lower = text.toLowerCase();
      if (lower.includes('pluie') || lower.includes('mardi') || lower.includes('orage')) {
        reply = "Face à l'orage annoncé, si votre grain est à moins de 16% d'humidité, battez en priorité les zones sensibles à la verse. Si l'humidité est supérieure à 17%, le coût de séchage industriel (~45€/t) reste préférable à une perte totale par germination sur pied ou verse.";
      } else if (lower.includes('ventiler') || lower.includes('humidite') || lower.includes('humidité')) {
        reply = "Pour un lot à 16.8% d'humidité, enclenchez la ventilation immédiatement avec de l'air dont l'humidité relative est inférieure à 70% (généralement entre 11h et 18h). Visez une stabilisation rapide à 14.5% pour empêcher le développement de moisissures.";
      } else if (lower.includes('extrusion') || lower.includes('cahier') || lower.includes('alt-meat')) {
        reply = "Pour l'extrusion de similis carnés (steaks végétaux), les formulateurs recherchent avant tout un taux de protéines brut > 22% et une teneur en matières grasses < 2%. Le calibre ou la présence de grains fissurés ne sont pas des critères de rejet.";
      } else if (lower.includes('égrenage') || lower.includes('egrenage') || lower.includes('30')) {
        reply = "À plus de 28°C avec un air sec, les gousses deviennent cassantes. Suspendez la moisson entre 13h et 17h, et reprenez dès que l'humidité de l'air remonte en fin de journée (vers 18h30-19h). Vous éviterez jusqu'à 25% de perte au sol.";
      }

      const assistantMsg = formatMessage('assistant', reply);
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 850);
  };

  return (
    <div className="flex-1 flex flex-col h-full max-w-2xl mx-auto w-full px-4 pt-6 pb-24 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight">Copilote Agronomique</h1>
            <p className="text-[11px] text-white/50">Amazon Bedrock (Claude 3.5 Sonnet) • Terres Inovia</p>
          </div>
        </div>

        <span className="px-2.5 py-0.5 rounded-full bg-[#22c55e]/20 text-[#34d399] text-[10px] font-semibold border border-[#22c55e]/30">
          En ligne
        </span>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 scrollbar-none">
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col max-w-[85%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
            >
              <div
                className={`p-3.5 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-[#007aff] text-white rounded-[22px] rounded-br-[6px] shadow-md'
                    : 'apple-card text-white/90 rounded-[22px] rounded-bl-[6px]'
                }`}
              >
                {m.text}
              </div>
              <span className="text-[10px] text-white/35 mt-1 px-1 font-mono">
                {m.timestamp}
              </span>
            </div>
          );
        })}

        {isTyping && (
          <div className="self-start apple-card px-4 py-2.5 rounded-[22px] rounded-bl-[6px] flex items-center gap-1.5 text-xs text-white/50">
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:0.4s]" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="apple-glass px-3 py-1.5 rounded-full text-[11px] text-white/75 hover:text-white whitespace-nowrap active:scale-95 transition-all"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="pt-2 flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Posez une question sur votre moisson ou vos débouchés..."
            className="w-full pl-4 pr-10 py-3 rounded-full bg-white/[0.08] border border-white/[0.12] text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-colors"
          />
          <button
            type="button"
            onClick={() => handleSend("Quelle est l'humidité idéale pour récolter mes légumineuses ?")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-white/50 hover:text-white transition-colors"
            title="Activer la commande vocale"
          >
            <Mic className="w-4 h-4" />
          </button>
        </div>

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="w-10 h-10 rounded-full bg-white text-black disabled:opacity-30 flex items-center justify-center transition-all active:scale-90 shadow-md flex-shrink-0"
        >
          <Send className="w-4 h-4 fill-current" />
        </button>
      </form>
    </div>
  );
};
