'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

export interface MessageBlockedEvent {
  dealId: string;
  reason: string;
  intents: string[];
  level: string;
}

export interface DealErrorEvent {
  dealId: string;
  code: string;
  message: string;
}

export function useDealRoom(deal: Deal | null | undefined, wallet: string | null | undefined) {
  const { socket, connected, joinDeal, leaveDeal, sendChat } = useSocket();
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [riskEvents, setRiskEvents] = useState<RiskEventLive[]>([]);
  const [updates, setUpdates] = useState<LiveDealUpdate[]>([]);
  const [blockedMessages, setBlockedMessages] = useState<MessageBlockedEvent[]>([]);
  const [dealError, setDealError] = useState<DealErrorEvent | null>(null);

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

    const onMessageBlocked = (payload: MessageBlockedEvent) => {
      if (payload.dealId !== deal.id) return;
      setBlockedMessages((current) => [payload, ...current].slice(0, 20));
    };

    const onDealError = (payload: DealErrorEvent) => {
      if (payload.dealId !== deal.id) return;
      setDealError(payload);
    };

    socket.on('chat_message', onChatMessage);
    socket.on('risk_detected', onRiskDetected);
    socket.on('deal_update', onDealUpdate);
    socket.on('message_blocked', onMessageBlocked);
    socket.on('deal_error', onDealError);

    return () => {
      socket.off('chat_message', onChatMessage);
      socket.off('risk_detected', onRiskDetected);
      socket.off('deal_update', onDealUpdate);
      socket.off('message_blocked', onMessageBlocked);
      socket.off('deal_error', onDealError);
      leaveDeal(deal.id);
    };
  }, [deal?.id, joinDeal, leaveDeal, socket, wallet]);

  const apiSuggestedRole = useMemo<'buyer' | 'seller'>(() => {
    if (wallet && deal?.sellerWallet === wallet) return 'seller';
    return 'buyer';
  }, [deal?.sellerWallet, wallet]);

  const sendChatMessage = useCallback(
    (message: string) => {
      if (!deal?.id || !wallet) return;
      // No optimistic update — the server validates sender/role and returns
      // the authoritative broadcast or message_blocked event.
      sendChat({
        dealId: deal.id,
        message,
        sender: wallet,
        speakerRole: apiSuggestedRole,
      });
    },
    [deal?.id, wallet, apiSuggestedRole, sendChat],
  );

  return {
    connected,
    messages,
    riskEvents,
    updates,
    blockedMessages,
    dealError,
    sendChatMessage,
  };
}
