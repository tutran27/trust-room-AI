'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Deal, RiskEventLive } from '../lib/api-types';
import { useSocket } from '../providers/socket-provider';

export interface LiveChatMessage {
  dealId: string;
  message: string;
  sender: string;
  speakerRole: 'buyer' | 'seller' | 'ai' | 'system';
  timestamp: string;
}

export interface LiveDealUpdate {
  dealId: string;
  kind?: string;
  status?: string;
  from?: string;
  to?: string;
  timestamp?: string;
  txSignature?: string;
}

export function useDealRoom(deal: Deal | null | undefined, wallet: string | null | undefined) {
  const { socket, connected, joinDeal, leaveDeal, sendChat } = useSocket();
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [riskEvents, setRiskEvents] = useState<RiskEventLive[]>([]);
  const [updates, setUpdates] = useState<LiveDealUpdate[]>([]);

  useEffect(() => {
    if (!deal?.id || !socket) return;

    joinDeal(deal.id, wallet ?? undefined);

    const onChatMessage = (payload: LiveChatMessage) => {
      if (payload.dealId !== deal.id) return;
      setMessages((current) => [...current, payload].slice(-100));
    };

    const onRiskDetected = (payload: RiskEventLive) => {
      if (payload.dealId !== deal.id) return;
      setRiskEvents((current) => [payload, ...current].slice(0, 20));
    };

    const onDealUpdate = (payload: LiveDealUpdate) => {
      if (payload.dealId !== deal.id) return;
      setUpdates((current) => [payload, ...current].slice(0, 20));
    };

    socket.on('chat_message', onChatMessage);
    socket.on('risk_detected', onRiskDetected);
    socket.on('deal_update', onDealUpdate);

    return () => {
      socket.off('chat_message', onChatMessage);
      socket.off('risk_detected', onRiskDetected);
      socket.off('deal_update', onDealUpdate);
      leaveDeal(deal.id);
    };
  }, [deal?.id, joinDeal, leaveDeal, socket, wallet]);

  const apiSuggestedRole = useMemo<'buyer' | 'seller'>(() => {
    if (wallet && deal?.sellerWallet === wallet) return 'seller';
    return 'buyer';
  }, [deal?.sellerWallet, wallet]);

  return {
    connected,
    messages,
    riskEvents,
    updates,
    sendChatMessage: (message: string) => {
      if (!deal?.id || !wallet) return;
      sendChat({
        dealId: deal.id,
        message,
        sender: wallet,
        speakerRole: apiSuggestedRole,
      });
    },
  };
}
