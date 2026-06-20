/**
 * Canonical backend event types for the deal/transcript/risk/evidence pipeline.
 * Used as WebSocket message types and event-sourcing-lite timeline entries.
 */
export const DealEvent = {
  DealCreated: 'deal.created',
  DealUpdated: 'deal.updated',
  DealSellerInvited: 'deal.seller_invited',
  DealPublished: 'deal.published',
  DealInvitationOpened: 'deal.invitation_opened',
  DealCancelled: 'deal.cancelled',
  DealJoined: 'deal.joined',
  WalletConnected: 'wallet.connected',
  WalletVerified: 'wallet.verified',
  EscrowInitialized: 'escrow.initialized',
  EscrowDeposited: 'escrow.deposited',
  CallStarted: 'call.started',
  CallParticipantJoined: 'call.participant_joined',
  CallParticipantLeft: 'call.participant_left',
  TranscriptChunk: 'transcript.chunk',
  TermsExtracted: 'terms.extracted',
  TermsConfirmedByBuyer: 'terms.confirmed_by_buyer',
  TermsConfirmedBySeller: 'terms.confirmed_by_seller',
  RiskDetected: 'risk.detected',
  WarningShown: 'warning.shown',
  DeliverySubmitted: 'delivery.submitted',
  EvidenceCreated: 'evidence.created',
  EvidenceHashAnchored: 'evidence.hash_anchored',
  DisputeOpened: 'dispute.opened',
  DisputeReportGenerated: 'dispute.report_generated',
  DisputeResolved: 'dispute.resolved',
  EscrowReleased: 'escrow.released',
  EscrowRefunded: 'escrow.refunded',
  ReputationUpdated: 'reputation.updated',
} as const;

export type DealEvent = (typeof DealEvent)[keyof typeof DealEvent];
